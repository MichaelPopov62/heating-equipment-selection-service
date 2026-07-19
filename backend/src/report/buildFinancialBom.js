/**
 * Назначение: сборка коммерческой сметы (report.commercial).
 * Описание: Оборудование из основной линии matching/hydraulics; монтаж 40% и
 * расходники 15% от суммы оборудования; смесительный узел ТП — note без цены.
 */

/** @typedef {import('../types/shared-types.js').FinancialBomLine} FinancialBomLine */
/** @typedef {import('../types/shared-types.js').CommercialBomReport} CommercialBomReport */
/** @typedef {import('../types/shared-types.js').BuildingObjectType} BuildingObjectType */
/** @typedef {import('../types/shared-types.js').FinancialBomCategoryId} FinancialBomCategoryId */

export const FINANCIAL_BOM_SCHEMA_VERSION = 1;
export const FINANCIAL_LABOR_PERCENT = 40;
export const FINANCIAL_CONSUMABLES_PERCENT = 15;
export const MIXING_NODE_SELF_ASSEMBLY_NOTE = 'сборка самостоятельно';

const CATEGORY_LABEL = /** @type {Record<FinancialBomCategoryId, string>} */ ({
  boiler_room: 'Котельная / СУ',
  radiators: 'Радиаторное отопление',
  ufh: 'Тёплый пол',
  hydraulics_heating: 'Гидравлика',
  works: 'Работы',
});

/**
 * @param {number} n
 * @returns {number}
 */
function money(n) {
  return Math.round(n * 100) / 100;
}

/**
 * @param {unknown} v
 * @returns {string}
 */
function str(v) {
  return typeof v === 'string' ? v.trim() : '';
}

/**
 * @param {unknown} obj
 * @returns {string}
 */
function readBrand(obj) {
  if (!obj || typeof obj !== 'object') return '';
  return str(/** @type {Record<string, unknown>} */ (obj).brand);
}

/**
 * @param {BuildingObjectType} objectType
 * @returns {string}
 */
function objectLabel(objectType) {
  return objectType === 'apartment' ? 'Квартира' : 'Дом';
}

/**
 * @param {BuildingObjectType} objectType
 * @param {FinancialBomCategoryId} categoryId
 * @param {string[]} [extra]
 * @returns {string[]}
 */
function scope(objectType, categoryId, extra = []) {
  return [objectLabel(objectType), CATEGORY_LABEL[categoryId], ...extra].filter(
    (s) => s.length > 0,
  );
}

/**
 * @param {Partial<FinancialBomLine> & Pick<FinancialBomLine, 'id' | 'kind' | 'objectType' | 'equipmentTypeLabel' | 'model' | 'qty' | 'qtyUnit' | 'categoryId' | 'source'>} partial
 * @returns {FinancialBomLine}
 */
function line(partial) {
  return {
    id: partial.id,
    kind: partial.kind,
    objectType: partial.objectType,
    equipmentTypeLabel: partial.equipmentTypeLabel,
    brand: partial.brand ?? '',
    model: partial.model,
    qty: partial.qty,
    qtyUnit: partial.qtyUnit,
    unitPriceUah: partial.unitPriceUah ?? null,
    lineTotalUah: partial.lineTotalUah ?? null,
    scopePath: partial.scopePath ?? scope(partial.objectType, partial.categoryId),
    categoryId: partial.categoryId,
    ...(partial.catalogId ? { catalogId: partial.catalogId } : {}),
    source: partial.source,
    ...(partial.note ? { note: partial.note } : {}),
  };
}

/**
 * @param {FinancialBomLine} l
 * @returns {string}
 */
function collapseKey(l) {
  return [
    l.kind,
    l.categoryId,
    l.catalogId ?? '',
    l.brand,
    l.model,
    l.qtyUnit,
    l.unitPriceUah == null ? 'null' : String(l.unitPriceUah),
    l.note ?? '',
  ].join('\u0001');
}

/**
 * Схлопывание одинаковых позиций: сумма qty и lineTotal.
 *
 * @param {FinancialBomLine[]} lines
 * @returns {FinancialBomLine[]}
 */
