# INSIGHT Analytics Workbench — Work Log

> 이 파일은 세션 간 작업 연속성을 위한 로그입니다.  
> 변경사항 발생 시 세션 단위로 업데이트합니다.
> `.claude`의 과거 자동 푸시 훅은 이전 절대 경로를 참조하므로 현재 환경의 공식 작업 절차로 간주하지 않습니다.

> **계획 기준:** [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md)
> **사용법:** 새 세션이나 컨텍스트 압축 후에는 이 문서의 `CURRENT STATE`와 `NEXT EXACT ACTION`을 먼저 확인합니다.

---

## CURRENT STATE

| 항목 | 현재 값 |
|---|---|
| Plan version | `core-v2-plan-v1` |
| Current milestone | Planning baseline |
| Status | Approved — planning baseline 테스트 완료, 병합 대기 |
| Branch | `docs/core-v2-planning` |
| Base commit | `2953a63` |
| Last checkpoint commit | `fa88243` — planning baseline 검증 종료 |
| Working tree | 승인 대기 — 애플리케이션 기능 코드 변경 없음 |
| Last verified | 2026-07-10 — HTTP 200, 로컬 자산 33개, diff check, JSON/HTML parse 통과 |
| Updated at | 2026-07-10 |

## NEXT EXACT ACTION

1. `docs/core-v2-planning`을 `main`에 `--no-ff` 병합한다.
2. 병합 커밋에 annotated tag `checkpoint/core-v2-plan`을 생성한다.
3. 최신 `main`에서 `feat/project-persistence` 브랜치를 생성한다.
4. Milestone 1 구현 전 WORKLOG 상태판을 갱신한다.

## ACTIVE CHECKPOINT

- **목표:** Core Product v2의 계획과 현재 진행 상태가 모델·사람·세션에 관계없이 복원되도록 기준 문서를 고정한다.
- **포함:** 현재 구현 상태 문서, 승인 계획, WORKLOG 상태판, 자동 push 비활성화.
- **제외:** 애플리케이션 기능 코드 변경.
- **완료:** 현재 소스 기준 문서 최신화 커밋 `1e81b9e`.
- **남음:** `main` 병합과 checkpoint tag 생성.
- **롤백:** branch `docs/core-v2-planning` 삭제 시 main `2953a63`에는 영향 없음.

## DECISIONS / BLOCKERS

확정 결정:

- 하이브리드 구현: 현재 앱에서 Core v2 완성 후 프로덕션 전환은 별도 진행.
- Core v2 범위: 저장, XLSX, Union/Join, Pivot, Dashboard/KPI.
- IndexedDB + JSON, 다중 프로젝트.
- SheetJS는 로컬 vendoring.
- XLSX는 시트 선택 모달과 복수 시트 Import.
- 병합 결과는 새 데이터셋으로 materialize.
- 기능별 브랜치와 사용자 승인 게이트.
- `WORKLOG.md`는 현재 상태, `IMPLEMENTATION_PLAN.md`는 승인 계획의 기준 문서.

현재 blocker: 없음.

테스트 제한: 현재 세션에 인앱 브라우저 인스턴스가 없어 클릭 기반 UI 스모크 테스트는 실행하지 못했다. 대신 로컬 서버 HTTP 200 응답, 진입 HTML, 로컬 자산 33개 참조를 확인했다. planning branch는 애플리케이션 코드를 변경하지 않는다.

## CHECKPOINT LEDGER

| Milestone | Branch | Commit/Tag | Tests | Status |
|---|---|---|---|---|
| Source/document audit | `docs/core-v2-planning` | `1e81b9e` | diff check, HTML parse | Complete |
| Core v2 plan baseline | `docs/core-v2-planning` | `fa88243` + approval HEAD | HTTP/assets, links, diff check, JSON/HTML parse | Approved |
| Project persistence | `feat/project-persistence` | pending | IndexedDB + JSON round trip | Not started |
| XLSX Import | `feat/xlsx-import` | pending | format/type fixtures | Not started |
| Union/Join | `feat/data-combine` | pending | join matrix | Not started |
| Pivot Builder | `feat/pivot-builder` | pending | aggregation/totals | Not started |
| Dashboard/KPI | `feat/dashboard-builder` | pending | formula/cross-filter/restore | Not started |
| Core v2 release | `release/core-product-v2` | pending | end-to-end regression | Not started |

