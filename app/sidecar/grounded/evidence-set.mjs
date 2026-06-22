// Grounded Council — Channel A foundation.
//
// Build the membership corpus the grounding floor checks claims against: the set
// of verse_ids that were actually retrieved and handed to the voices. A citation
// to a verse_id outside this set is, by definition, ungrounded.

/**
 * @param {Array<{verse_id?: number|string}>} evidence  the retrieved_evidence rows
 * @returns {{ ids: Set<number>, byId: Map<number, object> }}
 */
export function buildEvidenceSet(evidence) {
  const ids = new Set();
  const byId = new Map();
  for (const row of Array.isArray(evidence) ? evidence : []) {
    const id = Number(row?.verse_id);
    if (Number.isSafeInteger(id) && id > 0) {
      ids.add(id);
      byId.set(id, row);
    }
  }
  return { ids, byId };
}
