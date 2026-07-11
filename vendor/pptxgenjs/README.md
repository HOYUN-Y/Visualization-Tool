# PptxGenJS (native PowerPoint export)

The **Export → PowerPoint (.pptx)** feature emits a *native, editable* PowerPoint
chart (PowerPoint's "Edit Data" opens the embedded worksheet). It needs the
PptxGenJS browser bundle vendored **here**:

```
vendor/pptxgenjs/pptxgen.bundle.js
```

It is **not committed** (external code — add it yourself). Until the file is
present, the PPTX menu item shows an install message; every other export
(PNG / SVG / clipboard) works without it.

## How to get the file

Option A — download the standalone bundle (browser build, exposes `window.PptxGenJS`):

```bash
# from the repo root
curl -L -o vendor/pptxgenjs/pptxgen.bundle.js \
  https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js
```

Option B — npm:

```bash
npm pack pptxgenjs@3.12.0
# extract package/dist/pptxgen.bundle.js → vendor/pptxgenjs/pptxgen.bundle.js
```

Then hard-refresh the app. `index.html` already references it; the SHA-256 and
version should be recorded here once pinned (mirror the SheetJS vendor pattern).

- Version target: `3.12.0`
- Upstream: https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js
- License: MIT
- Exposes: `window.PptxGenJS`

## Supported chart types (native, editable)

bar / hbar / line / area / pie. Other chart types (candlestick, boxplot,
violin, treemap, sankey, heatmap, radar, scatter, bubble, …) have no native
PowerPoint equivalent — export those as PNG/SVG image instead.