---

## 🚀 Quick Start (다른 세션에서 반드시 실행)

```bash
# 1. 프로젝트 디렉토리로 이동
cd "/Users/hoyun/Documents/GitHub/Visualization-Tool"

# 2. 로컬 서버 실행 (포트 8742)
python3 -m http.server 8742

# 3. 브라우저에서 열기
open http://localhost:8742
```

> ⚠️ **핵심 주의사항**
> - 빌드 단계 없음 — 순수 HTML + in-browser Babel (Next.js/Vite 아님)
> - 포트 8742 충돌 시: `kill $(lsof -ti :8742)` 후 재실행
> - CDN 의존성: React 18.3.1, ECharts 5.5.1, Babel 7.29.0, IBM Plex 폰트
> - 서울 지도는 GeoJSON 미접근 시 버블맵으로 폴백하며, Korea/World choropleth는 원격 GeoJSON이 필요
> - 파일 로드 순서가 중요 (`index.html` 내 `<script>` 순서 변경 금지)
> - 크로스파일 공유는 `window.*` 전역 변수로만 가능 (`import/export` 없음)

---

## 📁 프로젝트 구조

```
Visualization-Tool/
├── index.html              # 메인 진입점
├── HANDOFF.md              # 개발 인수인계 전체 문서
├── WORKLOG.md              # 이 파일 — 세션 간 작업 로그
├── README.md               # 프로젝트 소개
├── css/
│   ├── tokens.css          # 디자인 토큰 (컬러, 타이포, 스페이싱)
│   ├── app.css             # 기본 + 셸 컴포넌트
│   ├── grid.css            # DataGrid
│   ├── data.css            # Data 모드
│   ├── clean.css           # Cleaning Studio
│   ├── viz.css             # Visualization Builder
│   ├── dash.css            # Dashboard
│   ├── sql.css             # SQL Workspace
│   ├── map.css             # Map 모드
│   ├── ml.css              # ML Studio
│   ├── stats.css           # Stats Studio
│   ├── tweaks.css          # Tweaks 패널
│   └── ai.css              # Ask Insight 드로어
└── js/
    ├── data.js             # 샘플 데이터 (서울 아파트 실거래가)
    ├── statsMath.js        # 통계 수학 (p-value 등)
    ├── icons.jsx           # 아이콘 컴포넌트
    ├── store.jsx           # 전역 상태 관리
    ├── charts.jsx          # ECharts 래퍼
    ├── grid.jsx            # DataGrid 컴포넌트
    ├── shell.jsx           # TopBar, Rail, StatusBar, Workspace
    ├── dataMode.jsx        # Data 모드
    ├── cleanMode.jsx       # Clean 모드
    ├── vizMode.jsx         # Chart 모드
    ├── dashMode.jsx        # Board(Dashboard) 모드
    ├── sqlMode.jsx         # SQL 모드
    ├── mapMode.jsx         # Map 모드
    ├── mlMode.jsx          # ML 모드
    ├── statsMode.jsx       # Stats 모드
    ├── tweaks.jsx          # Tweaks 패널
    ├── aiDrawer.jsx        # Ask Insight AI 드로어
    └── app.jsx             # 앱 루트
```

---

## 🗂️ 세션별 작업 내역

### Session 1 — 2026-06-06

**작업 내용:**
- 디자인 시안 파일 (`https://api.anthropic.com/v1/design/h/kQVCoebKGVWofRBgAUQTxw`) 다운로드 및 압축 해제
- 전체 프로젝트 파일 (`index.html`, `css/*`, `js/*`, `HANDOFF.md`) 복사 완료
- 로컬 서버(python3 http.server 8742) 실행 및 정상 동작 확인
- Claude Preview로 스크린샷 검증 완료

