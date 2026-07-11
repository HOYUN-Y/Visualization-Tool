/* insight Analytics — lightweight i18n dictionary (window.I18N)
   t(lang, key) → localized string; falls back to English then the key itself.
   Language preference lives in Store tweaks.lang ("ko" | "en"). */
(function () {
  "use strict";
  const dict = {
    ko: {
      // rail / modes
      data: "데이터", clean: "정제", sql: "SQL", visualize: "차트", pivot: "피벗",
      map: "지도", dashboard: "대시보드", stats: "통계", ml: "ML", docs: "문서",
      // topbar
      save: "저장", import: "가져오기", export: "내보내기", askInsight: "인사이트 질문",
      tweaks: "환경설정", themeToggle: "테마 전환", langToggle: "한국어 / English",
      // statusbar
      workspace: "작업공간", rows: "행", cols: "열",
      // chart shelves (axis-oriented)
      vizColumns: "X축 · 차원", vizRows: "Y축 · 측정값",
      vizColumnsHint: "차원을 놓으세요 (가로축 · 그룹)", vizRowsHint: "측정값을 놓으세요 (세로축 값)",
    },
    en: {
      data: "Data", clean: "Clean", sql: "SQL", visualize: "Chart", pivot: "Pivot",
      map: "Map", dashboard: "Board", stats: "Stats", ml: "ML", docs: "Docs",
      save: "Save", import: "Import", export: "Export", askInsight: "Ask Insight",
      tweaks: "Tweaks", themeToggle: "Toggle theme", langToggle: "한국어 / English",
      workspace: "workspace", rows: "rows", cols: "cols",
      vizColumns: "X-axis · Dimension", vizRows: "Y-axis · Measure",
      vizColumnsHint: "Drop dimensions (x-axis / groups)", vizRowsHint: "Drop measures (y-axis values)",
    },
  };
  function t(lang, key) {
    const d = dict[lang] || dict.en;
    return d[key] != null ? d[key] : (dict.en[key] != null ? dict.en[key] : key);
  }
  window.I18N = { dict, t, langs: ["ko", "en"] };
})();
