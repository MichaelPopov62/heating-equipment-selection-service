/**
 * Назначение: глобальное решение типа излучателя на объект.
 * Описание: preference lock или majority по голосам Pass 1; ничья → sectional.
 */

/**
 * @typedef {'sectional' | 'panel'} EmitterKind
 */

/**
 * @typedef {object} EmitterKindVote
 * @property {string} roomId
 * @property {string} [roomName]
 * @property {EmitterKind} preferredKind
 * @property {string} reason
 */

/**
 * @typedef {object} EmitterKindDecision
 * @property {EmitterKind} resolvedEmitterKind
 * @property {{ sectional: number, panel: number }} emitterKindVotes
 * @property {string[]} emitterKindDecisionNotes
 * @property {'preference' | 'majority' | 'tie_break' | 'forced_override' | 'fallback'} decisionSource
 */

/**
 * @param {object} args
 * @param {'auto' | 'sectional' | 'panel'} args.preference
 * @param {EmitterKindVote[]} args.votes
 * @param {EmitterKind | null | undefined} [args.forcedOverride] — от primary для economy/efficient
 * @param {'sectional' | 'panel'} [args.tieBreakKind]
 * @returns {EmitterKindDecision}
 */
export function decideObjectEmitterKind({
  preference,
  votes,
  forcedOverride = null,
  tieBreakKind = 'sectional',
}) {
  /** @type {string[]} */
  const notes = [];

  if (forcedOverride === 'sectional' || forcedOverride === 'panel') {
    notes.push(
      `Тип приборов зафиксирован с основной линии подбора: ${forcedOverride} `
        + '(единый kind для economy/efficient).',
    );
    return {
      resolvedEmitterKind: forcedOverride,
      emitterKindVotes: countVotes(votes),
      emitterKindDecisionNotes: notes,
      decisionSource: 'forced_override',
    };
  }

  if (preference === 'sectional' || preference === 'panel') {
    notes.push(
      `Тип приборов задан пользователем: heatingSystem.radiatorEmitterPreference=${preference}.`,
    );
    return {
      resolvedEmitterKind: preference,
      emitterKindVotes: countVotes(votes),
      emitterKindDecisionNotes: notes,
      decisionSource: 'preference',
    };
  }

  const tallies = countVotes(votes);
  const { sectional, panel } = tallies;

  if (sectional === 0 && panel === 0) {
    notes.push(
      'Нет голосов Pass 1 (все комнаты skip / без радиаторов) — fallback sectional.',
    );
    return {
      resolvedEmitterKind: 'sectional',
      emitterKindVotes: tallies,
      emitterKindDecisionNotes: notes,
      decisionSource: 'fallback',
    };
  }

  if (sectional === panel) {
    notes.push(
      `Ничья голосов Pass 1 (sectional=${sectional}, panel=${panel}) — tie-break → ${tieBreakKind}.`,
    );
    for (const v of votes) {
      notes.push(`  · ${v.roomName ?? v.roomId}: ${v.preferredKind} — ${v.reason}`);
    }
    return {
      resolvedEmitterKind: tieBreakKind,
      emitterKindVotes: tallies,
      emitterKindDecisionNotes: notes,
      decisionSource: 'tie_break',
    };
  }

  const winner = sectional > panel ? 'sectional' : 'panel';
  notes.push(
    `Majority Pass 1: sectional=${sectional}, panel=${panel} → объект ${winner}.`,
  );
  for (const v of votes) {
    notes.push(`  · ${v.roomName ?? v.roomId}: ${v.preferredKind} — ${v.reason}`);
  }

  return {
    resolvedEmitterKind: winner,
    emitterKindVotes: tallies,
    emitterKindDecisionNotes: notes,
    decisionSource: 'majority',
  };
}

/**
 * @param {EmitterKindVote[]} votes
 * @returns {{ sectional: number, panel: number }}
 */
function countVotes(votes) {
  let sectional = 0;
  let panel = 0;
  for (const v of votes) {
    if (v.preferredKind === 'panel') panel += 1;
    else if (v.preferredKind === 'sectional') sectional += 1;
  }
  return { sectional, panel };
}
