// Slot-specific overrides belong to the selected move and reset on replacement.
function setCalcMoveSlot(side, slot, moveId) {
  if (!Array.isArray(side.moves)) side.moves = [];
  side.moves[slot] = moveId || '';
  for (const [key, empty] of Object.entries({ moveBpOverrides: null, moveTypeOverrides: null, moveCriticalOverrides: false, moveHitCounts: null })) {
    if (!Array.isArray(side[key])) side[key] = [empty, empty, empty, empty];
    side[key][slot] = empty;
  }
}

function replaceCalcMoves(side, moves = []) {
  const count = Math.min(4, moves.length);
  for (let slot = 0; slot < 4; slot++) setCalcMoveSlot(side, slot, moves[slot]);
  side.moves.length = count;
}

export { setCalcMoveSlot, replaceCalcMoves };
