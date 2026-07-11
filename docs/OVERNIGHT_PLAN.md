# 밤샘 자율 작업 계획 — 2026-07-12

> **상태: 대기 중 (START 신호 대기).** 사용자가 "시작"이라고 말하면 Batch **A1**부터 순서대로 실행.
> **이 문서는 압축(context compaction) 후 나의 유일한 실행 기억이다.** 진행하며 각 체크박스를 `[x]`로 갱신하고, 맨 아래 "진행 로그"에 완료 내용·검증 수치·커밋 해시를 남긴다.
> **작업 시작 전제**: 사용자가 명시적으로 "시작/진행" 신호를 준 뒤에만 실제 코드 작업을 한다. 신호 전에는 계획/문서만.

---

## 0. 컨텍스트 (압축 대비 — 매 재개 시 먼저 읽기)

- **레포**: `/Users/lyuhoyun/Documents/GitHub/Visualization Tool` (no-build 브라우저 BI 툴, "insight Analytics Workbench").
- **브랜치**: `feat/analytics` (main 대비 **70커밋** 앞섬). 병합·태그·push는 **전부 사용자 게이트**.
- **직전 완료(이번 세션)**: 다중 탭(viz/pivot/dashboard 시트), Change type boolean, 정제/데이터 역할분담+셀편집 단일클릭, 지도 탭UI+범용화 Stage1, 대시보드 기본위젯 다양화, **먹통 2건 수정**(대용량 scatter `large` / 통계 ANOVA 크래시), **전역 ErrorBoundary**(app.jsx), **하드코딩 전수 제거**(dashMode/statsMode/mlMode/sqlMode/aiDrawer). 최신 커밋 `c3d42a9`. **asset v=246 · Node 98/98.**
- **아키텍처 규칙**:
  - React18 UMD + ECharts 5 + Babel Standalone(브라우저 JSX 컴파일). 빌드 없음.
  - 모든 모듈은 `window.*` IIFE. `index.html`의 `<script>` **순서 = 의존성 순서**.
  - 순수 엔진 = `.js` (dual-mode: `if(typeof window!=='undefined')window.X=api; if(typeof module!=='undefined'&&module.exports)module.exports=api;`). 브라우저+Node 양쪽 로드.
  - 모드 = `.jsx` (`type="text/babel"`). 엔진 `.js`는 모드 `.jsx`보다 **앞줄**에 로드해야 `window.X` 사용 가능.
  - 상태: `window.Store`(useStore/actions/derive/stat/aggFn). 지속: `js/projectStore.js`(IndexedDB, STATE_KEYS).
- **검증 수단(브라우저 없이 가능한 것만)**: Node 테스트 · tsc JSX 구문검사 · 순수 스크래치 검증. **내 자동화 Chrome은 사용자 localhost 미접근** → **모든 시각 확인은 아침 게이트.**
- **안전 원칙**: (1) 가능한 한 **additive**(새 파일). (2) 작동 중 UI 수정 시 tsc+테스트 즉시 검증, 실패하면 `git checkout`으로 되돌림. (3) 전역 ErrorBoundary가 한 모드 크래시를 흡수하므로 최악에도 앱 전체 백지화는 아님(그래도 회귀는 금지).

---

## 1. 매 작업 항목 검증 프로토콜 (예외 없음 — 6단계)

```
# 1) tsc 구문검사 (변경 파일들 나열)
npx tsc --noEmit --allowJs --checkJs false --jsx react --skipLibCheck \
  --target es2020 --module esnext --moduleResolution node --types "" <파일...> 2>&1 | grep -E "error TS1[0-9]{3}:"
#    → 출력 비어야 통과

# 2) 전체 Node 테스트
node --test tests/*.test.js 2>&1 | grep -E "^ℹ (tests|pass|fail)"
#    → fail 0, pass 수는 증가해야 함(새 테스트 추가 시)

# 3) 새 .js 모듈이면 index.html에 <script> 추가 (소비 .jsx보다 앞줄, 아래 "삽입 위치" 참고)

# 4) asset 버전 bump (캐시버스트)
cur=$(grep -oE '\?v=[0-9]+' index.html | head -1 | grep -oE '[0-9]+'); nxt=$((cur+1)); sed -i '' "s/?v=$cur/?v=$nxt/g" index.html

# 5) 커밋 (.DS_Store 제외, 관련 파일만). 메시지 끝에:
#    Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>

# 6) 이 문서 체크박스 [x] + "진행 로그" 한 줄(내용·Node N/N·커밋해시)
```