**확인된 기능:**
- ✅ Data 모드: DataGrid, Column Profile, Profiling 탭
- ✅ Chart 모드: Columns/Rows 셸프, Show Me (Bar/H-Bar/Pie/Scatter 등)
- ✅ 좌측 Rail: 8개 모드 (Data/Clean/SQL/Chart/Map/Board/Stats/ML)
- ✅ Data Explorer: 3개 데이터셋 로드 (Seoul_Apartment_Txns 503행, Monthly_Price_Index 42행, District_Summary 12행)
- ✅ Tweaks 패널, Ask Insight 드로어 UI 구성 확인

**현재 상태:** Phase 1 디자인 시안 구현 완료. 실제 백엔드(FastAPI + DuckDB) 연동 및 Next.js 포팅은 미구현.

---

### Session 2 — 2026-06-06

**작업 내용: 차트 타입 대량 구현 (+13종)**

**수정 파일:**
- `js/vizMode.jsx` — 전체 재작성, 차트 타입 8→20종으로 확장
- `js/icons.jsx` — 신규 아이콘 10개 추가 (bubble, waterfall, boxplot, violin, sankey, sunburst, facet, cumreturn 등)
- `js/data.js` — KOSPI 금융 데이터셋 추가 (320행 OHLCV, 2024-2025)
- `css/viz.css` — Show Me 그룹 스타일 + Facet Grid CSS 추가

**추가된 차트 타입:**

| 그룹 | 차트 | 상태 |
|---|---|---|
| Advanced | Bubble Chart | ✅ (3 measures + color dimension) |
| Advanced | Waterfall | ✅ (누적 증감, 양수=주황/음수=빨강) |
| Advanced | Funnel | ✅ |
| Advanced | Radar | ✅ (3+ measures 권장) |
| Advanced | Box Plot | ✅ (IQR + 이상치 scatter overlay) |
| Advanced | Violin Plot | ✅ (KDE 커널밀도 + 중앙값/IQR overlay) |
| Advanced | Sankey | ✅ (2 dims → flow, gradient fill) |
| Advanced | Sunburst | ✅ (2 dims → hierarchical donut) |
| Financial | Candlestick | ✅ (KOSPI 데이터, dataZoom) |
| Financial | OHLC+Vol | ✅ (캔들 + 거래량 복합 2-grid) |
| Financial | Cumulative Return | ✅ (수익률 % area chart) |
| Special | Facet Grid | ✅ (Color dim별 Small Multiples, 2×N grid) |

**기술적 이슈 및 해결:**
- Violin KDE renderItem: category axis에서 fractional index 불가 → 픽셀 공간에서 직접 좌표 계산으로 해결
- Show Me 패널: 단일 grid → 4개 그룹(Basic/Advanced/Financial/Special)으로 재구성

**현재 총 차트 수: 20종** (Basic 8 + Advanced 8 + Financial 3 + Special 1)

---

---

### Session 3 — 2026-06-06

**작업 내용: 개발 도큐먼트 생성**

**신규 파일:**
- `docs/index.html` — 자기 완결형 HTML 개발 도큐먼트 (오프라인 동작, 외부 의존성 없음)

**문서 포함 내용:**
- 프로젝트 개요, 설계 철학, 기술 스택
- 전체 아키텍처 & 스크립트 로드 순서
- `data.js` — Dataset/Column 스키마, PRNG, 현재 7개 기본 데이터셋 설명
- `store.jsx` — State 구조, Actions 전체 목록, derive/stat/aggFn API
- `charts.jsx` — EChart 컴포넌트 Props, CSS 변수 해석 원리
- `shell.jsx` / `app.jsx` — 셸 컴포넌트, MODES 배열
- 8개 모드 모듈 개요 (dataMode, cleanMode, sqlMode, vizMode, mapMode, dashMode, statsMode, mlMode)
- 아이콘 시스템, statsMath.js, tweaks.jsx, aiDrawer.jsx
- 디자인 토큰 전체 (colors, typography, radius, density, 8색 팔레트 시각화)
- CSS 파일 14개 담당 범위 & 주요 클래스
- `window.*` 전역 변수 완전 목록 (30+ 개)
- 핵심 개발 규칙 8가지 (번호 목록)
- 로딩 화면 구현 상세
- 차트 타입 레지스트리 20종 (그룹별, need 코드 포함)

