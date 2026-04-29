// PA GA Guide — data loader.
// Fetches three JSON files in parallel and merges them into the globals
// the screens already read (window.LEGISLATORS, BILLS_BY_SPONSOR,
// COMMITTEES, LAST_SYNC). The two scraped files are written by the
// Sunday GitHub Action (Phase 2); the third is a hand-maintained REA
// editorial overlay you commit yourself.
//
// Exposes window.dataReady — a Promise that resolves once the globals
// are populated. App() awaits it before rendering.

window.dataReady = (async () => {
  const base = './data/';
  const [legs, bills, overlay] = await Promise.all([
    fetch(base + 'legislators.json').then(r => r.json()),
    fetch(base + 'bills.json').then(r => r.json()),
    fetch(base + 'rea-overlay.json').then(r => r.json()).catch(() => ({
      coopTerritory: {}, starred: [], reaBills: [],
    })),
  ]);

  const reaSet     = new Set(overlay.reaBills || []);
  const starredSet = new Set(overlay.starred || []);
  const coopMap    = overlay.coopTerritory || {};

  // Members: graft co-op + starred fields from overlay.
  window.LEGISLATORS = (legs.members || []).map(m => {
    const c = coopMap[m.id];
    return {
      ...m,
      coop: !!c,
      coopDetail: c ? c.detail : undefined,
      starred: starredSet.has(m.id),
    };
  });

  // Bills: tag rea relevance from overlay's reaBills list.
  const billsBySponsor = {};
  for (const [sponsorId, list] of Object.entries(bills.billsBySponsor || {})) {
    billsBySponsor[sponsorId] = list.map(b => ({ ...b, rea: reaSet.has(b.num) }));
  }
  window.BILLS_BY_SPONSOR = billsBySponsor;

  window.COMMITTEES = bills.committees || [];
  // Bills explicitly tracked via rea-overlay.json's reaBills; resolved by the
  // scraper into full detail. Tag each as REA-relevant by definition.
  window.TRACKED_BILLS = (bills.trackedBills || []).map(b => ({ ...b, rea: true }));
  window.LAST_SYNC  = legs.lastSync;
})();