export function collapseFinancialBomLines(lines) {
  /** @type {Map<string, FinancialBomLine>} */
  const map = new Map();
  for (const raw of lines) {
    const key = collapseKey(raw);
    const prev = map.get(key);
    if (!prev) {
      map.set(key, { ...raw, scopePath: [...raw.scopePath] });
      continue;
    }
    const qty = money(prev.qty + raw.qty);
    const lineTotalUah =
      prev.lineTotalUah != null && raw.lineTotalUah != null
        ? money(prev.lineTotalUah + raw.lineTotalUah)
        : prev.lineTotalUah ?? raw.lineTotalUah;
    const sameScope =
      prev.scopePath.length === raw.scopePath.length
      && prev.scopePath.every((p, i) => p === raw.scopePath[i]);
    map.set(key, {
      ...prev,
      qty,
      lineTotalUah: lineTotalUah ?? null,
      scopePath: sameScope
        ? prev.scopePath
        : scope(prev.objectType, prev.categoryId),
    });
  }
  return [...map.values()];
}

/**
 * @param {import('../types/shared-types.js').CalcRequestBody | undefined} input
 * @returns {Map<string, { floor: number; name: string }>}
 */
function roomMetaById(input) {
  /** @type {Map<string, { floor: number; name: string }>} */
  const map = new Map();
  const rooms = input?.building?.rooms;
  if (!Array.isArray(rooms)) return map;
  for (const r of rooms) {
    if (!r || typeof r !== 'object') continue;
    const id = str(r.id);
    if (!id) continue;
    const floor =
      typeof r.floor === 'number' && Number.isFinite(r.floor) && r.floor >= 1
        ? Math.trunc(r.floor)
        : 1;
    const name = str(r.name) || id;
    map.set(id, { floor, name });
  }
  return map;
}

/**
 * @param {BuildingObjectType} objectType
 * @param {import('../types/shared-types.js').MatchingReport | undefined} matching
 * @param {FinancialBomLine[]} out
 */
function pushBoiler(objectType, matching, out) {
  const proposal = matching?.boiler?.proposal;
  if (!proposal?.model) return;
  const units = Math.max(1, Math.trunc(proposal.unitsCount) || 1);
  const total =
    typeof proposal.estimatedTotalPrice === 'number'
    && Number.isFinite(proposal.estimatedTotalPrice)
      ? money(proposal.estimatedTotalPrice)
      : null;
  const unitPrice = total != null ? money(total / units) : null;
  const brand = readBrand(matching?.boiler?.selected);
  out.push(
    line({
      id: `boiler:${proposal.model}`,
      kind: 'equipment',
      objectType,
      equipmentTypeLabel: 'Котёл',
      brand,
      model: proposal.model,
      qty: units,
      qtyUnit: 'pcs',
      unitPriceUah: unitPrice,
      lineTotalUah: total,
      scopePath: scope(objectType, 'boiler_room'),
      categoryId: 'boiler_room',
      source: 'matching.boiler.proposal',
    }),
  );
}

/**
 * @param {BuildingObjectType} objectType
 * @param {import('../types/shared-types.js').MatchingReport | undefined} matching
 * @param {FinancialBomLine[]} out
 */
function pushWaterHeaters(objectType, matching, out) {
  const wh = matching?.waterHeater;
  if (wh?.selected?.model && wh.chosenVariant) {
    const price =
      typeof wh.chosenVariant.price === 'number' && Number.isFinite(wh.chosenVariant.price)
        ? money(wh.chosenVariant.price)
        : null;
    out.push(
      line({
        id: `waterHeater:${wh.selected.model}:${wh.chosenVariant.volumeLiters ?? ''}`,
        kind: 'equipment',
        objectType,
        equipmentTypeLabel: 'Электронакопитель',
        brand: readBrand(wh.selected),
        model: wh.selected.model,
        qty: 1,
        qtyUnit: 'pcs',
        unitPriceUah: price,
        lineTotalUah: price,
        scopePath: scope(objectType, 'boiler_room'),
        categoryId: 'boiler_room',
        source: 'matching.waterHeater',
      }),
    );
  }

  const bkn = matching?.indirectWaterHeater;
  if (bkn?.selected?.model && !bkn.skippedReason) {
    const price =
      typeof bkn.selected.price === 'number' && Number.isFinite(bkn.selected.price)
        ? money(bkn.selected.price)
        : null;
    out.push(
      line({
        id: `indirectWaterHeater:${bkn.selected.model}`,
        kind: 'equipment',
        objectType,
        equipmentTypeLabel: 'Бойлер косвенного нагрева',
        brand: readBrand(bkn.selected),
        model: bkn.selected.model,
        qty: 1,
        qtyUnit: 'pcs',
        unitPriceUah: price,
        lineTotalUah: price,
        scopePath: scope(objectType, 'boiler_room'),
        categoryId: 'boiler_room',
        source: 'matching.indirectWaterHeater',
      }),
    );
  }
}

