# CHANGELOG

All notable changes to insight Analytics Workbench are documented here.

---

## [Unreleased] — Phase 2 (진행 중)

### Planned (아직 미구현)
- SQL JOIN/window 및 DuckDB-WASM 전환
- Auto Chart Recommendation
- PCA + Biplot + Scree Plot
- Logistic Regression, Decision Tree, Naive Bayes, ROC/AUC, Precision-Recall Curve, Cross Validation
- SPC Control Charts (X-Bar/R/S/P/C/U), Process Capability (Cp/Cpk/Pp/Ppk)
- Moving Average, Exponential Smoothing, Seasonal Decomposition, ACF/PACF

### Documentation
- 현재 코드 기준으로 기능 현황 동기화: 차트 20종, 기본 데이터셋 7종, Map 3개 탭, Import/Export 지원 범위
- 이미 구현된 Confusion Matrix, 클래스별 Precision/Recall/F1, OLS Feature Importance, Dashboard Cross Filtering을 예정 목록에서 분리
- README 브랜드 자산 및 Brand Spec 링크를 현재 파일 경로로 수정

### Added — Core v2 Milestone 1 (기능 브랜치)
- IndexedDB `insight-workbench`에 다중 프로젝트, 데이터셋, 마지막 프로젝트 설정 저장
- Store 변경 후 1초 debounce 자동저장과 `visibilitychange` flush
- 프로젝트 생성·열기·이름 변경·복제·삭제 및 `Saved / Saving / Unsaved / Error` 상태 표시
- schema version 1 portable JSON 백업·복원, 미래 schema 명시적 거부, 동일 ID import 복제
- Store hydration과 데이터셋 등록·삭제 API 중앙화, 복원된 최대 `__rid` 이후 행 ID 연속성 보장
- Node 기본 테스트 러너 기반 persistence/schema 회귀 테스트 추가

### Added — Core v2 Milestone 2 (기능 브랜치)
- SheetJS CE 0.20.3 standalone build를 로컬 vendoring하고 Apache-2.0 라이선스와 SHA-256 기록
- CSV/TSV/JSON/XLSX 공통 `window.ImportEngine`과 결정적 타입 추론 추가
- CSV 선행 0 코드 보존, 멀티라인/escaped quote, JSON 키 합집합, XLSX 날짜 셀 처리
- Workbook 시트 범위·행/열 수·첫 20행 Preview, 복수 시트 선택, 컬럼별 타입 override UI
- TopBar와 Data Explorer Drop 영역을 동일 Import 흐름으로 통합하고 완료 후 프로젝트 즉시 저장
- Node import 회귀 테스트와 no-build 브라우저 `tests/runner.html` 추가

### Added — Core v2 Milestone 3 (기능 브랜치, 밤샘 자율)
- 순수 결정적 `window.DataOps` — Union/Join 엔진 (부수효과 없음, 타임스탬프는 호출부 주입)
- Union: 컬럼 key 합집합, 타입 충돌 `boolean→integer→float→string` 승격, 없는 값 null, 선택적 `__source` 컬럼
- Join: Inner/Left/Right/Full, 복수 키 복합 매칭, null 키 미매칭, 숫자·날짜·문자 정규화 비교, 우측 중복 컬럼 리네임, many-to-many 폭증 감지
- 결과는 lineage(`op/sourceIds/joinType/keyPairs/createdAt`) 포함 새 데이터셋으로 materialize
- Combine datasets 모달(Data explorer 진입), 실시간 Preview + 폭증 경고, `registerDataset`+`saveNow` 연동
- Node 9/9 회귀 테스트, `tests/runner.html` DataOps 케이스 추가

### Added — Core v2 Milestone 4 (기능 브랜치, 밤샘 자율)
- 순수 결정적 `window.PivotEngine` — Rows × Columns 크로스탭 집계 엔진
- 복수 Values와 개별 집계(sum/avg/count/countd/min/max/median), 범주·범위 필터
- 빈 셀 안전 처리(sum/count 0, 그 외 null), Grand Total은 원본 행에서 재계산(avg/median 정확)
- `toDataset` 평탄화 → registerable 데이터셋(옵션 Grand Total 행) + lineage
- Pivot rail 모드: 필드 드래그 shelf(Rows/Columns/Values), 크로스탭 테이블, Save & open in Chart
- Node 8/8 회귀 테스트, `tests/runner.html` Pivot 케이스 추가