**특이사항:**
- 사이드바 스크롤 연동 네비게이션 (현재 섹션 하이라이트)
- 반응형 (860px 이하: 사이드바 숨김)
- 프린트 스타일 적용

---

### Session 4 — 2026-06-06

**작업 내용: JMP 통계 기능 강화 (Phase 1.5)**

**신규 파일:**
- `js/insightEngine.js` — 규칙 기반 자동 해석 엔진 (`window.IE`), plain JS IIFE (non-JSX)

**수정 파일:**
- `js/statsMath.js` — `skewness(a)`, `kurtosis(a)` 추가, `window.SM` exports 확장
- `js/statsMode.jsx` — 전체 재작성: Distribution 탭 + Analysis Builder 탭 추가, InterpretationPanel + NextStepPanel 컴포넌트, DescTable에 왜도/첨도 컬럼
- `js/mlMode.jsx` — 전체 재작성: 클래스별 P/R/F1 테이블, 군집 특성 표, Model History 테이블, window.NODE.mlHistory/lastAnalysisResult
- `js/aiDrawer.jsx` — 전체 재작성: IE.profileDataset 자동 실행, Last Analysis Result 섹션, 인텐트 라우팅 확장
- `css/stats.css` — Interpretation/NextStep/AnalysisBuilder 스타일 추가
- `css/ml.css` — clf-metrics, model-comparison-table 스타일 추가
- `index.html` — insightEngine.js 스크립트 태그 추가
- `docs/index.html`, `README.md`, `HANDOFF.md`, `WORKLOG.md`, `CHANGELOG.md` — 문서 업데이트

**구현된 JMP 기능:**
- Distribution Platform: 히스토그램 + 수평 박스플롯 + 8개 통계 카드 (왜도/첨도)
- Analysis Builder: 컬럼 타입 자동 감지 → 최적 분석 자동 선택
- 규칙 기반 자동 해석 (Interpretation 패널) + 다음 분석 제안 (Next Step 패널)
- 클래스별 Precision/Recall/F1 + 군집 특성 표 + 모델 비교 이력 (최근 10개)
- Ask Insight 자동 프로파일링 + 마지막 분석 결과 연동

**검증 완료:**
- Stats 모드 8개 탭 (Descriptive/Distribution/Correlation/T-Test/ANOVA/Chi-Square/Regression/Analysis Builder)
- Distribution 탭: seoul_txns price_manwon 히스토그램 + 박스플롯, 왜도 0.89, 첨도 0.27
- Analysis Builder: OLS 회귀 실행 → R²=0.550, 계수 테이블, 산점도 표시
- ML 분류: 70.3% 정확도, Macro F1=0.542, 클래스별 P/R/F1 테이블
- Ask Insight: seoul_txns 프로파일 5개 인사이트, Last Analysis Result 표시

---

### Session 5 — 2026-06-07

**작업 내용: Export / CSV Import / World Map 3종 구현**

**수정 파일:**
- `js/charts.jsx` — `lastInst` 추적, `downloadPNG()`, `downloadCSV()` 헬퍼 추가
- `js/shell.jsx` — `ImportBtn` (CSV/TSV/JSON 드래그앤드롭 파서), `ExportBtn` (PNG/CSV 드롭다운) 구현, TopBar 교체
- `js/data.js` — `WORLD_GDP` 데이터셋 추가 (30개국, 2023 IMF 명목 GDP)
- `js/mapMode.jsx` — World Map 탭 추가 (WorldMapCenter choropleth + WorldPanel 랭킹), MapModeRoot 훅 구조 리팩터링

