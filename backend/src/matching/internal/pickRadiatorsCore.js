/**
 * Назначение: ядро подбора радиаторов.
 * Описание: расчёт секций по комнатам, сортировка и выбор моделей из каталога, учёт вентиляции,
 * панельных SKU и предупреждений; внутренняя реализация pickRadiators.
 */
import { round } from '../../utils/math.js';
import { logger } from '../../utils/logger.js';
import { buildWarmFloorMatchingNotes } from '../warmFloor.js';
import {
  buildUfhHeatFluxUpWattsByRoomId,
  resolveMixedRadiatorRoomLoad,
} from './resolveMixedRadiatorRoomLoad.js';
import { isMixedRadiatorsUfhHeatingMode } from './mixedRadiatorsUfhMode.js';
import { resolveKVent } from '../../logic/ventilationReserve.js';
import {
  adjustOutputWatts,
  adjustedRadiatorWatts,
  filterPanelsByConnection,
  isPanelRadiator,
  isSectionalRadiator,
  parsePanelHeightMm,
  pickPanelSkuForRoom,
  underwindowHeightWarning,
} from '../radiatorSizingHelpers.js';

const MAX_SECTIONS_HEURISTIC = 80;
/** Сколько секционных моделей перебирать per room для минимума секций. */
const SECTIONAL_CANDIDATES_PER_ROOM = 16;

/**
 * ΔT за EN442: (Ts + Tr)/2 - Ti
 */
function deltaTmeanK({ supplyC, returnC, insideC }) {
  return ((supplyC + returnC) / 2) - insideC;
}

/**
 * Паспортна потужність секції при базовій ΔT50/ΔT70.
 * @param {import('../catalog/types').RadiatorCatalogItemNormalized} r
 * @param {50 | 70} baseDeltaT
 */
function sectionOutputPassport(r, baseDeltaT) {
  return baseDeltaT === 70 ? r.outputWatts.deltaT70 : r.outputWatts.deltaT50;
}

/**
 * Пріоритет брендів/сімейств під джерело тепла та підводку (Fondital / Mirado / Korado як Radik тощо).
 * @param {import('../catalog/types').RadiatorCatalogItemNormalized} r
 * @param {'individual' | 'central'} heatingDistribution
 * @param {'side' | 'bottom' | undefined} connection
 */
function radiatorBrandPreferenceScore(r, heatingDistribution, connection) {
  const m = String(r?.model ?? '').toLowerCase();
  const mat = String(r?.material ?? '').toLowerCase();
  let score = 0;
  if (heatingDistribution === 'central') {
    if (m.includes('mirado') || mat.includes('бимет')) score += 120;
    if (m.includes('global')) score += 60;
  } else {
    if (m.includes('fondital')) score += 120;
    if (m.includes('radik')) score += 100;
    if (m.includes('korado')) score += 100;
    if (m.includes('global')) score += 70;
    if (m.includes('exclusivo') || m.includes('blitz')) score += 50;
    // Mirado та біметал — типово для ЦТ із жорстким теплоносієм; для ІТП знижуємо пріоритет відносно Fondital/Korado.
    if (m.includes('mirado') || mat.includes('бимет')) score -= 40;
  }
  if (connection === 'bottom') {
    if (/\bvkp\b|\b\d{2}vk\b/i.test(m)) score += 60;
    if (isPanelRadiator(r)) score += 20;
  } else if (connection === 'side') {
    if (/-k\b|klasik|секцион|b3|b4/i.test(m)) score += 30;
  }
  return score;
}

/**
 * Поєднує паспортну потужність секції та брендовий пріоритет (ЦТ ↔ ІТП, підводка VK/VKP).
 */
function radiatorCompositeRank(r, baseDeltaT, heatingDistribution, connection) {
  const w = sectionOutputPassport(r, baseDeltaT);
  const b = radiatorBrandPreferenceScore(r, heatingDistribution, connection);
  if (heatingDistribution === 'individual') return w + b * 0.38;
  return w + b * 0.08;
}