### Added — Core v2 Milestone 5 (기능 브랜치, 밤샘 자율)
- 안전한 `window.KPIFormula` — eval/new Function 없는 재귀하강 파서+평가기
- 문법: `SUM/AVG/COUNT(*)/COUNTD/MIN/MAX/MEDIAN(field)` + `+ - * / ( )` + 숫자 리터럴
- 임의 코드·미지 함수·미지 필드·0 나눗셈 거부(→ `—`), `compute()`는 `{value,error}` 반환
- 위젯 Inspector(우측 패널, 선택 위젯 편집): 공통 제목·크기, KPI(라벨·집계|수식 토글·형식·단위·소수), Chart(타입·차원·측정·집계·색상·Top N), Table(차원·측정·집계·행 제한), Text(평문)
- KPI 위젯이 `spec.formula`를 Cross Filtering 이후 행 기준으로 계산
- Text 위젯 `dangerouslySetInnerHTML` 제거 → 평문 렌더, 기존 `spec.html`은 태그 제거해 `spec.text`로 마이그레이션
- Node 7/7 회귀 테스트, `tests/runner.html` KPI 케이스 추가

### Changed
- Rail에 **Pivot** 모드 추가(Chart 다음). Dashboard 위젯의 Chart Top N·Table 행 제한을 Inspector에서 조절 가능

### Added — 분석 엔진 UI 배선 (`feat/analytics`)
- **ML 모드 확장:** 기존 회귀/k-NN/KMeans에 **Logistic Regression + ROC/AUC**, **PCA**(Scree+로딩표), **DBSCAN**, **계층군집(Ward)** 추가. Task 선택기를 7종 그리드로 개편, task별 target/split/k/K/eps·minPts 컨트롤, 5k행 초과 O(n²) 경고.
- **Stats 모드 확장:** **Normal Q-Q**(왜도·첨도·Jarque-Bera + 정규성 판정), **Time Series**(원계열+MA+EMA 라인 + ACF 막대, datetime 자동 정렬), **SPC 관리도**(I-MR 개별값 관리도 + CL/UCL/LCL + 관리이탈점 강조) 추가.
- 언어 토글(한/영)과 Chart 모드 축 라벨(X축·차원 / Y축·측정값) 반영.

### Added — 언어 전환
- TopBar에 한국어/English 토글(테마 토글 옆). Rail 모드명·Import/Export·Ask Insight 등 UI 라벨 전환, `<html lang>` 반영.

### Added — 분석 심화 & Show Me (Batch G)
- **Auto Chart Recommendation** (`window.ChartAdvisor`) — Tableau "Show Me"식 규칙 기반 추천(날짜→line, 2측정→scatter, 3→bubble, 범주→bar, 저카디널리티→pie, 2차원→heatmap, OHLC→candlestick). Chart 모드에 원클릭 추천 배너. (Node 8)
- **Time Series**: PACF 막대 추가(ACF와 나란히).
- **SPC**: 선택적 LSL/USL 입력 → 공정능력 **Cp/Cpk/Pp/Ppk** 카드(1.33/1.0 임계 색상).
- **Logistic**: ROC 외 **Precision-Recall 곡선 + AP** 추가.

### Changed
- StatusBar·SQL 배지의 가짜 "DuckDB" 표기를 실제 "in-browser JS/SQL"로 정정 (IMPLEMENTATION_PLAN §9).

### Fixed
- **차트 전체가 빈 화면으로 렌더되던 문제 수정** — `charts.jsx`의 `resolveVar`가 `oklch()` 색을 canvas로만 변환하던 탓에, canvas가 oklch를 지원하지 않는 브라우저에서 모든 색이 검정(rgb(0,0,0))으로 폴백 → 다크 배경에서 차트가 보이지 않음. oklch→sRGB 변환을 JS(Ottosson 행렬)로 직접 수행하도록 개선하여 canvas 색공간 지원과 무관하게 정상 색 반환. Chart/Dashboard/Map/Stats 등 ECharts 전반에 적용.

### Security
- Dashboard Text 위젯의 임의 HTML 주입 경로(`dangerouslySetInnerHTML`) 제거

