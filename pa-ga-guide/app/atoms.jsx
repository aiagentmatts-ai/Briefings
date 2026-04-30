// PA GA Guide — icons, formatters, small UI atoms.

function Icon({ name, size = 20, color = 'currentColor', stroke = 1.8 }) {
  const props = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (name) {
    case 'search':   return <svg {...props}><circle cx="11" cy="11" r="7"/><path d="M16 16l5 5"/></svg>;
    case 'back':     return <svg {...props}><path d="M15 5l-7 7 7 7"/></svg>;
    case 'close':    return <svg {...props}><path d="M6 6l12 12M18 6L6 18"/></svg>;
    case 'star':     return <svg {...props}><path d="M12 3l2.7 6.4 6.9.6-5.2 4.6 1.6 6.8L12 17.7 5.9 21.4l1.6-6.8L2.4 10l6.9-.6z"/></svg>;
    case 'star-fill':return <svg {...props} fill={color} stroke="none"><path d="M12 3l2.7 6.4 6.9.6-5.2 4.6 1.6 6.8L12 17.7 5.9 21.4l1.6-6.8L2.4 10l6.9-.6z"/></svg>;
    case 'pin':      return <svg {...props}><path d="M12 21s7-7 7-12a7 7 0 10-14 0c0 5 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>;
    case 'phone':    return <svg {...props}><path d="M5 4h4l2 5-2 1c1 3 4 6 7 7l1-2 5 2v4c-9 0-17-8-17-17z"/></svg>;
    case 'mail':     return <svg {...props}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>;
    case 'ext':      return <svg {...props}><path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M19 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1h5"/></svg>;
    case 'people':   return <svg {...props}><circle cx="9" cy="9" r="3"/><circle cx="17" cy="10" r="2.2"/><path d="M3 19c1-3 4-5 6-5s5 2 6 5"/><path d="M14 17c1-2 2-3 3-3s2 .5 3 2"/></svg>;
    case 'cmt':      return <svg {...props}><rect x="4" y="5" width="16" height="14" rx="1"/><path d="M8 10h8M8 14h6"/></svg>;
    case 'bill':     return <svg {...props}><path d="M7 4h8l4 4v12H7z"/><path d="M15 4v4h4"/><path d="M9 12h6M9 15h6"/></svg>;
    case 'bookmark': return <svg {...props}><path d="M6 3h12v18l-6-4-6 4z"/></svg>;
    case 'gear':     return <svg {...props}><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>;
    case 'chev-r':   return <svg {...props}><path d="M9 6l6 6-6 6"/></svg>;
    case 'chev-d':   return <svg {...props}><path d="M6 9l6 6 6-6"/></svg>;
    case 'check':    return <svg {...props}><path d="M5 12l5 5L20 7"/></svg>;
    case 'filter':   return <svg {...props}><path d="M3 5h18M6 12h12M10 19h4"/></svg>;
    case 'refresh':  return <svg {...props}><path d="M21 12a9 9 0 11-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>;
    case 'circle':   return <svg {...props}><circle cx="12" cy="12" r="9"/></svg>;
    case 'flag':     return <svg {...props}><path d="M5 21V4"/><path d="M5 4h13l-2 4 2 4H5"/></svg>;
    case 'bolt':     return <svg {...props}><path d="M13 3L4 14h7l-1 7 9-11h-7z"/></svg>;
    case 'map':      return <svg {...props}><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v16M15 6v16"/></svg>;
    default: return null;
  }
}

// Format helpers — extended to cover federal chambers (US = U.S. Senate, UH = U.S. House).
function partyLabel(p) { return p === 'R' ? 'R' : p === 'D' ? 'D' : p; }
function chamberLabel(c) {
  if (c === 'S')  return 'Senate';
  if (c === 'H')  return 'House';
  if (c === 'US') return 'U.S. Senate';
  if (c === 'UH') return 'U.S. House';
  return c;
}
function chamberPrefix(c) {
  if (c === 'S' || c === 'US') return 'Sen.';
  if (c === 'H' || c === 'UH') return 'Rep.';
  return '';
}
function isFederal(c) { return c === 'US' || c === 'UH'; }
function districtLabel(l) {
  if (l.chamber === 'US') return 'PA · Statewide';
  if (l.chamber === 'UH') return `PA-${l.district}`;
  return `${l.chamber === 'S' ? 'SD' : 'HD'}-${l.district}`;
}
function buildingShort(b) {
  if (!b) return '';
  if (/main capitol/i.test(b))      return 'MCB';
  if (/irvis/i.test(b))             return 'IRO';
  if (/north office/i.test(b))      return 'NORTH';
  if (/east wing/i.test(b))         return 'EW';
  if (/cannon/i.test(b))            return 'CHOB';
  if (/longworth/i.test(b))         return 'LHOB';
  if (/rayburn/i.test(b))           return 'RHOB';
  if (/russell senate/i.test(b))    return 'RSOB';
  if (/dirksen/i.test(b))           return 'DSOB';
  if (/hart/i.test(b))              return 'HSOB';
  return b;
}
function officeShort(o) {
  if (!o || !o.room) return '';
  return `${o.room} ${buildingShort(o.building)}`;
}
function lastName(name) { const parts = name.split(' '); return parts[parts.length - 1]; }
function firstName(name) { return name.split(' ')[0]; }

// Status dot color helper
function statusClass(kind) {
  if (kind === 'go')   return 'go';
  if (kind === 'stop') return 'stop';
  return '';
}

// fmt date "2026-04-01T..." → "Apr 1"
function fmtDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric' });
  } catch { return iso; }
}

// open palegis.us link for a bill (mock/external)
function palegisUrl(num) {
  const m = num.match(/^([A-Z]+)\s*(\d+)/);
  if (!m) return 'https://www.palegis.us';
  const type = m[1].toLowerCase();
  const n = m[2];
  return `https://www.palegis.us/legislation/bills/${type}/${n}`;
}

// District map URL convention. Returns ./data/maps/<scope>/<chamber>/<district>.png
// — generated by scripts/build-district-maps.mjs (run on demand). Senators
// (state or federal) and the federal House use distinct paths so missing
// files fall back gracefully via <img onError>.
function districtMapUrl(m) {
  if (!m) return null;
  if (m.chamber === 'US') return './data/maps/fed/state-pa.png';
  if (m.chamber === 'UH') return `./data/maps/fed/${m.id}.png`;
  return `./data/maps/state/${m.chamber}/${m.district}.png`;
}

Object.assign(window, {
  Icon,
  partyLabel, chamberLabel, chamberPrefix, districtLabel, isFederal,
  buildingShort, officeShort, lastName, firstName, statusClass, fmtDate, palegisUrl,
  districtMapUrl,
});