/**
 * Сортування радіаторів для підбору.
 * @param {import('../catalog/types').RadiatorCatalogItemNormalized[]} radiators
 * @param {50 | 70} baseDeltaT
 * @param {'individual' | 'central'} heatingDistribution
 * @param {'side' | 'bottom' | undefined} connection
 */
function sortRadiatorsForMatching(radiators, baseDeltaT, heatingDistribution, connection) {
  return [...radiators].sort((a, b) => {
    const ra = radiatorCompositeRank(a, baseDeltaT, heatingDistribution, connection);
    const rb = radiatorCompositeRank(b, baseDeltaT, heatingDistribution, connection);
    if (rb !== ra) return rb - ra;
    return sectionOutputPassport(b, baseDeltaT) - sectionOutputPassport(a, baseDeltaT);
  });
}

/**
 * Секционный подбор по комнате (перебор топ-кандидатов).
 * @returns {{ kind: 'section', radiator: import('../catalog/types').RadiatorCatalogItemNormalized, sections: number, adjustedWatts: number, sectionsThermalMin: number } | null}
 */
function sizeRoomSectional(qRad, sectionalPool, baseDeltaT, targetDeltaT) {
  if (!sectionalPool.length || qRad <= 0) return null;
  const candidates = sectionalPool.slice(0, SECTIONAL_CANDIDATES_PER_ROOM);
  /** @type {{ kind: 'section', radiator: import('../catalog/types').RadiatorCatalogItemNormalized, sections: number, adjustedWatts: number, sectionsThermalMin: number } | null} */
  let best = null;
  for (const r of candidates) {
    const adjustedWatts = adjustedRadiatorWatts(r, baseDeltaT, targetDeltaT);
    if (adjustedWatts <= 0) continue;
    const sectionsThermalMin = Math.ceil(qRad / adjustedWatts);
    // При рівній кількості секцій обираємо секцію меншої потужності (менший перезапас).
    const isBetter =
      !best ||
      sectionsThermalMin < best.sections ||
      (sectionsThermalMin === best.sections && adjustedWatts < best.adjustedWatts);
    if (isBetter) {
      best = {
        kind: 'section',
        radiator: r,
        sections: sectionsThermalMin,
        adjustedWatts,
        sectionsThermalMin,
      };
    }
  }
  return best;
}

/**
 * @param {object} roomCtx
 */
function applyWindowWidthRulesSectional(roomCtx) {
  const {
    sections: initialSections,
    sectionWidthMm,
    windowOpeningWidthMm,
    ventilationReserveFactor,
  } = roomCtx;
  let sections = initialSections;
  const sizingNotes = [];
  const minSectionsForWindow =
    windowOpeningWidthMm != null && sectionWidthMm != null && sectionWidthMm > 0
      ? Math.ceil((0.7 * windowOpeningWidthMm) / sectionWidthMm)
      : null;

  if (sections != null && minSectionsForWindow != null && sections < minSectionsForWindow) {
    const prev = sections;
    sections = Math.min(Math.max(minSectionsForWindow, prev), MAX_SECTIONS_HEURISTIC);
    if (sections > prev) {
      sizingNotes.push(
        `Для правила ≥70% ширины окна число секций увеличено с ${prev} до ${sections} (тепловая нагрузка с kVent=${ventilationReserveFactor} уже была покрыта меньшим числом).`,
      );
    }
  }

  let radiatorWidthMm =
    sections != null && sectionWidthMm != null ? sections * sectionWidthMm : null;
  let widthCoverageRatio =
    radiatorWidthMm != null && windowOpeningWidthMm != null
      ? radiatorWidthMm / windowOpeningWidthMm
      : null;
  let widthOk = widthCoverageRatio != null ? widthCoverageRatio >= 0.7 : null;

  if (
    sections != null
    && sectionWidthMm != null
    && windowOpeningWidthMm != null
    && widthOk === false
  ) {
    let s = sections;
    while (s < MAX_SECTIONS_HEURISTIC && sectionWidthMm * s < 0.7 * windowOpeningWidthMm) {
      s += 1;
    }
    if (s > sections) {
      sizingNotes.push(
        `Дополнительно увеличено число секций до ${s} для подхода к покрытию ≥70% ширины окна.`,
      );
      sections = s;
      radiatorWidthMm = sections * sectionWidthMm;
      widthCoverageRatio = radiatorWidthMm / windowOpeningWidthMm;
      widthOk = widthCoverageRatio >= 0.7;
    }
  }

  return { sections, radiatorWidthMm, widthCoverageRatio, widthOk, sizingNotes };
}

