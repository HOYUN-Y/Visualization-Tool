# CHANGELOG

All notable changes to NØDE Analytics Workbench are documented here.

---

## [Unreleased] — Phase 2 (예정)
- CSV/XLSX 파일 업로드 및 파싱
- localStorage 영속성
- Chart Recommendation Engine
- Export (PNG/PDF/CSV)

---

## [1.5.0] — 2026-06-06 — JMP Statistical Enhancement

### Added
- **`js/insightEngine.js`** (신규 모듈): 규칙 기반 자동 해석 엔진
  - `window.IE.profileDataset(id)` — 데이터셋 형상, 결측, IQR 이상치, 왜도 플래그, 최강 상관계수 자동 탐지 (string[] 반환)
  - `window.IE.summarizeCorrelation({ cols, matrix })` — 최강 상관쌍 및 |r|>0.5 쌍 수 요약
  - `window.IE.summarizeRegression({ r2, adj, terms, target, pF })` — R² 품질 등급 + 유의 예측변수 목록
  - `window.IE.summarizeClustering({ K, sizes, inertia })` — 군집 균형도 평가
  - `window.IE.summarizeClassification({ acc, classes, cm, k })` — 정확도 + 클래스별 P/R 요약
  - `window.IE.recommendNextStep({ lastTest, lastResult })` — 현재 분석 맥락 기반 다음 분석 제안 (`{ icon, text }`)

- **`js/statsMath.js`**: 왜도(skewness) / 초과 첨도(excess kurtosis) 함수
  - `window.SM.skewness(a)` — 표본 왜도 (n/((n-1)(n-2)) 보정, n<3이면 null)
  - `window.SM.kurtosis(a)` — Fisher 초과 첨도 (n<4이면 null)

- **Stats 모드 — Distribution 탭** (`js/statsMode.jsx`):
  - 컬럼 선택 → ECharts 히스토그램 (카테고리 축, 구간 레이블)
  - 수평 박스플롯 (`layout: "horizontal"`) + IQR 이상치 scatter overlay
  - n, Missing, Mean, Median, Std, Min, Max, Q1/Q3, IQR, Skewness, Kurtosis, Outliers 8카드
  - IE Interpretation 패널 + Next Step 패널

- **Stats 모드 — Analysis Builder 탭** (`js/statsMode.jsx`):
  - Target 컬럼 + Input 컬럼 다중 선택 UI
  - 컬럼 타입 자동 감지 → 회귀(OLS) / 일원 ANOVA / 카이제곱 중 자동 선택
  - Summary / Visual / Statistical Results / Next Step 4개 섹션으로 결과 표시

- **Stats 모드 — 모든 탭**: `InterpretationPanel` + `NextStepPanel` 컴포넌트 추가 (분석 완료 후 자동 표시)
- **Stats 모드 — Descriptive 탭**: 기술통계 테이블에 Skewness / Kurtosis 컬럼 추가 (|sk|>1.5 경고 색상)

- **ML 모드 — 분류(Classification)** (`js/mlMode.jsx`):
  - `perClass` 배열: 클래스별 `{ tp, fp, fn, prec, rec, f1 }` 계산
  - `macroF1` 산출
  - 클래스별 Precision / Recall / F1 / TP / FP / FN 테이블 (F1 컬러 코딩)

- **ML 모드 — 군집(KMeans)** (`js/mlMode.jsx`):
  - `clusterMeans` 산출: 군집별 특성 평균 (원본 스케일 역정규화)
  - Feature × Cluster 특성 표 표시

- **ML 모드 — Model Comparison History** (`js/mlMode.jsx`):
  - `window.NODE.mlHistory` — 렌더 간 영속 배열 (Store 외부)
  - 최근 10개 실행 비교 테이블 (#/Task/Target/Metric/Score)
  - Train 시 `window.NODE.lastAnalysisResult` 갱신

- **Ask Insight 드로어** (`js/aiDrawer.jsx`):
  - `IE.profileDataset(activeId)` 렌더마다 자동 실행 → "Dataset Profile" 섹션 표시
  - `window.NODE.lastAnalysisResult` 존재 시 "Last Analysis Result" 섹션 표시
  - 6번째 Suggest 칩: "Summarize last analysis"
  - NL 키워드 확장: `corr/regress/distribut/ml/machine/learn` 등 Stats/ML 탐색 인텐트

- **CSS — `css/stats.css`** (추가):
  - `.interpretation-panel`, `.ip-head`, `.ip-body` — 파란색 해석 패널
  - `.nextstep-panel`, `.ns-head`, `.ns-body` — 초록색 다음 단계 패널
  - `.result-section`, `.rs-label` — 섹션 레이블
  - `.analysis-builder`, `.ab-section`, `.ab-summary` — Analysis Builder 레이아웃

- **CSS — `css/ml.css`** (추가):
  - `.clf-metrics` — 클래스별 메트릭 + 군집 표 래퍼
  - `.model-comparison-table` — 밀집 비교 테이블 (우정렬 숫자 셀, hover 배경)

- **`index.html`**: `<script src="js/insightEngine.js"></script>` 추가 (statsMath.js 이후, icons.jsx 이전)

### Changed
- `window.SM` exports 확장: 기존 `{ gammp, gammq, betai, tP, fP, chiP, matInverse, gammln }` → `skewness, kurtosis` 추가
- Stats 모드 TESTS 배열: 6개 → 8개 (`distribution`, `builder` 탭 추가)
- ML 모드 Train 버튼: 훈련 완료 후 자동으로 `window.NODE.mlHistory` 및 `lastAnalysisResult` 갱신

---

## [1.0.0] — 2026-06-06 — Phase 1 Initial Release

### Added
- 전체 8개 모드 UI 프레임워크 (Data / Clean / SQL / Chart / Map / Board / Stats / ML)
- 서울 아파트 실거래가 시뮬레이션 데이터셋 3종 (`seoul_txns` 503행, `monthly_index` 42행, `district_stats` 12행)
- KOSPI 금융 데이터셋 (`KOSPI_Stock` 320행 OHLCV)
- 21종 ECharts 차트 타입 (Basic 9 / Advanced 8 / Financial 3 / Special 1)
- 다크/라이트 테마 + Tweaks 패널 (layout/tone/density/accent/sidebar)
- DataGrid: 검색, 정렬, 필터, 컬럼 고정, 페이지네이션
- Cleaning Studio: Missing/Duplicate/Outlier 원클릭 처리 + Undo/Redo 파이프라인
- Local SQL Engine: SELECT/WHERE/GROUP BY/집계/ORDER/LIMIT
- Correlation / T-Test / ANOVA / Chi-Square / Regression 통계 검정
- In-browser AutoML: OLS 회귀, k-NN 분류, KMeans 군집
- Seoul 25구 Choropleth (GeoJSON) + Bubble Map 폴백
- Drag/Resize 위젯 대시보드 + Cross Filtering
- Ask Insight AI 드로어 (규칙 기반 인사이트 + NL→차트 라우팅)
- 로딩 화면 (의존성 상태 체크 + 애니메이션 링)
- 개발자 매뉴얼 (`docs/index.html`, 자기 완결형 HTML)