**index.html 삽입 위치(현재 기준)**: 순수 엔진 그룹은 `<script src="js/chartAdvisor.js?v=NNN"></script>` 줄 **다음**에 추가 (그 아래로 charts/grid/각 모드 .jsx가 옴). 모드 .jsx 로드 순서: dataMode→cleanMode→vizMode→dashMode→sqlMode→mapMode→mlMode→statsMode→aiDrawer.

**Node 테스트 스캐폴드 패턴** (기존 `tests/dataOps.test.js` 모방):
```js
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const X = require(path.join(__dirname, "..", "js", "<module>.js"));
test("...", () => { assert.equal(...); });
```

---

## 2. 게이트 (절대 하지 않음)
- `main` 병합 · `git merge --no-ff` · annotated tag · 원격 `git push`
- 시각 확인이 필수인 UI를 "검증 완료"로 선언 (엔진/배선까지만 하고 "아침 확인 필요"로 기록)
- 비결정성 도입(`Math.random`/`Date.now`를 로직에 — 테스트 재현성 깨짐; 타임스탬프는 호출부 주입)

---

## 3. 반복 항목 (★ 매 배치 종료마다 반드시 — 잊지 말 것)

- [x] **★ 배치 A 종료 → WORKLOG.md 갱신** (CURRENT STATE: 커밋수/asset v/Node N/N + 배치 A 요약 항목)  ✅
- [x] **★ 배치 B 종료 → WORKLOG.md 갱신**  ✅
- [x] **★ 배치 C 종료 → WORKLOG.md 갱신**  ✅
- [x] **★ 배치 D 종료 → WORKLOG.md 갱신**  ✅ (D1 완료, D2 아침 게이트)
- [x] **★ 배치 E 종료 → WORKLOG.md 갱신**  ✅
- [ ] **★ 이 문서(OVERNIGHT_PLAN.md)도 매 항목마다 체크박스+진행로그 갱신** (커밋에 포함)

> WORKLOG 갱신 형식: 상단 "CURRENT STATE" 블록의 수치(커밋수·asset·Node) 업데이트 + 날짜 섹션에 "밤샘 배치 X: <한 줄 요약> (커밋 <hash>)".

---

## Batch A — 테스트 잠금 (순수 헬퍼 추출 → dual-mode 모듈 + Node 테스트)

**목적**: 이번 세션의 하드코딩-치유 로직을 JSX IIFE 밖으로 빼내 **실제 코드에 대한 영구 회귀 테스트** 확보. 절차(각 항목 공통):
1. `js/<name>.js` dual-mode 생성(함수 verbatim 이동).
2. 소비 `.jsx` 상단에서 `const { ... } = window.<Global>;` 로 배선하고 **인라인 정의 삭제**.
3. `index.html`에 script 태그(chartAdvisor.js 다음).
4. `tests/<name>.test.js` 작성.
5. 검증 프로토콜 6단계 → 커밋.

- [x] **A1. `js/statsCfg.js` (window.StatsCfg)** ← `statsMode.jsx`  ✅ 커밋 `1481315` · Node 103/103 · asset v=247
  - 이동 함수: `catsOf, numsOf, defaultCfg, resolveCfg` (statsMode.jsx의 "Categorical = category OR string" 주석부터 `resolveCfg` 끝까지).
  - 배선: statsMode 상단 `const { catsOf, numsOf, defaultCfg, resolveCfg } = window.StatsCfg;`
  - 테스트: (a) defaultCfg 동적·하드코딩 없음(measure=첫 숫자, group=첫 범주, test="descriptive"), (b) stale 서울설정→지하철 컬럼 치유(measure/group/a/b/target/preds 전부 존재 컬럼, l1/l2=실제 행 레벨, builder.inputs 정리), (c) 유효설정 보존, (d) 빈 컬럼 무크래시.
  - 주의: statsMode가 이 4개를 StatsCenter/StatsPanel 여러 곳에서 사용. 배선 후 tsc 필수.
- [x] **A2. `js/mlCfg.js` (window.MlCfg)** ← `mlMode.jsx`  ✅ 커밋 `4385e78` · Node 110/110
  - 이동 함수: `mlNums, mlCats, mlDefaultCfg, mlResolveCfg` (mlMode.jsx의 "Categorical = category OR string" 주석부터).
  - 배선: `const { mlNums, mlCats, mlDefaultCfg, mlResolveCfg } = window.MlCfg;`
  - 테스트: 태스크별 target 유효성(clf/logit→범주 cats[0], reg→숫자 num0), feats 치유(존재+≠target), stale 서울설정(target:"price_manwon", feats:["area_m2"...]) 치유.