/**
 * Выбор между панелью и секционным вариантом для комнаты.
 * @param {object} args
 */
function pickRoomRadiatorSizing(args) {
  const {
    qRad,
    sectionalPool,
    panelPoolFiltered,
    baseDeltaT,
    targetDeltaT,
    radiatorConnection,
    windowOpeningWidthMm,
    openingHeightMm,
    ventilationReserveFactor,
  } = args;

  const sectional = sizeRoomSectional(qRad, sectionalPool, baseDeltaT, targetDeltaT);
  const panelPick =
    panelPoolFiltered.length > 0
      ? pickPanelSkuForRoom(qRad, panelPoolFiltered, baseDeltaT, targetDeltaT)
      : null;

  /** @type {'section' | 'panel'} */
  let useKind = 'section';
  if (radiatorConnection === 'bottom' && panelPick) {
    useKind = 'panel';
  } else if (sectional && panelPick) {
    const panelLen = panelPick.panelLengthMm;
    const panelWidthOk =
      windowOpeningWidthMm != null && panelLen != null
        ? panelLen / windowOpeningWidthMm >= 0.7
        : null;
    const secWidth = sectional.radiator.sectionWidthMm ?? sectional.radiator.dimensions?.width;
    const secSections = sectional.sections;
    const secWidthOk =
      windowOpeningWidthMm != null && secWidth != null && secSections != null
        ? (secWidth * secSections) / windowOpeningWidthMm >= 0.7
        : null;
    if (panelWidthOk === true && secWidthOk === false) useKind = 'panel';
    else if (sectional.sections > 24 && panelPick.adjustedWatts >= qRad) useKind = 'panel';
  } else if (!sectional && panelPick) {
    useKind = 'panel';
  }

  if (useKind === 'panel' && panelPick) {
    const panelLengthMm = panelPick.panelLengthMm;
    const radiatorHeightMm =
      parsePanelHeightMm(panelPick.radiator.model)
      ?? panelPick.radiator.dimensions?.height
      ?? null;
    const widthCoverageRatio =
      windowOpeningWidthMm != null && panelLengthMm != null
        ? panelLengthMm / windowOpeningWidthMm
        : null;
    const widthOk = widthCoverageRatio != null ? widthCoverageRatio >= 0.7 : null;
    /** @type {string[]} */
    const sizingNotes = [];
    if (windowOpeningWidthMm == null) {
      sizingNotes.push('Глухая комната (нет оконного проёма) — правило ≥70% ширины окна не применяется.');
    }
    if (panelPick.underpowered) {
      sizingNotes.push(
        'Ни одна панель из каталога не покрывает расчётную нагрузку — выбрана самая мощная по длине.',
      );
    }
    const hWarn = underwindowHeightWarning(openingHeightMm, radiatorHeightMm);
    if (hWarn) sizingNotes.push(hWarn);

    return {
      kind: 'panel',
      radiator: panelPick.radiator,
      sections: null,
      sectionsThermalMin: null,
      adjustedWatts: panelPick.adjustedWatts,
      radiatorWidthMm: panelLengthMm,
      widthCoverageRatio,
      widthOk,
      sizingNotes,
      panelLengthMm,
    };
  }

  if (!sectional) return null;

  const sectionWidthMm =
    sectional.radiator.sectionWidthMm ?? sectional.radiator.dimensions?.width ?? null;
  const win = applyWindowWidthRulesSectional({
    sections: sectional.sections,
    sectionsThermalMin: sectional.sectionsThermalMin,
    sectionWidthMm,
    windowOpeningWidthMm,
    ventilationReserveFactor,
  });
  const radiatorHeightMm =
    sectional.radiator.dimensions?.height ?? null;
  const hWarn = underwindowHeightWarning(openingHeightMm, radiatorHeightMm);
  const sizingNotes = [...win.sizingNotes];
  if (windowOpeningWidthMm == null) {
    sizingNotes.push('Глухая комната (нет оконного проёма) — правило ≥70% ширины окна не применяется.');
  }
  if (hWarn) sizingNotes.push(hWarn);

  return {
    kind: 'section',
    radiator: sectional.radiator,
    sections: win.sections,
    sectionsThermalMin: sectional.sectionsThermalMin,
    adjustedWatts: sectional.adjustedWatts,
    radiatorWidthMm: win.radiatorWidthMm,
    widthCoverageRatio: win.widthCoverageRatio,
    widthOk: win.widthOk,
    sizingNotes,
    panelLengthMm: null,
  };
}

