// PA GA Guide — data loader.
// Fetches four JSON files in parallel and merges them into the globals
// the screens already read (window.LEGISLATORS, BILLS_BY_SPONSOR,
// COMMITTEES, LAST_SYNC, FEDERAL_IDS, COOPS). Two files (legislators,
// bills) are scraped weekly by the Sunday GitHub Action; the third is
// the hand-maintained REA editorial overlay; the fourth is the hand-
// maintained PA federal delegation.
//
// Exposes window.dataReady — a Promise that resolves once the globals
// are populated. App() awaits it before rendering.

window.dataReady = (async () => {
  const base = './data/';
  const [legs, bills, overlay, federal] = await Promise.all([
    fetch(base + 'legislators.json').then(r => r.json()),
    fetch(base + 'bills.json').then(r => r.json()),
    fetch(base + 'rea-overlay.json').then(r => r.json()).catch(() => ({
      coopTerritory: {}, starred: [], reaBills: [],
    })),
    fetch(base + 'federal-delegation.json').then(r => r.json()).catch(() => ({
      members: [],
    })),
  ]);

  const reaSet     = new Set(overlay.reaBills || []);
  const starredSet = new Set(overlay.starred || []);
  const coopMap    = overlay.coopTerritory || {};

  // Derive the user-facing detail string from the structured coops array.
  // Single source of truth: rea-overlay.json's coops list.
  const detailFor = (coops) => {
    if (!coops || coops.length === 0) return undefined;
    const noun = coops.length === 1 ? 'co-op' : 'co-ops';
    return `${coops.length} ${noun} · ${coops.join(', ')}`;
  };

  const mergeMember = (m) => {
    const entry = coopMap[m.id];
    const coops = entry && Array.isArray(entry.coops) ? entry.coops : [];
    return {
      ...m,
      coops,
      coop: coops.length > 0,
      coopDetail: detailFor(coops),
      starred: starredSet.has(m.id),
    };
  };

  const stateMembers = (legs.members || []).map(mergeMember);
  const federalMembers = (federal.members || []).map(mergeMember);

  // State first, then federal. Screens that want a strict separation
  // can use FEDERAL_IDS; everything else just walks LEGISLATORS as before.
  window.LEGISLATORS = [...stateMembers, ...federalMembers];
  window.FEDERAL_IDS = new Set(federalMembers.map(m => m.id));

  // Canonical set of every co-op named anywhere in the overlay.
  // Used by ByCoopScreen to render the master list.
  const coopSet = new Set();
  for (const entry of Object.values(coopMap)) {
    for (const name of (entry.coops || [])) coopSet.add(name);
  }
  window.COOPS = Array.from(coopSet).sort();

  // Bills: tag rea relevance from overlay's reaBills list.
  const billsBySponsor = {};
  for (const [sponsorId, list] of Object.entries(bills.billsBySponsor || {})) {
    billsBySponsor[sponsorId] = list.map(b => ({ ...b, rea: reaSet.has(b.num) }));
  }
  window.BILLS_BY_SPONSOR = billsBySponsor;

  window.COMMITTEES = bills.committees || [];
  // TRACKED_BILLS is still resolved by the scraper from rea-overlay.json's
  // reaBills list. The Tracked tab was removed from the UI, but the data is
  // kept so per-member profiles can still flag "REA-relevant" bills.
  window.TRACKED_BILLS = (bills.trackedBills || []).map(b => ({ ...b, rea: true }));
  window.LAST_SYNC  = legs.lastSync;
})();