- [x] **A3. `js/dashWidgets.js` (window.DashWidgets)** ← `dashMode.jsx`  ✅ 커밋 `95a2f1c` · Node 118/118
  - 이동 함수: `dashMeasures, dashDims, defaultWidgets, colExists, widgetStale`.
  - 배선: `const { dashMeasures, dashDims, defaultWidgets, colExists, widgetStale } = window.DashWidgets;`
  - 테스트: 위젯 다양성(subway 3측정2차원→~10위젯 bar/pie/scatter/treemap/hbar; sales+datetime→line 포함; minimal 1측정1차원→8위젯), stale 감지, count-KPI는 stale 예외, 측정·차원 없으면 안내 텍스트 위젯.
- [x] **A4. `js/aiIntent.js` (window.AiIntent)** ← `aiDrawer.jsx`  ✅ 커밋 `d50208c` · Node 126/126
  - 이동 함수(순수만): `dimsOf, measOf, dateOf, lowCardDim, interpret, suggestions`, 헬퍼 `dimChipOf, measChipOf`도 함께 이동 가능. `buildInsights`/`runIntent`/`fmtMd`는 stat/derive/NODE/actions 런타임 의존 → aiDrawer에 유지(단 interpret/suggestions/컬럼헬퍼는 window.AiIntent 참조).
  - 배선: aiDrawer 상단 `const { dimsOf, measOf, dateOf, lowCardDim, interpret, suggestions } = window.AiIntent;`
  - 테스트: 제안칩이 저cardinality 차원 사용(역명600 대신 노선명27), 각 칩→interpret 왕복(bar/top/mix/outlier/goStats/last), 자유텍스트 컬럼명 인식.
- [x] **A5. (선택·higher-risk) `js/sheets.js` (window.Sheets)** ← `store.jsx`  ✅ 엔진+테스트 커밋 `3034677` · Node 136/136 · **store.jsx 배선은 아침 게이트로 보류**(작동 중 store 리팩터 위험)
  - 제네릭 시트 리듀서(순수): `addSheet(list,factory)`, `setActiveId(list,active,id)`, `renameSheet`, `removeSheet(list,active,id)`, `duplicateSheet`, `updateActive(list,active,fn)`. viz/pivot/dash 3중복 로직 통합 → 테스트 가능.
  - **위험도 중간**(store 리팩터). A1~A4 안정 후에만. 불안하면 엔진+테스트까지만 커밋하고 store 배선은 아침 게이트(그 경우 "보류"로 표시).

## Batch B — 엔진 엣지케이스 테스트 보강 (additive · UI 무관 · 잠재버그 발굴)

기존 `tests/*.test.js`에 degenerate 입력 케이스 추가. **버그 발견 시 엔진 수정 + 진행로그에 명시.**

- [x] **B1. dataOps** — `tests/dataOps.edge.test.js` 10케이스(union 최소2·키합집합·null채움·__source·0행, join null키미매칭·숫자↔문자정규화·m2m플래그·중복컬럼리네임·검증). **버그 없음(안전 잠금).** 커밋 `2fe6533`
- [x] **B2. pivotEngine** — `tests/pivotEngine.edge.test.js` 8케이스. **🐛수정: null/빈 차원값 그룹 셀·소계가 0으로 나오던 정합 버그**(tupleKey 공용 정규화). 커밋 `2fe6533`
- [x] **B3. kpiFormula** — `tests/kpiFormula.edge.test.js` 7케이스(0나눗셈·미지컬럼·구문오류·중첩괄호·COUNT(*)·COUNTD·음수/소수·빈행). **버그 없음.** 커밋 `2fe6533`
- [x] **B4. pca/logistic/clustering/timeSeries/spc/distributionFit** — `analytics.edge.test.js`+`clustering.edge.test.js`+`spc.edge.test.js`. **🐛수정 3종: clustering labelsAt(k<1) 크래시 / spc 빈서브그룹·크기0·역전스펙 Infinity·NaN·음수 / distFit jarqueBera n<4 거짓정규.** 커밋 `2fe6533`
- [x] **B5. chartAdvisor** — analytics.edge.test.js에 포함(null/빈 입력 reason 문자열 보장). **버그 없음.** 커밋 `2fe6533`
  - **요약: 실제 버그 4종 수정(pivot 정합 · clustering 크래시 · spc Infinity/NaN/음수 · JB 거짓정규), 회귀 테스트 +53. Node 136→189.**

## Batch C — 신규 순수 분석 엔진 (additive · +Node 테스트 · 결정적이면 UI 배선)