/**
 * Підбір радіаторів по кімнатах із запасом на інфільтрацію, узгодження бази ΔT з конденсаційною
 * або економлінією котла, пріоритетом брендів під ЦТ/ІТП та донабором секцій під ширину вікна.
 *
 * @param {object} args
 * @param {import('../types/shared-types').HeatLossReport} args.roomsHeatLoss
 * @param {import('../types/shared-types').HeatingSystemInput} [args.heatingSystem]
 * @param {import('../catalog/types').NormalizedCatalog} args.catalog
 * @param {string|null} [args.radiatorModel]
 * @param {import('../types/shared-types').BuildingInput | null} [args.building]
 * @param {import('../types/boiler-types').BoilerMatchingReport | null} [args.boilerMatching]
 * @param {'economy' | 'efficient' | null} [args.radiatorLineTier] лінія «Економ» / «Ефективний» (фіксований графік)
 * @param {import('../types/shared-types').UnderfloorHeatingReport | null} [args.underfloorHeating]
 * @returns {import('../types/shared-types').RadiatorsMatchingReport}
 */
export function pickRadiators({
  roomsHeatLoss,
  heatingSystem = {},
  catalog,
  radiatorModel = null,
  building = null,
  boilerMatching = null,
  radiatorLineTier = null,
  underfloorHeating = null,
} = {}) {
  const supplyC = heatingSystem.supplyC ?? 75;
  const returnC = heatingSystem.returnC ?? 65;
  const insideC = heatingSystem.insideC ?? 20;

  const hasEfficientProposal =
    radiatorLineTier === 'efficient' ||
    (radiatorLineTier == null && Boolean(boilerMatching?.proposalEfficient));
  /** Для конденсаційної лінії котла узгоджуємо «низьку» базу ΔT каталогу радіатора за замовчуванням */
  let baseDeltaT = /** @type {50 | 70 | undefined} */ (heatingSystem.radiatorReferenceDeltaT);
  if (baseDeltaT == null) {
    if (radiatorLineTier === 'economy') {
      baseDeltaT = 70;
    } else if (radiatorLineTier === 'efficient') {
      baseDeltaT = 50;
    } else {
      baseDeltaT = hasEfficientProposal ? 50 : 70;
    }
  }

  const heatingDistribution =
    building?.objectMeta?.heatingDistribution === 'central' ? 'central' : 'individual';
  const radiatorConnection = heatingSystem.radiatorConnection;
  const ventilationReserveFactor = resolveKVent(
    building?.objectMeta?.ventilationReserveMode,
  );

  const targetDeltaT = deltaTmeanK({ supplyC, returnC, insideC });
  logger.info('matching.radiators.start', null, {
    baseDeltaT,
    targetDeltaT: round(targetDeltaT, 1),
    rooms: roomsHeatLoss?.rooms?.length ?? 0,
    radiatorModel,
    heatingDistribution,
    radiatorConnection: radiatorConnection ?? null,
    hasEfficientProposal,
    waterUnderfloorHeating: Boolean(heatingSystem.waterUnderfloorHeating),
    thermalRegimePreset: heatingSystem.thermalRegimePreset ?? null,
    ventilationReserveFactor,
  });

  const allRadiators = catalog?.radiators ?? [];
  const sectionalPool = allRadiators.filter((r) => isSectionalRadiator(r));
  const panelPoolRaw = allRadiators.filter((r) => isPanelRadiator(r));
  const panelPoolFiltered = filterPanelsByConnection(panelPoolRaw, radiatorConnection);

  /** @type {string[]} */
  const radiatorSelectionNotes = [];
  if (panelPoolRaw.length > 0) {
    radiatorSelectionNotes.push(
      `В каталоге ${panelPoolRaw.length} панельных позиций (priceBasis=panel): подбор по длине SKU и мощности на прибор; секции в отчёте не применяются.`,
    );
  }
  if (radiatorConnection === 'bottom' && panelPoolFiltered.length === 0 && panelPoolRaw.length > 0) {
    radiatorSelectionNotes.push(
      'Для нижней подводки в каталоге нет панелей VKP/нижнего подключения — рассмотрите секционные модели или дополните каталог.',
    );
  }
  if (radiatorConnection === 'bottom' && panelPoolRaw.length === 0) {
    radiatorSelectionNotes.push(
      'Запрошена нижняя подводка, но панельных моделей в каталоге нет.',
    );
  }

  if (hasEfficientProposal && radiatorLineTier !== 'economy') {
    const passportHighDeltaT = 70;
    const lowSupplyC = 55;
    const lowReturnC = 45;
    const lowTargetDeltaT = deltaTmeanK({
      supplyC: lowSupplyC,
      returnC: lowReturnC,
      insideC,
    });
    const refWatts = 100;
    const atLow = adjustOutputWatts({
      baseWatts: refWatts,
      baseDeltaT: passportHighDeltaT,
      targetDeltaT: lowTargetDeltaT,
    });
    const relOut = atLow / refWatts;
    const sectionScale = relOut > 0 ? 1 / relOut : 0;
    radiatorSelectionNotes.push(
      `Конденсационный контур: при ориентировочном графике ${lowSupplyC}/${lowReturnC} °C и ${insideC} °C в помещении средний температурный напор радиатора ≈ ${round(lowTargetDeltaT, 1)} К (для сравнения — типичный паспорт ΔT≈70 К при ~90/70 °C). По степенной модели (n≈1,3) удельная теплоотдача падает ≈в ${relOut > 0 ? (1 / relOut).toFixed(1) : '—'} раз — ориентировочно требуется ≈в ${sectionScale > 0 ? sectionScale.toFixed(1) : '—'} раз больше секций/поверхности прибора, чем в высокотемпературной системе.`,
    );
  }

  radiatorSelectionNotes.push(...buildWarmFloorMatchingNotes(heatingSystem));

  const ufhHeatFluxByRoomId = buildUfhHeatFluxUpWattsByRoomId(underfloorHeating);
  const applyUfhRadiatorOffset = isMixedRadiatorsUfhHeatingMode(heatingSystem);
  if (applyUfhRadiatorOffset && ufhHeatFluxByRoomId.size > 0) {
    radiatorSelectionNotes.push(
      'Смешанный режим (радиаторы + ТП): нагрузка на радиатор уменьшается на отдачу тёплого пола вверх (heatFluxUpWatts) по каждой комнате с ТП — без двойного учёта мощности.',
    );
  }

  const sortedSectional = sortRadiatorsForMatching(
    radiatorModel
      ? sectionalPool.filter((r) => r.model === radiatorModel)
      : sectionalPool,
    baseDeltaT,
    heatingDistribution,
    radiatorConnection,
  );

  if (sectionalPool.length === 0 && panelPoolRaw.length === 0) {
    logger.warn('matching.radiators.emptyCatalog', null);
    return {
      chosen: null,
      byRoom: [],
      warnings: ['В каталоге нет радиаторов.'],
      inputs: {
        supplyC,
        returnC,
        insideC,
        baseDeltaT,
        targetDeltaT: round(targetDeltaT, 1),
        ventilationReserveFactor,
        radiatorSizingAlignedWithCondensing: hasEfficientProposal,
        heatingDistribution,
        radiatorConnection,
        thermalRegimePreset: heatingSystem.thermalRegimePreset,
      },
      radiatorSelectionNotes,
    };
  }

  /** @type {Map<string, number>} */
  const maxWindowWidthByRoom = new Map();
  /** @type {Map<string, number>} */
  const maxWindowHeightByRoom = new Map();
  const envelopeElements = building?.envelopeElements ?? [];
  for (const el of envelopeElements) {
    const kind = el?.kind ?? null;
    const construction = String(el?.construction ?? '').toLowerCase();
    const isWindow = kind === 'window' || construction.includes('окно');
    if (!isWindow) continue;
    const roomId = String(el?.roomId ?? '');
    if (!roomId) continue;
    const w = el?.openingWidthMm;
    if (typeof w === 'number' && Number.isFinite(w) && w > 0) {
      const prev = maxWindowWidthByRoom.get(roomId) ?? 0;
      if (w > prev) maxWindowWidthByRoom.set(roomId, w);
    }
    const h = el?.openingHeightMm;
    if (typeof h === 'number' && Number.isFinite(h) && h > 0) {
      const prevH = maxWindowHeightByRoom.get(roomId) ?? 0;
      if (h > prevH) maxWindowHeightByRoom.set(roomId, h);
    }
  }

  const minRoomWattsForWindowWidthRule = 800;

  const byRoom = (roomsHeatLoss?.rooms ?? []).map((room) => {
    const qEnvelope = room.envelopeWatts ?? 0;
    const qDesignFull = room.designWatts ?? qEnvelope * ventilationReserveFactor;
    const mixedLoad = resolveMixedRadiatorRoomLoad({
      designWattsFull: qDesignFull,
      ufhHeatFluxUpWatts: applyUfhRadiatorOffset
        ? ufhHeatFluxByRoomId.get(room.id)
        : undefined,
    });
    const qRad = mixedLoad.qRad;

    if (mixedLoad.skipRadiator) {
      return {
        roomId: room.id,
        roomName: room.name,
        heatLossWatts: qEnvelope,
        radiatorDesignWatts: 0,
        radiatorModel: '—',
        outputPerSectionWatts: 0,
        sections: null,
        warnings: [],
        sizingNotes: mixedLoad.sizingNotes,
      };
    }

    const sized = pickRoomRadiatorSizing({
      qRad,
      sectionalPool: sortedSectional,
      panelPoolFiltered,
      baseDeltaT,
      targetDeltaT,
      radiatorConnection,
      windowOpeningWidthMm: maxWindowWidthByRoom.get(room.id) ?? null,
      openingHeightMm: maxWindowHeightByRoom.get(room.id) ?? null,
      ventilationReserveFactor,
    });

    if (!sized) {
      return {
        roomId: room.id,
        roomName: room.name,
        heatLossWatts: qEnvelope,
        radiatorDesignWatts: Math.round(qRad),
        radiatorModel: '—',
        outputPerSectionWatts: 0,
        sections: null,
        warnings: ['Не удалось подобрать радиатор из каталога.'],
        sizingNotes: mixedLoad.sizingNotes,
      };
    }

    const outputLabel =
      sized.kind === 'panel'
        ? Math.max(1, Math.round(sized.adjustedWatts))
        : Math.max(1, Math.round(sized.adjustedWatts));

    /** @type {string[]} */
    const roomWarnings = [];
    if (sized.widthOk === false && qEnvelope >= minRoomWattsForWindowWidthRule) {
      roomWarnings.push(
        `Радиатор перекрывает менее 70% ширины окна (${Math.round(
          (sized.widthCoverageRatio ?? 0) * 100,
        )}%). Рассмотрите другую длину/модель или перенос прибора.`,
      );
    }

    return {
      roomId: room.id,
      roomName: room.name,
      heatLossWatts: qEnvelope,
      radiatorDesignWatts: Math.round(qRad),
      radiatorModel: sized.radiator.model,
      outputPerSectionWatts: outputLabel,
      sections: sized.sections,
      sectionsThermalMin: sized.sectionsThermalMin ?? sized.sections,
      windowOpeningWidthMm: maxWindowWidthByRoom.get(room.id) ?? null,
      radiatorWidthMm: sized.radiatorWidthMm,
      widthCoverageRatio:
        sized.widthCoverageRatio != null
          ? Math.round(sized.widthCoverageRatio * 1000) / 1000
          : null,
      widthOk: sized.widthOk,
      warnings: roomWarnings,
      sizingNotes: [...mixedLoad.sizingNotes, ...(sized.sizingNotes ?? [])],
      priceBasis: sized.kind === 'panel' ? 'panel' : 'section',
      panelLengthMm: sized.panelLengthMm ?? undefined,
    };
  });

  const firstSized = byRoom.find((r) => r.radiatorModel && r.radiatorModel !== '—');
  const chosenRadiator =
    firstSized != null
      ? (allRadiators.find((r) => r.model === firstSized.radiatorModel) ?? null)
      : (sortedSectional[0] ?? panelPoolFiltered[0] ?? null);

  const chosen = chosenRadiator;
  const baseWatts = chosen
    ? baseDeltaT === 70
      ? chosen.outputWatts.deltaT70
      : chosen.outputWatts.deltaT50
    : 0;
  const adjustedWatts = chosen
    ? adjustOutputWatts({ baseWatts, baseDeltaT, targetDeltaT })
    : 0;
  const sectionWidthMm = chosen?.sectionWidthMm ?? chosen?.dimensions?.width ?? null;

  /** @type {string[]} */
  const warnings = [];

  const graphAutoAdjusted =
    heatingSystem
    && typeof heatingSystem === 'object'
    && /** @type {Record<string, unknown>} */ (heatingSystem)._thermalRegimeAutoAdjusted ===
      true;

  if (
    radiatorLineTier == null
    && !graphAutoAdjusted
    && hasEfficientProposal
    && supplyC >= 65
    && returnC >= 55
  ) {
    warnings.push(
      'Для извлечения КПД конденсационного котла рекомендуется более низкий график теплоносителя (например 55/45°C или тёплый пол) — при текущих supply/return расчёт радиаторов консервативен.',
    );
  }

  if (sectionWidthMm == null && maxWindowWidthByRoom.size > 0 && !panelPoolRaw.length) {
    warnings.push(
      'Невозможно проверить правило 70% ширины окна: у выбранного радиатора нет dimensions.width/sectionWidthMm.',
    );
  }
  if (sectionWidthMm != null && maxWindowWidthByRoom.size === 0) {
    warnings.push(
      'Невозможно проверить правило 70% ширины окна: в анкете не задано openingWidthMm для окон.',
    );
  }
  for (const item of byRoom) {
    for (const w of item.warnings ?? []) warnings.push(`[${item.roomName}] ${w}`);
  }

  return {
    chosen: chosen
      ? {
          model: chosen.model,
          material: chosen.material,
          volumeLitersPerSection: chosen.volumeLiters,
          baseOutputWatts: baseWatts,
          baseDeltaT,
          adjustedOutputWatts: Math.round(adjustedWatts),
          targetDeltaT: round(targetDeltaT, 1),
          sectionWidthMm: sectionWidthMm ?? undefined,
          priceBasis: chosen.priceBasis,
        }
      : null,
    byRoom,
    warnings,
    inputs: {
      supplyC,
      returnC,
      insideC,
      baseDeltaT,
      targetDeltaT: round(targetDeltaT, 1),
      ventilationReserveFactor,
      radiatorSizingAlignedWithCondensing: hasEfficientProposal,
      heatingDistribution,
      radiatorConnection,
      thermalRegimePreset: heatingSystem.thermalRegimePreset,
    },
    radiatorSelectionNotes,
  };
}