### Added — Phase 2 분석 엔진 (기능 브랜치 `feat/analytics`, 밤샘 자율)
> 모두 순수·결정적 window.* 라이브러리로 로드됨. Stats/ML 모드 UI 배선은 후속.
- `window.PCA` — 표준화 공분산 + Jacobi 고유분해, Scree/Biplot (Node 11)
- `window.Logistic` — 경사하강 로지스틱 회귀, ROC/AUC·PR 곡선·지표 (Node 7)
- `window.TimeSeries` — MA/WMA/EMA, Holt 이중지수, diff, ACF/PACF, rolling std (Node 17)
- `window.DistFit` — normInv/normCdf, QQ-정규, 정규 적합, Jarque-Bera, 히스토그램 (Node 10)
- `window.SPC` — I-MR·X-bar/R·X-bar/S·p·c·u 관리도, Cp/Cpk/Pp/Ppk, Pareto (Node 7)
- `window.Clustering` — DBSCAN + 병합형 계층군집(single/complete/average/ward), O(n²) ~5k행 (Node 4)
- 전체 Node 테스트 90/90 통과, `tests/runner.html` 8개 분석 케이스 추가

---

## [1.9.0] — 2026-06-19 — 데이터 직접 편집 (JMP/Excel 스타일)

> Data 모드 그리드에서 임포트한 데이터를 직접 편집. 모든 편집은 기존 **비파괴 스텝 파이프라인**에 기록되어 undo/redo·스텝 로그·원본 보존이 그대로 적용된다.

### Added

#### 데이터 편집 엔진 (`js/store.jsx`)
- **숨김 행 ID `__rid`**: 모든 원본 행에 단조 증가 정수 ID를 지연 태깅(`getDataset` 길목 — 빌드인/CSV/SQL 전부 커버). `columns`에 미포함되어 그리드에 표시되지 않으며, 정렬·필터·페이징·파이프라인 재배열과 무관하게 행을 안정적으로 지목.
- `applySteps` 신규 op 5종:
  - `set_cell` — 셀 값 변경 (`__rid` 지목, 열 타입에 맞춰 형변환)
  - `drop_rows` — 행 삭제 (단일/다중, `__rid` 배열)
  - `add_row` — 새 행 추가 (새 `__rid` 부여)
  - `add_col` — 빈/기본값 열 추가 (삽입 위치 `at` 지원)
  - `reorder_cols` — 열 순서 재배치 (key 순서 배열)
- store 액션 `editCell·deleteRows·addRow·addColumn·reorderCols` (전부 `addStep` 래퍼 → undo/redo 자동)

#### 편집 가능 그리드 (`js/grid.jsx` · `js/dataMode.jsx` · `css/grid.css`)
- **Edit 토글** (Data 툴바): 평소 읽기전용, 토글 시 편집 모드 + Undo/Redo 버튼·편집 카운터
- **셀 인라인 편집**: 더블클릭 → 입력 → Enter/blur 커밋, Esc 취소
- **헤더**: 더블클릭 rename, 컨텍스트 메뉴 확장(Rename / Change type / Insert left·right / Delete column), **드래그앤드롭 열 순서 변경**
- **행 거터**: 클릭 다중선택, hover × 삭제, Del 키 일괄 삭제
- **하단 바**: Add row · Add column · 선택 행 Delete/Clear
- `DataGrid`는 `editable` prop으로 게이팅 — Clean/SQL 사용처는 영향 없음(읽기전용 유지)
- `edit`/`trash` 아이콘 추가 (`js/icons.jsx`)

#### Clean 모드 통합 (`js/cleanMode.jsx`)
- Data 모드 편집 이력이 Clean 모드 **PIPELINE 로그**에 라벨·아이콘으로 표시 (`stepLabel`/`OP_ICON`에 5종 추가)

### Fixed
- **`__rid` 누출 방지**: 전체 행 `JSON.stringify` 기반 중복 제거/카운트(`store.jsx` drop_duplicates, `cleanMode.jsx` dup 카드)에서 `__rid` 제외 — 미수정 시 모든 행이 고유로 판정되어 중복 탐지가 무력화되는 문제 해결
- **AIDrawer 견고성**: 편집으로 생긴 `null` `txn_date`·빈 행에 `buildInsights`가 크래시하던 버그 수정 (null 가드 + try/catch + null district 그룹 제외). AIDrawer는 항상 마운트되어 seoul 데이터 인사이트를 계산하므로, 빈 행 추가 시 앱 전체가 다운되던 문제
- CSV export 시 `__rid` 누출 방어 (`js/charts.jsx`)

