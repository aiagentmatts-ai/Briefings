# District maps

Generated PNGs live here. Empty by default — the app falls back to a labeled placeholder when a file is missing.

```
state/H/<district>.png   PA House districts (203)
state/S/<district>.png   PA Senate districts (50)
fed/<id>.png             PA U.S. House districts (17)
fed/state-pa.png         Statewide outline (used for both U.S. Senators)
```

## Generate

1. Download four shapefiles into `pa-ga-guide/scripts/data/`:
   - PA state House (`pa-house.{shp,dbf}`) — palegis.us GIS
   - PA state Senate (`pa-senate.{shp,dbf}`) — palegis.us GIS
   - PA congressional (`pa-congress.{shp,dbf}`) — Census TIGER/Line CD119
   - PA counties (`pa-counties.{shp,dbf}`) — Census TIGER/Line COUNTY
   - PA outline (`pa-state.{shp,dbf}`) — Census TIGER/Line STATE filtered to PA
2. `npm install --no-save shapefile d3-geo @resvg/resvg-js`
3. `node pa-ga-guide/scripts/build-district-maps.mjs`

Re-run only when district lines change (decennial redistricting).