/**
 * @param {BuildingObjectType} objectType
 * @param {import('../types/shared-types.js').MatchingReport | undefined} matching
 * @param {Map<string, { floor: number; name: string }>} rooms
 * @param {FinancialBomLine[]} out
 */
function pushRadiators(objectType, matching, rooms, out) {
  const byRoom = matching?.radiators?.byRoom;
  if (!Array.isArray(byRoom) || matching?.radiators?.skippedReason) return;

  for (const row of byRoom) {
    if (!row || row.displayKind === 'none') continue;
    const model = str(row.radiatorModel);
    if (!model || model === '—') continue;
    const units = Math.max(1, Math.trunc(row.unitsCount ?? 1) || 1);
    const unitCatalog =
      typeof row.unitPriceUah === 'number' && Number.isFinite(row.unitPriceUah)
        ? money(row.unitPriceUah)
        : null;

    /** @type {number | null} */
    let applianceUnitPrice = null;
    /** @type {number | null} */
    let lineTotal = null;
    /** @type {string} */
    let modelLabel = model;

    if (row.priceBasis === 'panel') {
      applianceUnitPrice = unitCatalog;
      lineTotal = unitCatalog != null ? money(unitCatalog * units) : null;
    } else if (
      row.priceBasis === 'section'
      && typeof row.sections === 'number'
      && Number.isFinite(row.sections)
      && row.sections > 0
    ) {
      const sections = Math.trunc(row.sections);
      modelLabel = `${model}, ${sections} сек.`;
      applianceUnitPrice =
        unitCatalog != null ? money(unitCatalog * sections) : null;
      lineTotal =
        applianceUnitPrice != null ? money(applianceUnitPrice * units) : null;
    }

    const meta = rooms.get(str(row.roomId));
    const floorLabel = meta ? `Этаж ${meta.floor}` : '';
    const roomName = str(row.roomName) || meta?.name || str(row.roomId);

    out.push(
      line({
        id: `radiator:${modelLabel}:${applianceUnitPrice ?? 'x'}`,
        kind: 'equipment',
        objectType,
        equipmentTypeLabel: 'Радиатор',
        brand: '',
        model: modelLabel,
        qty: units,
        qtyUnit: 'pcs',
        unitPriceUah: applianceUnitPrice,
        lineTotalUah: lineTotal,
        scopePath: scope(objectType, 'radiators', [floorLabel, roomName]),
        categoryId: 'radiators',
        source: 'matching.radiators.byRoom',
      }),
    );
  }
}

/**
 * @param {BuildingObjectType} objectType
 * @param {import('../types/shared-types.js').MatchingReport | undefined} matching
 * @param {FinancialBomLine[]} out
 */
