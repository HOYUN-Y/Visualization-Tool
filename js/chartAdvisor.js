/* insight Analytics — rule-based chart recommendation (window.ChartAdvisor)
   Tableau "Show Me"-style: given the dimensions on Columns and measures on Rows,
   suggest the most appropriate chart type. Pure & deterministic. */
(function () {
  "use strict";

  const isDate = (t) => t === "datetime";
  const isCat = (t) => t === "category" || t === "string" || t === "boolean";

  // cols: [{ key, type, cardinality? }] dimensions;  measures: [{ key, agg? }]
  // opts: { hasOHLC? }  → returns { type, reason } (type null = need more fields)
  function recommend(cols, measures, opts) {
    cols = cols || []; measures = measures || []; opts = opts || {};
    const nDim = cols.length, nMeas = measures.length;
    const dim0 = cols[0] || null;
    const card = dim0 && dim0.cardinality != null ? dim0.cardinality : null;

    if (opts.hasOHLC && nDim === 0 && nMeas === 0) return { type: "candlestick", reason: "OHLC columns detected — candlestick fits price data" };

    if (nMeas === 0) return { type: null, reason: "Drop a measure on Rows to chart values" };

    // No dimension: relate measures to each other
    if (nDim === 0) {
      if (nMeas >= 3) return { type: "bubble", reason: "3 measures → bubble (X · Y · size)" };
      if (nMeas === 2) return { type: "scatter", reason: "2 measures, no dimension → scatter" };
      return { type: null, reason: "Add a dimension, or a 2nd measure for a scatter" };
    }

    // One dimension
    if (nDim === 1) {
      if (isDate(dim0.type)) return { type: nMeas >= 2 ? "line" : "line", reason: "Date dimension → line shows the trend over time" };
      if (isCat(dim0.type)) {
        if (nMeas >= 2) return { type: "bar", reason: "1 category × multiple measures → grouped bar" };
        if (card != null && card <= 6) return { type: "pie", reason: `${card} categories → pie shows composition` };
        return { type: "bar", reason: "1 category × 1 measure → bar compares values" };
      }
      // numeric dimension treated as continuous → scatter if 2nd measure else bar
      return { type: nMeas >= 2 ? "scatter" : "bar", reason: "Continuous dimension" };
    }

    // Two dimensions
    if (nDim === 2) {
      if (nMeas >= 1) return { type: "heatmap", reason: "2 dimensions × measure → heatmap" };
    }

    return { type: "bar", reason: "Default comparison" };
  }

  const api = { recommend };
  if (typeof window !== "undefined") window.ChartAdvisor = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