- [x] **C1. `js/timeSeriesDecomp.js` (window.TSDecomp)** — 고전적 계절분해(중심MA 추세·짝수주기 2×period 위상정렬 → season지수 → 잔차, add/mult, period 인자). 알려진 신호 복원+degrade 6케이스. UI 배선 **아침 게이트**. 커밋 `b3b2c4f`
- [x] **C2. `js/outliers.js` (window.Outliers)** — 다변량 Mahalanobis. **statsMath는 browser-only(module.exports 없음)라 Node 테스트 위해 Gauss-Jordan 역행렬+Wilson-Hilferty 카이제곱을 자기완결로 내장.** alpha/topK, 특이공분산·행<차원 degrade. 8케이스. UI 배선 **아침 게이트**. 커밋 `b3b2c4f`
- [x] **C3. 분포 적합 확장** — distributionFit에 지수/로그정규 MLE + compareFits(AIC 랭킹). 결정적 역CDF 샘플 6케이스. 커밋 `7eb3dfc`. (Jarque-Bera 정규성은 이미 존재 → Shapiro 생략.)
  - **요약: 신규 순수 엔진 3종(계절분해·다변량이상치·분포적합확장), Node 189→209. 3종 다 엔진+테스트 자율 완료, C1/C2 UI 배선만 아침 게이트.**

## Batch D — 지도 범용화 Stage 2 (지역명 매칭 단계구분도)

> 사용자가 지도는 "조금 더 생각해볼게"로 보류했었음 → 이번 "전부" 지시에 포함하되 **엔진(이름매칭)까지 자율, 최종 UI/UX는 아침 확인**.

- [x] **D1. `js/geoMatch.js` (window.GeoMatch)** — 지역명 정규화·매칭. 한국 행정접미사(특별시/광역시/도/시/군/구) strip, EN/KO 별칭(17 시도 + 주요국), normalize/buildIndex/match/matchRate/bestColumn(지역 컬럼 자동감지). 8케이스. 커밋 `d8af7bb`. Node 209→217.
- [ ] **D2. MyDataMap 배선** — **아침 게이트로 보류.** 엔진(geoMatch) 준비 완료. mapMode.jsx choropleth 배선은 geojson 로딩·ECharts map 등록·시각검증 필요 → 작동 중 지도 UI 리스크 + MCP Chrome localhost 미접근으로 자율 검증 불가. 아침에 사용자와 함께 배선·확인.

## Batch E — 견고성 가드 스윕

- [x] **E1.** 서브에이전트 감사 → 실제 크래시/Infinity 6곳 수정. mlMode(feats 0개 회귀 importance[0] 크래시·kNN 빈투표·reg scatter Infinity) · mapMode(Seoul/World 시드부재 ds.rows·빈 Math.max·미매칭 find().field) · statsMode(Builder scatter/coef Infinity) · dashMode(인스펙터 measures[0].key). pivot/sql/clean/combine는 이미 가드됨(감사 확인). 커밋 `5e1b310`
- [x] **E2.** bubble은 per-point symbolSize라 ECharts large 렌더 불가 → 5000점 초과 시 결정적 다운샘플로 멈춤 방지(크기 인코딩 보존). scatter는 이미 large 적용됨. 커밋 `5e1b310`

## Batch F — 문서 최종 동기화 (CHANGELOG/HANDOFF; WORKLOG는 배치마다 이미 갱신)

- [ ] **F1. CHANGELOG.md** — Added(신규 엔진·테스트·지도 Stage2), Fixed(먹통2·크래시), Refactored(하드코딩 제거·테스트 잠금) 항목.
- [ ] **F2. HANDOFF.md** — js 트리에 신규 모듈(statsCfg/mlCfg/dashWidgets/aiIntent/[sheets]/timeSeriesDecomp/outliers/geoMatch) 및 각 역할 반영.
- [ ] **F3. WORKLOG.md 최종 확정** — 전체 배치 결과·최종 수치·"아침 게이트 목록"(main 병합·브라우저 검증 항목) 정리.

---

## 우선순위·정지 규칙
- 순서: **A → B → C → D → E → F**. A(테스트 잠금)가 최우선. 배치 내부는 위→아래.
- 불확실·대규모 UI는 **엔진+테스트까지만** 커밋, 배선은 "아침 게이트"로 표시.
- 항목이 tsc/테스트 실패 → **되돌리고(git checkout)** "보류"로 표시하고 다음 항목으로.
- 컨텍스트 경계 임박 → `wip(<scope>): checkpoint` 커밋 + 아래 "NEXT EXACT ACTION" 갱신.