function pushManifolds(objectType, matching, out) {
  const m = matching?.manifolds;
  if (!m || m.ok === false) return;

  for (const floorBlock of m.underfloor ?? []) {
    const floor = floorBlock?.floor;
    const floorLabel =
      typeof floor === 'number' && Number.isFinite(floor)
        ? `Этаж ${Math.trunc(floor)}`
        : '';
    for (const unit of floorBlock?.units ?? []) {
      const sel = unit?.selected;
      if (!sel?.model) continue;
      const price =
        typeof sel.price === 'number' && Number.isFinite(sel.price)
          ? money(sel.price)
          : null;
      out.push(
        line({
          id: `manifold.ufh:${sel.model}:${sel.article ?? unit.index}`,
          kind: 'equipment',
          objectType,
          equipmentTypeLabel: 'Коллектор ТП',
          brand: readBrand(sel),
          model: sel.model,
          qty: 1,
          qtyUnit: 'pcs',
          unitPriceUah: price,
          lineTotalUah: price,
          scopePath: scope(objectType, 'ufh', [floorLabel, 'Коллектор ТП']),
          categoryId: 'ufh',
          source: 'matching.manifolds.underfloor',
        }),
      );
    }
  }

  const rad = m.radiator?.selected;
  if (rad?.model) {
    const price =
      typeof rad.price === 'number' && Number.isFinite(rad.price)
        ? money(rad.price)
        : null;
    out.push(
      line({
        id: `manifold.radiator:${rad.model}`,
        kind: 'equipment',
        objectType,
        equipmentTypeLabel: 'Коллектор радиаторов',
        brand: readBrand(rad),
        model: rad.model,
        qty: 1,
        qtyUnit: 'pcs',
        unitPriceUah: price,
        lineTotalUah: price,
        scopePath: scope(objectType, 'radiators'),
        categoryId: 'radiators',
        source: 'matching.manifolds.radiator',
      }),
    );
  }

  const bm = m.boilerManifold?.selected;
  if (bm?.model) {
    const price =
      typeof bm.price === 'number' && Number.isFinite(bm.price)
        ? money(bm.price)
        : null;
    out.push(
      line({
        id: `manifold.boiler:${bm.model}`,
        kind: 'equipment',
        objectType,
        equipmentTypeLabel: 'Котельный коллектор',
        brand: readBrand(bm),
        model: bm.model,
        qty: 1,
        qtyUnit: 'pcs',
        unitPriceUah: price,
        lineTotalUah: price,
        scopePath: scope(objectType, 'boiler_room'),
        categoryId: 'boiler_room',
        source: 'matching.manifolds.boilerManifold',
      }),
    );
  }
}

/**
 * @param {BuildingObjectType} objectType
 * @param {import('../types/shared-types.js').MatchingReport | undefined} matching
 * @param {Map<string, { floor: number; name: string }>} rooms
 * @param {FinancialBomLine[]} out
 */
function pushUniboxes(objectType, matching, rooms, out) {
  for (const row of matching?.uniboxes?.byLoop ?? []) {
    const sel = row?.selected;
    if (!sel?.model) continue;
    const price =
      typeof sel.price === 'number' && Number.isFinite(sel.price)
        ? money(sel.price)
        : null;
    const meta = rooms.get(str(row.roomId));
    const floorLabel = meta ? `Этаж ${meta.floor}` : '';
    const roomName = meta?.name || str(row.roomId);
    const catalogId = str(sel.id);
    out.push(
      line({
        id: `unibox:${catalogId || sel.model}`,
        kind: 'equipment',
        objectType,
        equipmentTypeLabel: 'Унибокс',
        brand: readBrand(sel),
        model: sel.model,
        qty: 1,
        qtyUnit: 'pcs',
        unitPriceUah: price,
        lineTotalUah: price,
        scopePath: scope(objectType, 'ufh', [floorLabel, roomName]),
        categoryId: 'ufh',
        ...(catalogId ? { catalogId } : {}),
        source: 'matching.uniboxes',
      }),
    );
  }
}

/**
 * @param {BuildingObjectType} objectType
 * @param {FinancialBomCategoryId} categoryId
 * @param {string} groupLabel
 * @param {string} source
 * @param {string} idPrefix
 * @param {import('../hydraulics/types.js').HydraulicsPipeProposalLine} pl
 * @param {FinancialBomLine[]} out
 */
function pushPipeLine(objectType, categoryId, groupLabel, source, idPrefix, pl, out) {
  if (!pl?.catalogPipeId) return;
  const lengthM =
    typeof pl.totalLengthM === 'number' && Number.isFinite(pl.totalLengthM)
      ? money(pl.totalLengthM)
      : 0;
  if (lengthM <= 0) return;
  const pricePerM =
    typeof pl.pricePerMeter === 'number' && Number.isFinite(pl.pricePerMeter)
      ? money(pl.pricePerMeter)
      : null;
  const linePrice =
    typeof pl.linePrice === 'number' && Number.isFinite(pl.linePrice)
      ? money(pl.linePrice)
      : pricePerM != null
        ? money(pricePerM * lengthM)
        : null;
  out.push(
    line({
      id: `${idPrefix}:${pl.catalogPipeId}`,
      kind: 'equipment',
      objectType,
      equipmentTypeLabel: 'Труба',
      brand: str(pl.brand),
      model: str(pl.model) || pl.catalogPipeId,
      qty: lengthM,
      qtyUnit: 'm',
      unitPriceUah: pricePerM,
      lineTotalUah: linePrice,
      scopePath: scope(objectType, categoryId, [groupLabel]),
      categoryId,
      catalogId: pl.catalogPipeId,
      source,
    }),
  );
}