### Technical Notes
- 모든 편집은 `state.clean[id].steps`에 기록 → 단일 비파괴 파이프라인으로 정리/편집 일원화
- `index.html` 캐시 버전 `?v=170` → `?v=175` (CSS 링크에도 버전 쿼리 추가)

---

## [1.8.0] — 2026-06-07 — 브랜드 아이덴티티 정립 (Brand Spec v1.0)

### Changed

#### 워드마크 소문자화 (전 파일)
- `INSIGHT Analytics` → `insight Analytics` — 소문자 워드마크로 전환
  - `in` (tx-hi) + `sight` (Heritage Orange `#E8611A`) + ` Analytics` (tx-faint `#6E6E86`, 0.62em)
  - 로딩 화면(`index.html` `.nl-name`), TopBar(`js/shell.jsx`), 문서 topbar-brand 모두 반영

#### 로고 시스템 (`docs/logo.svg` · `css/app.css`)
- `docs/logo.svg`: 폰트 → IBM Plex Sans, Analytics 크기 16px → 20px(0.62em), 색상 → `#6E6E86`
- `css/app.css`: `.logo-an` — `font-size: 0.62em` (비율 기준), `color: var(--tx-faint)` (스펙 정정)
- `css/tokens.css`: 헤더 주석 `NØDE` → `insight Analytics`, Heritage Orange oklch 값 명시

#### 로고 마크업 분리 (`js/shell.jsx`)
- TopBar 로고: `.logo-in` / `.logo-sight { color:var(--accent) }` / `.logo-an` 세 span 구조
- `text-transform: uppercase` 제거

### Added

#### Brand Spec 문서 (`docs/insight_Analytics_Brand_Spec_standalone.html`)
- 브랜드 스펙 단독 실행 HTML 파일 추가 (외부 의존 없음, v1.0 · 2026-06)
- 워드마크 3종(표준/컴팩트/단색), 로고마크, 브랜드 컬러, 타이포그래피, 제품군 관계, 복사용 CSS 토큰 포함

#### 브랜드 섹션 전면 갱신 (README · docs)
- `README.md`: 워드마크 HTML 스니펫, Heritage Orange 컬러표, 타이포그래피표, 제품군표 추가
- `docs/index.html`: 워드마크 4열 표(토큰/실제값), 컬러표(Heritage Orange/Hi/Soft/Hub Blue), 제품군표, HTML 코드 예시 추가
- `docs/user-guide.html`: 동일 구조로 사용자 관점 재작성, Analytics 색상 `tx-lo` → `tx-faint` 정정

### Technical Notes
- **Heritage Orange**: `#E8611A` / `oklch(0.70 0.17 47)` — 기본 accent · `sight` 강조색
- **형제 제품**: insight Data hub — Hub Blue `#3F74E8` / `oklch(0.62 0.15 250)` (참조용)
- **Analytics 크기**: 워드마크 기준 0.62em — 이전 구현(0.5em) 대비 스펙 준수
- `index.html` 스크립트 태그 전체에 `?v=170` 캐시 버스팅 쿼리 추가 (v1.7.0 포함 사항)

---

## [1.7.0] — 2026-06-07 — Clean 모드 전처리 강화 (Phase 2 첫 번째 배치)

### Added

#### Clean 모드 — 인코딩 (store.jsx · cleanMode.jsx)
- **Label Encode** (`label_encode`): 문자열 컬럼 → 정수(0,1,2…) 새 컬럼(`_enc`) 추가. 고유값 알파벳 정렬 후 인덱스 부여.
- **Dummy Encode** (`dummy_encode`): One-Hot 인코딩 — 고유값마다 `col_값` 0/1 정수 컬럼 추가. 고유값 20개 초과 시 사전 경고.
- **Drop Column** (`drop_col`): columns 배열 + 모든 row에서 컬럼 완전 삭제.

#### Clean 모드 — 수치 변환 (store.jsx · cleanMode.jsx)
- **Standardize** (`standardize`): Z-Score 표준화 — (x−μ)/σ, 4자리 반올림, 제자리 변환.
- **Normalize** (`normalize`): Min-Max 정규화 — (x−min)/(max−min), 0~1 범위, 제자리 변환.
- **Log Transform** (`log_transform`): log1p(x), x > −1 조건 검사 후 적용.
- **Rank Transform** (`rank_transform`): 오름차순 순위값(1..n) 제자리 변환, 정수 타입으로 변경.
- **Winsorize** (`winsorize`): 상하 p% 분위수 클리핑 (기본 p=5, UI에서 1–49 조정 가능).
- **Binning** (`binning`): 등폭 N구간 → `col_bin` 범주 컬럼 추가 (기본 5개, UI에서 2–50 조정).