## NEXT EXACT ACTION
> **START 신호를 받으면:** Batch **A1** 시작 —
> 1) `js/statsCfg.js` 생성(catsOf/numsOf/defaultCfg/resolveCfg를 statsMode.jsx에서 verbatim 이동, dual-mode export `window.StatsCfg`),
> 2) `statsMode.jsx` 상단에 `const { catsOf, numsOf, defaultCfg, resolveCfg } = window.StatsCfg;` 넣고 인라인 정의 삭제,
> 3) `index.html`의 `js/chartAdvisor.js` script 다음 줄에 `<script src="js/statsCfg.js?v=NNN"></script>`,
> 4) `tests/statsCfg.test.js` 작성,
> 5) 검증 6단계(tsc·node test·bump·commit),
> 6) 이 문서 A1 `[x]` + 진행로그 기록.

## 진행 로그
- 2026-07-12: 계획 문서 작성 완료. **START 신호 대기 중.** (아직 코드 작업 전혀 시작 안 함 — 앞서 손댔던 statsCfg 시험 추출은 되돌려 깨끗한 상태.)
- 2026-07-12: **START 수신 → Batch A 전체 완료.** 테스트 잠금 5개 모듈 추출(dual-mode). Node **98→136**(+38), asset v=247, main 대비 **76커밋**.
  - A1 `js/statsCfg.js` (catsOf/numsOf/defaultCfg/resolveCfg) 커밋 `1481315`
  - A2 `js/mlCfg.js` (mlNums/mlCats/mlDefaultCfg/mlResolveCfg) 커밋 `4385e78`
  - A3 `js/dashWidgets.js` (dashMeasures/dashDims/defaultWidgets/colExists/widgetStale) 커밋 `95a2f1c`
  - A4 `js/aiIntent.js` (dimsOf/measOf/dateOf/cardinality/lowCardDim/suggestions/interpret/dimChipOf/measChipOf) 커밋 `d50208c`
  - A5 `js/sheets.js` 제네릭 시트 리듀서 엔진+테스트 커밋 `3034677` — **store.jsx 배선은 아침 게이트 보류**.
  - 각 소비 .jsx는 인라인 정의 삭제 후 `const {...} = window.X;` 로 배선. 매 항목 tsc(TS1xxx 0)+Node 그린 확인.
  - **다음 정확한 행동(NEXT): Batch B1 — dataOps 엣지케이스 테스트 보강.**
- 2026-07-12: **Batch B 완료.** 병렬 서브에이전트 3기로 10개 엔진 프로빙 → 실제 버그 4종 수정 + 회귀 테스트 53개. Node **136→189**, asset v=248, main 대비 **78커밋**. 커밋 `2fe6533`.
  - 🐛 pivotEngine null/빈 차원 그룹 소계 0 정합버그 · clustering labelsAt(k<1) 크래시 · spc(빈서브그룹/크기0/역전스펙 Infinity·NaN·음수) · distFit jarqueBera n<4 거짓정규.
  - 안전 잠금(버그없음): dataOps, kpiFormula, pca, logistic, timeSeries, chartAdvisor.
  - **NEXT: Batch C1 — js/timeSeriesDecomp.js (고전적 계절분해) 신규 엔진+테스트.**
- 2026-07-12: **Batch C 완료.** 신규 순수 엔진 3종. Node **189→209**, asset v=250, main 대비 **82커밋**. 커밋 `b3b2c4f`(C1·C2), `7eb3dfc`(C3).
  - C1 계절분해(TSDecomp) · C2 다변량이상치(Outliers, 자기완결 수학) · C3 분포적합확장(지수/로그정규 MLE+AIC).
  - **아침 게이트:** C1(Stats→Time Series 계절분해 토글) · C2(이상치 시각화) UI 배선은 시각검증 필요.
  - **NEXT: Batch D1 — js/geoMatch.js (지역명 정규화·매칭) 신규 엔진+테스트.**
- 2026-07-12: **Batch D1 완료** (D2는 아침 게이트). geoMatch 엔진+테스트 8. Node **209→217**, asset v=251, main 대비 **84커밋**. 커밋 `d8af7bb`.
  - **NEXT: Batch E — 견고성 가드 스윕(E1 unguarded [0]/빈데이터 감사, E2 대용량 raw-point 차트).**
- 2026-07-12: **Batch E 완료.** 서브에이전트 모드 감사로 언가드 크래시/Infinity 6곳 수정 + bubble 다운샘플. Node 217/217, asset v=252, main 대비 **86커밋**. 커밋 `5e1b310`.
  - **NEXT: Batch F — 문서 최종 동기화(CHANGELOG/HANDOFF; WORKLOG는 배치마다 갱신됨).**