/**
 * @param {BuildingObjectType} objectType
 * @param {import('../types/shared-types.js').MatchingReport | undefined} matching
 * @param {FinancialBomLine[]} out
 */
function pushHydraulics(objectType, matching, out) {
  const proposal = matching?.hydraulics?.proposal;
  if (!proposal) return;

  const groups = proposal.pipeLineGroups;
  if (Array.isArray(groups) && groups.length > 0) {
    for (const group of groups) {
      const circuitId = str(group.circuitId);
      const categoryId =
        circuitId === 'ufh' ? 'ufh' : 'hydraulics_heating';
      const groupLabel = str(group.label) || CATEGORY_LABEL[categoryId];
      for (const pl of group.pipeLines ?? []) {
        pushPipeLine(
          objectType,
          categoryId,
          groupLabel,
          'matching.hydraulics.proposal.pipeLineGroups',
          `pipe:${circuitId || 'heating'}`,
          pl,
          out,
        );
      }
    }
  } else {
    for (const pl of proposal.pipeLines ?? []) {
      pushPipeLine(
        objectType,
        'hydraulics_heating',
        CATEGORY_LABEL.hydraulics_heating,
        'matching.hydraulics.proposal.pipeLines',
        'pipe',
        pl,
        out,
      );
    }
  }

  for (const pump of proposal.pumps ?? []) {
    if (!pump) continue;
    if (pump.pumpSource === 'boiler_builtin') continue;
    const catalogId = str(pump.catalogPumpId);
    if (!catalogId && !str(pump.model)) continue;
    const price =
      typeof pump.price === 'number' && Number.isFinite(pump.price)
        ? money(pump.price)
        : null;
    out.push(
      line({
        id: `pump:${catalogId || pump.model}`,
        kind: 'equipment',
        objectType,
        equipmentTypeLabel: 'Насос',
        brand: str(pump.brand),
        model: str(pump.model) || catalogId,
        qty: 1,
        qtyUnit: 'pcs',
        unitPriceUah: price,
        lineTotalUah: price,
        scopePath: scope(objectType, 'boiler_room', [str(pump.zoneLabel)]),
        categoryId: 'boiler_room',
        ...(catalogId ? { catalogId } : {}),
        source: 'matching.hydraulics.proposal.pumps',
      }),
    );
  }
}

/**
 * @param {BuildingObjectType} objectType
 * @param {{ isMixingNodeRequired?: boolean } | null | undefined} ufh
 * @param {FinancialBomLine[]} out
 */
function pushMixingNodeNote(objectType, ufh, out) {
  if (!ufh || ufh.isMixingNodeRequired !== true) return;
  out.push(
    line({
      id: 'ufh:mixingNode:self_assembly',
      kind: 'note',
      objectType,
      equipmentTypeLabel: 'Смесительный узел ТП',
      brand: '',
      model: MIXING_NODE_SELF_ASSEMBLY_NOTE,
      qty: 1,
      qtyUnit: 'lot',
      unitPriceUah: null,
      lineTotalUah: null,
      scopePath: scope(objectType, 'ufh'),
      categoryId: 'ufh',
      source: 'calculations.underfloorHeating.mixingNode',
      note: MIXING_NODE_SELF_ASSEMBLY_NOTE,
    }),
  );
}

/**
 * @param {BuildingObjectType} objectType
 * @param {number} equipmentTotalUah
 * @param {FinancialBomLine[]} out
 */
