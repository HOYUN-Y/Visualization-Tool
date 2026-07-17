// Shared fixture for the F3 viz-extraction verification: the 20 chart type ids and a ctx builder that
// supplies enough dimensions/measures/financial rows to exercise each one. Kept as a helper so the
// snapshot probe and the permanent smoke spec build identical inputs.
export const ALL_TYPES = [
  'bar', 'hbar', 'line', 'area', 'pie', 'scatter', 'treemap', 'heatmap',
  'bubble', 'waterfall', 'funnel', 'radar', 'boxplot', 'violin', 'sankey', 'sunburst',
  'candlestick', 'ohlcvol', 'cumreturn', 'facet',
];

// Stringified and rebuilt inside the page (via Function) so both specs use one definition.
export function buildCtx(type) {
  // Two categorical dimensions and three measures — covers 1d/2d and 1m/2m/3m needs.
  var dimA = { key: 'da', label: 'da', type: 'category', role: 'dimension' };
  var dimB = { key: 'db', label: 'db', type: 'category', role: 'dimension' };
  var mkMeasure = function (k) { return { key: k, label: k, type: 'float', role: 'measure', agg: 'sum', id: k + '_sum' }; };
  var m1 = mkMeasure('m1'), m2 = mkMeasure('m2'), m3 = mkMeasure('m3');

  var rows = [];
  for (var i = 0; i < 40; i++) {
    var d = new Date(2024, 0, 1 + i);
    var iso = d.toISOString().slice(0, 10);
    var base = 100 + i;
    rows.push({
      da: 'A' + (i % 4), db: 'B' + (i % 3),
      m1: (i % 7) + 1, m2: (i % 5) + 2, m3: (i % 9) + 1,
      // financial columns for candlestick/ohlcvol/cumreturn
      date: iso, open: base, close: base + ((i % 3) - 1) * 2, low: base - 3, high: base + 4, volume: 1000 + i * 10,
    });
  }
  var cols, measures, color;
  if (type === 'scatter') { cols = []; measures = [m1, m2]; color = null; }
  else if (type === 'bubble') { cols = []; measures = [m1, m2, m3]; color = null; }
  else if (type === 'radar') { cols = [dimA]; measures = [m1, m2]; color = null; }
  else if (type === 'heatmap' || type === 'sankey' || type === 'sunburst' || type === 'facet') { cols = [dimA, dimB]; measures = [m1]; color = (type === 'facet') ? dimB : null; }
  else { cols = [dimA]; measures = [m1]; color = null; }

  return { rows: rows, cols: cols, measures: measures, color: color, sortDesc: false, topN: 0 };
}