**구현 상세:**

| 기능 | 구현 내용 |
|---|---|
| PNG Export | `Charts.lastInst.getDataURL()` → `<a download>` 트리거, pixelRatio:2 |
| CSV Export | `Store.derive.getActiveData()` → BOM없는 CSV Blob → `<a download>` |
| CSV Import | FileReader + 인용부호 CSV 파서, 숫자 자동 감지, `NODE.datasets.push()` |
| World Map | ECharts v4 CDN으로 world.json 로드, choropleth (GDP/Per Capita/Population/Growth) |

**버그 수정:**
- `Charts.lastInst = null` 전방 참조 → `window.Charts = { ..., lastInst: null }` 인라인 초기화로 해결
- `window.MapMode()` 평면 함수 호출 내 `useState` → `MapModeRoot` 명명 컴포넌트로 훅 분리 (조건부 훅 위반 방지)
- World map GeoJSON URL 404 (echarts v5에는 map 번들 없음) → `echarts@4.9.0` CDN으로 교체
- `key={tab}` on `<Workspace>` → 탭 전환 시 fiber 동일성 혼동으로 인한 "Rendered more hooks" 오류 해결

**검증 완료:**
- ✅ Export 드롭다운: PNG / CSV 두 옵션 표시 확인
- ✅ CSV Import: 드래그앤드롭 모달 표시 확인
- ✅ Seoul 탭: 지구 choropleth 정상 렌더링
- ✅ World · GDP 탭: 세계 choropleth (GDP/Per Capita 메트릭 전환 동작), 30개국 랭킹 패널

### Session 6 — 2026-06-07

**작업 내용: Korea · 행정구역 탭 구현 (시도 choropleth + 시군구 버블맵)**

**수정 파일:**
- `js/data.js` — `KOREA_PROVINCES` (17 시도, 인구/면적/밀도/GRDP), `KOREA_MUNICIPALITIES` (~84 시군구) 데이터셋 추가
- `js/mapMode.jsx` — Korea 행정구역 탭 전체 구현

**구현 상세:**

| 기능 | 구현 내용 |
|---|---|
| 시도 choropleth | Highcharts npm CDN GeoJSON (`@highcharts/map-collection@2.0.1/countries/kr/kr-all.geo.json`) 로드, 영문명 → 한국어 리맵, ECharts `registerMap("korea_prov")`, visualMap 색상 범례 |
| 시군구 버블맵 | 80+ 시군구 위경도 → **UTM Zone 52N → Highcharts 투영좌표** 변환 후 scatter overlay |
| 메트릭 | 시도: 인구/인구밀도/면적/GRDP, 시군구: 인구/인구밀도/면적 |
| 시도 필터 | 드롭다운으로 특정 시도 시군구만 표시 |
| 드릴다운 | 시도 클릭 → 해당 시도 시군구 자동 필터링 |
| 우측 패널 | 시도/시군구 탭 전환, 인구 순위 바 차트, 권역별 인구 |

**핵심 기술적 이슈 해결:**

- **Highcharts GeoJSON 좌표계 문제**: `@highcharts/map-collection` GeoJSON이 표준 WGS84 lat/lon이 아닌 **UTM Zone 52N 투영좌표** (`[2560, -431]` 형식)를 사용함을 발견
- **해결책**: `wgs84ToHCKorea(lon, lat)` 함수 구현 (WGS84 → UTM Zone 52N → Highcharts JSON 좌표)
  - Highcharts `hc-transform`: `crs=UTM52N, scale=0.001170, jsonres=15.5, xoffset=114507.65, yoffset=4275280.76`
  - 변환식: `jsonX = (E-xoff)×sf+mX`, `jsonY = mY+(N-yoff)×sf`  (sf = scale×jsonres)
  - 검증: 서울 [lon=126.9784, lat=37.5665] → HC [2753, 7755] ✓, 제주 → HC [~2560, ~-431] ✓