#### Clean 모드 — Formula Column (store.jsx · cleanMode.jsx)
- **Formula** (`formula`): JS 수식으로 파생 컬럼 생성.
  - `new Function("row", "Math", expr)` — `row` 객체로 모든 컬럼 값 접근, `Math.*` 함수 사용 가능.
  - 수식 오류 시 해당 셀 `null` 처리 (전체 파이프라인 중단 없음).
  - 결과 타입 자동 감지 → integer / float / string 컬럼 메타 생성.

#### index.html
- 전체 JS/JSX 스크립트 태그에 `?v=170` 캐시 버스팅 쿼리 추가 (개발 환경 브라우저 캐시 문제 해결).

### Changed
- `stepLabel()` / `OP_ICON`: 신규 10개 op 모두 한국어 레이블 + 아이콘 등록.
- `CleanPanel` destructure: `rows` 추가 (Dummy Encode 고카디널리티 경고에 현재 정제 행 기준 사용).

---

## [1.6.0] — 2026-06-07 — Map 강화 + Export/Import

### Added

#### Export / Import
- **Export 드롭다운** (`js/shell.jsx`): 차트 PNG (`echarts.getDataURL`, pixelRatio:2) + 현재 데이터 CSV 내보내기
- **Import 모달** (`js/shell.jsx`): CSV / TSV / JSON 파일 드래그앤드롭 또는 클릭 업로드. 헤더 자동 파싱, 숫자 컬럼 자동 감지, `window.NODE.datasets`에 주입.

#### Map 모드 — World · GDP 탭
- ECharts v4 CDN (`echarts@4.9.0/map/json/world.json`)으로 world GeoJSON 로드
- 30개국 choropleth: GDP(명목) / Per Capita / Population / Growth 4개 메트릭
- 우측 패널: 국가별 순위 바차트

#### Map 모드 — Korea · 행정구역 탭
- Highcharts map-collection CDN (`@highcharts/map-collection@2.0.1`) 한국 GeoJSON 로드
  - properties.name 영문 → 한국어 리맵 후 `echarts.registerMap("korea_prov")`
- **시도 뷰**: 17개 시도 choropleth (인구/인구밀도/면적/GRDP), 시도 클릭 → 시군구 드릴다운
- **시군구 뷰**: 84개 주요 시군구 버블 오버레이. 시도 필터 드롭다운.
  - `wgs84ToHCKorea(lon, lat)` 함수: WGS84 → UTM Zone 52N → Highcharts 투영좌표 변환 (Highcharts GeoJSON이 UTM52N 좌표계 사용 — WGS84 아님)
- 우측 패널: 시도/시군구 인구 순위 바차트 + 권역별 인구 집계

#### Map 모드 — 내 데이터 모드 (Korea 탭)
- `detectGeoColumns()`: 활성 데이터셋 컬럼명 패턴 매칭으로 위도/경도 컬럼 자동 감지
  - 위도 패턴: `lat / latitude / 위도 / y / y_coord`
  - 경도 패턴: `lon / lng / longitude / 경도 / x / x_coord`
- 감지 시 탭에 **✦** 배지 표시, 드롭다운에 자동 입력
- 위도·경도·값·라벨 4개 컬럼 선택 드롭다운
- 한국 영역(위도 33–39°, 경도 124–132°) 외 좌표 자동 필터링
- 50개 이하 포인트 시 라벨 자동 표시

### Fixed
- Map 탭 전환 시 "Rendered more hooks than during previous render" 오류 → `<Workspace key={tab}>` 강제 리마운트로 해결
- World GeoJSON 404 (ECharts v5에 map 번들 없음) → `echarts@4.9.0` CDN으로 교체

### Technical Notes
- 한국 시도 GeoJSON CDN 조사 결과: `southkorea-maps` (GitHub raw → 404, jsDelivr → 403), `echarts@4` south-korea → 404. **Highcharts map-collection npm CDN만 정상 동작**.
- Highcharts GeoJSON 좌표계: UTM Zone 52N 투영좌표 (`hc-transform`: scale=0.001170, jsonres=15.5, xoffset=114507.65, yoffset=4275280.76)

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
- 20종 ECharts 차트 타입 (Basic 8 / Advanced 8 / Financial 3 / Special 1)
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