function pushLaborAndConsumables(objectType, equipmentTotalUah, out) {
  if (!(equipmentTotalUah > 0)) return;

  const laborTotal = money((equipmentTotalUah * FINANCIAL_LABOR_PERCENT) / 100);
  const consumablesTotal = money(
    (equipmentTotalUah * FINANCIAL_CONSUMABLES_PERCENT) / 100,
  );

  out.push(
    line({
      id: 'works:labor',
      kind: 'labor',
      objectType,
      equipmentTypeLabel: 'Монтажные работы',
      brand: '',
      model: `${FINANCIAL_LABOR_PERCENT}% от стоимости оборудования`,
      qty: 1,
      qtyUnit: 'lot',
      unitPriceUah: laborTotal,
      lineTotalUah: laborTotal,
      scopePath: scope(objectType, 'works', ['Монтажные работы']),
      categoryId: 'works',
      source: 'commercial.rates.labor',
    }),
  );

  out.push(
    line({
      id: 'works:consumables',
      kind: 'consumable',
      objectType,
      equipmentTypeLabel: 'Расходные материалы',
      brand: '',
      model: `${FINANCIAL_CONSUMABLES_PERCENT}% от стоимости оборудования`,
      qty: 1,
      qtyUnit: 'lot',
      unitPriceUah: consumablesTotal,
      lineTotalUah: consumablesTotal,
      scopePath: scope(objectType, 'works', ['Расходные материалы']),
      categoryId: 'works',
      source: 'commercial.rates.consumables',
    }),
  );
}

/**
 * Собирает report.commercial из matching + UFH после гидравлики.
 *
 * @param {object} args
 * @param {import('../types/shared-types.js').CalcRequestBody} args.input
 * @param {import('../types/shared-types.js').MatchingReport} args.matching
 * @param {{ isMixingNodeRequired?: boolean } | null | undefined} [args.underfloorHeating]
 * @returns {CommercialBomReport}
 */
export function buildFinancialBom({ input, matching, underfloorHeating }) {
  const objectType =
    input?.building?.objectMeta?.objectType === 'apartment'
      ? 'apartment'
      : 'house';

  const rooms = roomMetaById(input);
  /** @type {FinancialBomLine[]} */
  const raw = [];

  pushBoiler(objectType, matching, raw);
  pushWaterHeaters(objectType, matching, raw);
  pushRadiators(objectType, matching, rooms, raw);
  pushManifolds(objectType, matching, raw);
  pushUniboxes(objectType, matching, rooms, raw);
  pushHydraulics(objectType, matching, raw);
  pushMixingNodeNote(objectType, underfloorHeating, raw);

  const collapsed = collapseFinancialBomLines(
    raw.filter((l) => l.kind === 'equipment' || l.kind === 'note'),
  );

  let equipmentTotalUah = 0;
  let equipmentQtyPcs = 0;
  for (const l of collapsed) {
    if (l.kind !== 'equipment') continue;
    if (l.lineTotalUah != null && Number.isFinite(l.lineTotalUah)) {
      equipmentTotalUah = money(equipmentTotalUah + l.lineTotalUah);
    }
    if (l.qtyUnit === 'pcs') {
      equipmentQtyPcs = money(equipmentQtyPcs + l.qty);
    }
  }

  /** @type {FinancialBomLine[]} */
  const withWorks = [...collapsed];
  pushLaborAndConsumables(objectType, equipmentTotalUah, withWorks);

  const laborLine = withWorks.find((l) => l.kind === 'labor');
  const consumableLine = withWorks.find((l) => l.kind === 'consumable');
  const laborTotalUah = laborLine?.lineTotalUah ?? 0;
  const consumablesTotalUah = consumableLine?.lineTotalUah ?? 0;

  return {
    schemaVersion: FINANCIAL_BOM_SCHEMA_VERSION,
    currency: 'UAH',
    lines: withWorks,
    totals: {
      equipmentQtyPcs,
      equipmentTotalUah,
      laborTotalUah,
      consumablesTotalUah,
      grandTotalUah: money(equipmentTotalUah + laborTotalUah + consumablesTotalUah),
    },
    rates: {
      laborPercentOfEquipment: FINANCIAL_LABOR_PERCENT,
      consumablesPercentOfEquipment: FINANCIAL_CONSUMABLES_PERCENT,
    },
  };
}