**CDN 조사 결과 (Korean GeoJSON):**
- `raw.githubusercontent.com/southkorea/...` → 404
- `cdn.jsdelivr.net/gh/southkorea/...` → 403 (jsDelivr GitHub 차단)
- `echarts@4.9.0/map/json/south-korea.json` → 404
- ✅ `cdn.jsdelivr.net/npm/@highcharts/map-collection@2.0.1/countries/kr/kr-all.geo.json` → 200

**검증 완료:**
- ✅ 시도 choropleth: 17개 시도 한국어명, 인구/밀도/면적/GRDP visualMap 전환
- ✅ 시군구 버블맵: 80+ 도시 지리적 정확 위치 표시 (서울/경기 집중, 남부 분산)
- ✅ 경기도 필터: 수원·고양·용인 등 경기 시군구 정확 위치 클러스터 확인
- ✅ 시도 클릭 드릴다운 → 해당 시도 시군구 자동 필터

---

### Session 7 — 2026-06-19 (✅ 완료, v1.9.0)

> **결과**: Phase A/B/C 전부 완료, 브라우저 전수 검증 통과. 커밋 `78b7803`(A) · `9a87bdf`(B) · `1d75a6a`(C1) + 문서.
> 부가 수정: `__rid` 도입으로 노출된 중복제거(`drop_duplicates`/Clean dup 카드) 및 AIDrawer null-행 크래시 버그 동반 해결. 캐시 `?v=175`.

**목표: 임포트 데이터 직접 편집 기능 (JMP/Excel 스타일)**

> Data 모드 그리드에서 셀 편집·행/열 추가·삭제·열 위치 변경을 직접 수행.
> 사용자 결정사항: **① Data 모드 인라인 편집** · **② 비파괴 스텝 저장** · **③ 헤더 드래그앤드롭 reorder**

**설계 원칙 — 기존 비파괴 파이프라인 재사용**

- 모든 편집 = `state.clean[id].steps`에 새 `op` 스텝 추가 → `applySteps(원본, steps)`가 재생.
- → undo/redo · 스텝 로그 · 원본(`NODE.datasets`) 보존이 전부 자동 적용.
- **행 식별 문제**: 그리드 정렬/필터/페이징 + 파이프라인 행 재배열 때문에 "n번째 행"으로 지목 불가
  → 모든 원본 행에 **숨김 안정 ID `__rid`**(단조 증가 정수) 부여, 편집 스텝은 `__rid`로 행 지목.
  → `columns`엔 미포함(그리드 비표시), `{...r}` 복제로 파이프라인 통과.

**기존 재사용 op**: `rename`(피처명) · `drop_col`(열삭제) · `change_type`(타입). 신규 5종만 추가.

**Phase A — 기반 (`js/store.jsx`, `js/data.js`)**

- [x] A1. `__rid` 주입 — 데이터셋 등록 + Import 경로 전 행에 단조 증가 ID
- [x] A2. `applySteps` 신규 op 5종:

  | op | 동작 | 행 지목 |
  |---|---|---|
  | `set_cell` | 셀 값 변경 (열 타입 형변환) | `__rid` |
  | `drop_rows` | 행 삭제(단일/다중) | `__rid[]` |
  | `add_row` | 새 행 추가(새 `__rid`) | — |
  | `add_col` | 빈/기본값 열 추가 | — |
  | `reorder_cols` | 열 순서 재배치 | — |

- [x] A3. store 액션 `editCell·deleteRows·addRow·addColumn·reorderCols` (전부 `addStep` 래퍼)

**Phase B — 편집 가능 그리드 (`js/grid.jsx`, `js/dataMode.jsx`)**

