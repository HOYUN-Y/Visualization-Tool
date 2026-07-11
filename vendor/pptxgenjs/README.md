# PptxGenJS (native PowerPoint export)

The **Export → PowerPoint (.pptx)** feature emits a *native, editable* PowerPoint
chart (PowerPoint's "Edit Data" opens the embedded worksheet). It needs the
PptxGenJS browser bundle vendored **here**:

```
vendor/pptxgenjs/pptxgen.bundle.js
```

Now vendored & committed (mirrors the SheetJS pattern):

- Version: `3.12.0`
- `pptxgen.bundle.js` SHA-256: `cd078ca9e91c6f9e061ee0a3c310d6ff157c3a71b1dea7f40fd53818017266ff`
- License: MIT · exposes `window.PptxGenJS` (bundles JSZip)

If the file is ever missing, the PPTX menu item shows an install message; every
other export (PNG / SVG / clipboard) works without it.

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
