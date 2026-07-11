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
      tweaks: "설정", themeToggle: "테마 전환", langToggle: "한국어 / English",
      // statusbar
      workspace: "작업공간", rows: "행", cols: "열",
      // chart shelves (axis-oriented)
      vizColumns: "X축 · 차원", vizRows: "Y축 · 측정값",
      vizColumnsHint: "차원을 놓으세요 (가로축 · 그룹)", vizRowsHint: "측정값을 놓으세요 (세로축 값)",
      // data grid — toolbar / search / column menu / filter
      gSearchAll: "모든 컬럼 검색…", gAddRow: "행 추가", gAddCol: "열 추가",
      gEditHint: "셀을 클릭해 수정 · 헤더 ⋯ 로 열 편집", gClickEdit: "클릭해서 수정",
      gSortAsc: "오름차순 정렬", gSortDesc: "내림차순 정렬", gFilterDots: "필터…", gFilterWord: "필터",
      gFreeze: "열 고정", gUnfreeze: "고정 해제", gHide: "열 숨기기", gRename: "이름 변경…",
      gChangeType: "타입 변경", gInsertLeft: "왼쪽에 삽입", gInsertRight: "오른쪽에 삽입", gDeleteCol: "열 삭제",
      gColumns: "컬럼", gToggleCols: "컬럼 표시/숨김", gMin: "최소", gMax: "최대",
      gClear: "지우기", gApply: "적용", gAll: "전체", gNone: "없음",
      tText: "텍스트", tInteger: "정수", tDecimal: "소수", tCategory: "범주", tDate: "날짜", tBool: "참/거짓",
      // data mode — center tabs
      dPreview: "미리보기", dProfiling: "프로파일링", dAutoProfiled: "자동 프로파일", dPreviewHint: "미리보기 · 타입 추론 · 시트 선택",
      dEdit: "편집", dEditing: "편집 중", dUndo: "실행 취소", dRedo: "다시 실행", dEdits: "개 편집",
      dSearchDs: "데이터셋·필드 검색…", dDatasets: "데이터셋", dCombine: "결합", dUnionJoin: "Union / Join 데이터셋",
      dConnect: "연결", dDropFiles: "CSV · TSV · JSON · XLSX 끌어놓기",
      // pivot — shelves / empty state
      pRows: "행", pColumns: "열", pValues: "값", pDropDim: "차원 필드를 놓으세요", pDropVal: "측정값/차원 필드를 놓으세요",
      pBuildTitle: "피벗 만들기", pBuildDesc: "오른쪽 패널에서 행·열·값에 필드를 끌어다 놓으세요. 값에는 최소 하나의 필드가 필요합니다.",
      pNote: "필드는 좌측 Data Explorer에서 드래그하세요. 합계·집계는 원본 행에서 재계산됩니다.",
      pTitle: "피벗 테이블", pSaveOpen: "저장 후 차트에서 열기",
    },
    en: {
      data: "Data", clean: "Clean", sql: "SQL", visualize: "Chart", pivot: "Pivot",
      map: "Map", dashboard: "Board", stats: "Stats", ml: "ML", docs: "Docs",
      save: "Save", import: "Import", export: "Export", askInsight: "Ask Insight",
      tweaks: "Setting", themeToggle: "Toggle theme", langToggle: "한국어 / English",
      workspace: "workspace", rows: "rows", cols: "cols",
      vizColumns: "X-axis · Dimension", vizRows: "Y-axis · Measure",
      vizColumnsHint: "Drop dimensions (x-axis / groups)", vizRowsHint: "Drop measures (y-axis values)",
      gSearchAll: "Search all columns…", gAddRow: "Add row", gAddCol: "Add column",
      gEditHint: "Click a cell to edit · header ⋯ for column ops", gClickEdit: "Click to edit",
      gSortAsc: "Sort ascending", gSortDesc: "Sort descending", gFilterDots: "Filter…", gFilterWord: "Filter",
      gFreeze: "Freeze column", gUnfreeze: "Unfreeze", gHide: "Hide column", gRename: "Rename…",
      gChangeType: "Change type", gInsertLeft: "Insert left", gInsertRight: "Insert right", gDeleteCol: "Delete column",
      gColumns: "Columns", gToggleCols: "Toggle columns", gMin: "min", gMax: "max",
      gClear: "Clear", gApply: "Apply", gAll: "All", gNone: "None",
      tText: "Text", tInteger: "Integer", tDecimal: "Decimal", tCategory: "Category", tDate: "Date", tBool: "True/False",
      dPreview: "Data Preview", dProfiling: "Profiling", dAutoProfiled: "auto-profiled", dPreviewHint: "Preview · infer types · select sheets",
      dEdit: "Edit", dEditing: "Editing", dUndo: "Undo", dRedo: "Redo", dEdits: "edits",
      dSearchDs: "Search datasets & fields…", dDatasets: "Datasets", dCombine: "Combine", dUnionJoin: "Union / Join datasets",
      dConnect: "Connect", dDropFiles: "Drop CSV · TSV · JSON · XLSX",
      pRows: "Rows", pColumns: "Columns", pValues: "Values", pDropDim: "Drop dimension fields", pDropVal: "Drop measure/dimension fields",
      pBuildTitle: "Build a pivot", pBuildDesc: "Drag fields into Rows, Columns, and Values in the right panel. Values need at least one field.",
      pNote: "Drag fields from the Data Explorer on the left. Totals and aggregates are recomputed from source rows.",
      pTitle: "Pivot Table", pSaveOpen: "Save & open in Chart",
    },
  };
  function t(lang, key) {
    const d = dict[lang] || dict.en;
    return d[key] != null ? d[key] : (dict.en[key] != null ? dict.en[key] : key);
  }
  window.I18N = { dict, t, langs: ["ko", "en"] };
})();