- [x] B1. `DataGrid`에 `editable` prop + 콜백, Data 툴바 **Edit 토글**(평소 읽기전용)
- [x] B2. 셀 인라인 편집 — 더블클릭 → input → Enter/blur 커밋, Esc 취소
- [x] B3. 헤더 컨텍스트 메뉴 확장 — 이름변경·타입변경·열 삽입(좌/우)·열 삭제 (기존 sort/filter/freeze/hide 유지)
- [x] B4. 헤더 드래그앤드롭 reorder
- [x] B5. 행 거터 — hover 삭제(×), 다중선택 + Del 일괄삭제
- [x] B6. 푸터 — `Add row` / `Add column`

**Phase C — 마감**

- [x] C1. Clean 모드 스텝 로그 `stepLabel`·`OP_ICON`에 신규 5종 추가
- [x] C2. 편집은 Data 모드 + 활성 데이터셋에서만 (집계/SQL 결과 그리드는 읽기전용)
- [x] C3. 브라우저 검증 → `?v=` 캐시 bump → CHANGELOG/README/docs 갱신

**커밋 전략**: Phase A → B → C 순으로 분할 커밋 (A 완료 시 로직 단독 브라우저 검증).

---

### Session 8 — 2026-07-10 (문서 최신화, 코드 변경 없음)

- 현재 소스 기준 기능 현황 재검증
- 차트 수를 실제 레지스트리 기준 20종(Basic 8 / Advanced 8 / Financial 3 / Special 1)으로 통일
- 기본 데이터셋을 실제 `window.NODE.datasets` 기준 7종으로 통일
- Confusion Matrix, 클래스별 P/R/F1, OLS Feature Importance, Dashboard Cross Filtering을 구현 완료로 정정
- Import/Export 지원 범위(CSV/TSV/JSON 입력, PNG/CSV 출력)와 Save/영속성 미구현 상태 명시
- README 브랜드 자산/Brand Spec 링크와 로컬 실행 경로 수정
- `README.md`, `HANDOFF.md`, `CHANGELOG.md`, `WORKLOG.md`, `docs/index.html`, `docs/user-guide.html` 동기화

---

## 🔧 다음 세션 작업 계획 (Phase 2)

> `HANDOFF.md` §12 "Suggested next steps" 참고

- [ ] **데이터 영속성**: `localStorage`에 Store 상태 직렬화/복원
- [ ] **SQL JOIN**: `sqlMode.jsx` 내 `runSQL` 엔진에 JOIN 지원 추가
- [ ] **Chart Recommendation Engine**: 선택한 컬럼 타입 조합 → 최적 차트 자동 추천
- [x] **Dashboard Cross Filtering 기본 기능**: 차트 클릭 → 다른 위젯 필터, 재클릭/버튼으로 해제
- [ ] **ML/PCA 확장**: Logistic Regression, ROC/AUC, Cross Validation, PCA/Biplot/Scree Plot
- [ ] **Stats 확장**: 시계열 기초, SPC, QQ Plot/Normal Fit
- [ ] **FastAPI 백엔드**: DuckDB/Polars 엔진 연동 (Phase 3)

---

## ⚙️ 자동 로그 업데이트 훅 (레거시)

훅 위치: `.claude/hooks/post-tool-use/auto-push.sh`
현재 훅과 `.claude/settings.json`은 이전 사용자/디렉터리의 절대 경로를 참조합니다. 경로를 명시적으로 정비하기 전에는 자동 commit/push가 동작한다고 가정하지 않습니다.

---

## 📌 핵심 개발 규칙 (다른 세션 필독)

1. **`window.*`로 내보내기**: 모든 컴포넌트는 `window.X = ...` 또는 `Object.assign(window, {...})`로 끝나야 함
2. **데이터는 항상 `Store.derive.getActiveData(id)`로 읽기**: 직접 `NODE.datasets[i].rows` 접근 금지
3. **`animation: false` 유지**: ECharts 애니메이션 비활성화 — Preview/iframe에서 빈 차트 방지
4. **`.fade` CSS는 opacity 애니메이션 금지**: transform만 허용
5. **하드코딩 컬러 금지**: 반드시 `css/tokens.css` CSS 변수 사용
6. **`<script>` 순서 변경 금지**: `index.html` 로드 순서가 의존성 순서
