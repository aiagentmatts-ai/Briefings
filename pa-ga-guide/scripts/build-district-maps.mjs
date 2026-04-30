// build-district-maps.mjs
// Generates one PNG per district under ../data/maps/, used by atoms.jsx →
// districtMapUrl(m). Run on demand, NOT in CI — district lines change at most
// every 10 years (decennial redistricting).
//
//   Output paths:
//     ../data/maps/state/H/<district>.png    (203 PA House districts)
//     ../data/maps/state/S/<district>.png    (50 PA Senate districts)
//     ../data/maps/fed/<id>.png              (17 PA U.S. House districts)
//     ../data/maps/fed/state-pa.png          (statewide outline, used for both U.S. Senators)
//
// Inputs (download once into scripts/data/):
//   1. PA state House districts shapefile  — palegis.us / PA Dept of State GIS
//   2. PA state Senate districts shapefile — palegis.us / PA Dept of State GIS
//   3. PA congressional districts          — U.S. Census TIGER/Line CD119
//   4. PA county boundaries                — U.S. Census TIGER/Line COUNTY (for the underlay)
//
// Pipeline:
//   1. Load each shapefile → GeoJSON via shapefile package
//   2. For each district feature, render an SVG with:
//        - light-gray PA outline
//        - thin county lines (underlay)
//        - district shape filled in --fed-blue (#1f3a68) at 0.85 alpha
//   3. Convert SVG → PNG via @resvg/resvg-js (no native deps)
//   4. Write to the paths above
//
// Dependencies (one-time install):
//   npm install --no-save shapefile d3-geo @resvg/resvg-js
//
// Run:
//   node scripts/build-district-maps.mjs
//
// If the maps directory is empty, the app gracefully falls back to a
// labeled placeholder (see DistrictMap in screens-1.jsx) — so it's safe to
// ship the app before this script has been run.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Lazy imports so the script can print a helpful error without these installed.
async function loadDeps() {
  try {
    const shapefile = await import('shapefile');
    const d3 = await import('d3-geo');
    const { Resvg } = await import('@resvg/resvg-js');
    return { shapefile, d3, Resvg };
  } catch (err) {
    console.error('\nMissing dependencies. Install with:');
    console.error('  npm install --no-save shapefile d3-geo @resvg/resvg-js\n');
    throw err;
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MAPS = path.join(ROOT, 'data', 'maps');
const SHAPES = path.join(__dirname, 'data');     // shapefiles live here

const SIZE = { w: 320, h: 200 };
const COLOR = {
  bg:       '#f6f2ea',
  paOutline:'#a8a094',
  county:   'rgba(168,160,148,0.35)',
  district: '#1f3a68',
  districtA: 0.85,
};

async function loadGeoJSON(shp, dbf) {
  const { shapefile } = await loadDeps();
  const features = [];
  const src = await shapefile.open(shp, dbf);
  while (true) {
    const r = await src.read();
    if (r.done) break;
    features.push(r.value);
  }
  return { type: 'FeatureCollection', features };
}

function renderSvg({ d3 }, paFC, countiesFC, districtFeature) {
  const projection = d3.geoMercator().fitSize([SIZE.w, SIZE.h], paFC);
  const pathGen = d3.geoPath(projection);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE.w}" height="${SIZE.h}" viewBox="0 0 ${SIZE.w} ${SIZE.h}">
    <rect width="${SIZE.w}" height="${SIZE.h}" fill="${COLOR.bg}"/>
    ${countiesFC.features.map(f => `<path d="${pathGen(f)}" fill="none" stroke="${COLOR.county}" stroke-width="0.5"/>`).join('')}
    <path d="${pathGen(paFC)}" fill="none" stroke="${COLOR.paOutline}" stroke-width="1"/>
    <path d="${pathGen(districtFeature)}" fill="${COLOR.district}" fill-opacity="${COLOR.districtA}" stroke="${COLOR.district}" stroke-width="1"/>
  </svg>`;
}

async function svgToPng({ Resvg }, svg) {
  const r = new Resvg(svg);
  return r.render().asPng();
}

async function main() {
  const deps = await loadDeps();
  await mkdir(path.join(MAPS, 'state', 'H'), { recursive: true });
  await mkdir(path.join(MAPS, 'state', 'S'), { recursive: true });
  await mkdir(path.join(MAPS, 'fed'),         { recursive: true });

  // TODO: wire up real shapefile paths once downloaded into scripts/data/.
  // The shapefile filenames below are placeholders; rename to match your downloads.
  const paFC       = await loadGeoJSON(path.join(SHAPES, 'pa-state.shp'),     path.join(SHAPES, 'pa-state.dbf'));
  const countiesFC = await loadGeoJSON(path.join(SHAPES, 'pa-counties.shp'),  path.join(SHAPES, 'pa-counties.dbf'));
  const houseFC    = await loadGeoJSON(path.join(SHAPES, 'pa-house.shp'),     path.join(SHAPES, 'pa-house.dbf'));
  const senateFC   = await loadGeoJSON(path.join(SHAPES, 'pa-senate.shp'),    path.join(SHAPES, 'pa-senate.dbf'));
  const congressFC = await loadGeoJSON(path.join(SHAPES, 'pa-congress.shp'),  path.join(SHAPES, 'pa-congress.dbf'));

  const all = [
    ...houseFC.features.map(f => ({ chamber: 'H', district: f.properties.DISTRICT_N || f.properties.DISTRICT, feature: f, scope: 'state' })),
    ...senateFC.features.map(f => ({ chamber: 'S', district: f.properties.DISTRICT_N || f.properties.DISTRICT, feature: f, scope: 'state' })),
    ...congressFC.features.map(f => ({ chamber: 'UH', district: f.properties.CD119FP || f.properties.DISTRICT, feature: f, scope: 'fed' })),
  ];

  for (const d of all) {
    const svg = renderSvg(deps, paFC, countiesFC, d.feature);
    const png = await svgToPng(deps, svg);
    const out = d.scope === 'state'
      ? path.join(MAPS, 'state', d.chamber, `${d.district}.png`)
      : path.join(MAPS, 'fed', `pa-${d.district}.png`);
    await writeFile(out, png);
    console.log('wrote', path.relative(ROOT, out));
  }

  // Statewide outline reused for both U.S. Senators.
  const senSvg = renderSvg(deps, paFC, countiesFC, paFC);
  await writeFile(path.join(MAPS, 'fed', 'state-pa.png'), await svgToPng(deps, senSvg));
  console.log('wrote', path.relative(ROOT, path.join(MAPS, 'fed', 'state-pa.png')));
}

main().catch(err => { console.error(err); process.exit(1); });
