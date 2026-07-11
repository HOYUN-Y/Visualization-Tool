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
| Plan version | `core-v2-plan-v3` (밤샘 자율 실행 승인) |
| Current milestone | 밤샘 자율(Batch A~F) 완료 → 후속 quick-win(FOLLOWUP P4·P5·P6·P8) 처리 완료 |
| Status | Core v2 M3~M5 + 분석엔진 6종 UI + A~F + P4(메모)·P5(편집견고성)·P6(위생)·P8(카피) 완료. main 대비 92커밋. |
| Branch | `feat/analytics` (feat/dashboard-builder 팁에서 분기) |
| Base commit | `07dab60` — M5 dashboard docs checkpoint |
| Last checkpoint commit | `7814f8e` — getActiveData 메모이제이션 (P4) |
| Working tree | 깨끗. quick-win: store 메모(P4)·grid/store 편집(P5)·app 카피(P8)·.gitignore(P6)·문서 드리프트 |
| Last verified | 2026-07-12 — Node 221/221, JSX 구문검사(tsc TS1xxx 0), asset v=254 |
| Updated at | 2026-07-12 |

## 밤샘 자율 실행 정책 (사용자 승인 2026-07-11)

- 사용자가 "내 개입 없이 진행 가능한 부분은 새벽 내내 자율 진행" 명시 승인. 계획: `~/.claude/plans/temporal-juggling-fountain.md`.
- **자율:** 순수 엔진 구현 + Node 테스트 + JSX 구문검사 + UI 배선 + 기능 브랜치 체크포인트 커밋 + 문서 동기화.
- **아침 게이트(사용자):** `main` 병합, annotated tag, 원격 push, 실브라우저 왕복 검증.
- **브랜치 스택:** `feat/xlsx-import → feat/data-combine → feat/pivot-builder → feat/dashboard-builder`. main 미병합으로 연쇄.
- 목표 종착점: Core v2(M3~M5) + Batch E(Phase 2 순수-JS 분석) + Batch F(규모제한, 경고). Phase 3 제외.
- 검증 도구: `node --test tests/*.test.js`, `tsc --noEmit --allowJs --checkJs false --jsx react … js/*.jsx` (TS1xxx 구문오류만 확인), `git diff --check`.

## 🌙 밤샘 자율 실행 최종 요약 (2026-07-12, Batch A~F)

계획 `docs/OVERNIGHT_PLAN.md`의 START 신호 수신 후 Batch A→F 순차 완료. **Node 98/98 → 217/217**(+119 테스트), **asset v=246 → v=252**(A~F 종료 시점, 현재 v=253), main 대비 **87커밋**(A~F 종료 시점, 후속 quick-win 포함 90). 모든 항목 tsc(TS1xxx 0)+Node 그린+asset bump 후 커밋, 매 배치 종료 시 이 WORKLOG 갱신.

| 배치 | 내용 | 결과 |
|---|---|---|
| **A** 테스트 잠금 | statsCfg/mlCfg/dashWidgets/aiIntent/sheets dual-mode 추출 | +38 테스트 |
| **B** 엔진 버그 사냥 | 서브에이전트 3기 프로빙 → 실버그 4종 수정(pivot 정합·clustering 크래시·spc Infinity·JB) | +53 테스트 |
| **C** 신규 분석 엔진 | timeSeriesDecomp·outliers·distributionFit 확장(지수/로그정규/AIC) | +20 테스트 |
| **D1** 지도 범용화 | geoMatch 지역명 정규화·매칭 엔진 | +8 테스트 |
| **E** 견고성 가드 | 서브에이전트 감사 → 모드 언가드 크래시/Infinity 6곳 | 가드(tsc 검증) |
| **F** 문서 동기화 | CHANGELOG·HANDOFF·WORKLOG 최종 정리 | — |

### ☀️ 아침 게이트 (사용자 확인/승인 필요 — 자율 범위 밖)
1. **실브라우저 왕복 검증**(MCP Chrome이 사용자 localhost 미접근 → 자율 불가): 각 모드가 추출 모듈(A)로 정상 동작, Batch B/E 수정 후 pivot 소계·SPC·ML·지도 렌더 확인.
2. **미배선 UI(엔진은 준비 완료, 시각검증 필요)**:
   - A5 `sheets.js` → store.jsx 실배선(작동 중 store 리팩터 위험)
   - C1 계절분해(TSDecomp) → Stats/Time Series 토글
   - C2 다변량 이상치(Outliers) → 시각화
   - D2 geoMatch → MyDataMap choropleth 배선(geojson 로딩·ECharts map 등록)
3. **main 병합·태그·원격 push**: `feat/analytics` 90커밋 스택 검토→승인→`--no-ff`. (자율 금지 항목)
4. **후속작업 제안 검토**: [`docs/FOLLOWUP_PROPOSALS.md`](./docs/FOLLOWUP_PROPOSALS.md) — 실브라우저 클릭 검증(2026-07-12) 결과 기반 P1~P12 우선순위 제안 (미배선 UI·getActiveData 메모·편집 op 견고성 3종·i18n 잔존·E2E 자동화 등). 참고: 위 1번 실브라우저 왕복 중 편집/피벗→차트/Export/SPC/ML은 제어 브라우저로 검증 완료.

## 세션 기록 — 2026-07-12 (후속 quick-win: FOLLOWUP P4·P5·P6·P8)

`docs/FOLLOWUP_PROPOSALS.md`(실브라우저 검증 기반 제안) 검토 → 저위험·검증가능 항목 처리. 각 코드 주장을 실제로 대조 확인 후 수정.

- `41d24bd` **P5 편집 견고성 3종**(데이터 손상 방지): rename 충돌(기존 key 덮어써 소실 → grid+store 양쪽 거부), set_cell 타입오염(숫자열에 문자열 저장 → invalid는 null + grid 빨간테두리 경고), IME Enter(한글 조합 종료 오발 → isComposing 가드). **P8**: 로딩 폴백 카피 "In this build iteration" → 한국어+복구 버튼.
- `c361cc0` **P6 위생**: .gitignore 신설 + 추적 중이던 .DS_Store 5건 언트랙.
- `b0ca001` **문서 드리프트**: IMPLEMENTATION_PLAN 헤더 v2→v3, WORKLOG Quick Start 경로(/Users/hoyun→/Users/lyuhoyun), FOLLOWUP 수치(.DS_Store 5건·커밋 87) 정정.
- `7814f8e` **P4 getActiveData 메모이제이션**: (dataset ref, steps ref, cursor) 키 캐시 → applySteps 반복 rows 복제 제거(XLSX 수만 행 대비). **소비자 read-only 감사 후 안전 확인.** `tests/storeMemo.test.js`로 **store.jsx 실코드**(스텁 window/React 로드)에 캐시 적중·편집/undo/redo 무효화·원본 불변 검증 — store 첫 실코드 테스트. Node 217→221.

**아침 게이트 잔여(FOLLOWUP)**: P1(IndexedDB 리로드 왕복) · P2(main 병합) · P3(엔진 3종 UI 배선) · P7(i18n) · P9~P12. P4는 로직·실코드 테스트로 검증했으나 **실렌더 체감(대용량 편집/undo 즉시 반영)은 브라우저 게이트 권장**.

## 세션 기록 — 2026-07-12 (밤샘 자율: Batch E — 견고성 가드 스윕)

서브에이전트로 모든 .jsx 모드를 감사해 "ANOVA 크래시와 동일 계열"의 언가드 접근(빈 배열 `[0]`, 빈 데이터 `Math.min/max` → ±Infinity, `find().field` 미매칭)을 6곳 수정. 전역 ErrorBoundary가 있어도 모드-레벨 크래시를 원천 제거. `5e1b310`.

- **mlMode**: 특성 0개 회귀 → `res.importance[0].imp` 전체 모드 백지화 크래시(가장 심각) → 렌더 가드 + Train 사전검증("특성 선택" alert). k-NN 빈 투표 `[0][0]` continue. reg scatter 빈 배열 → Infinity 축 가드.
- **mapMode**: Seoul/World 패널이 시드 데이터셋(`district_stats`/`world_gdp`) 부재 시 `ds.rows`로 크래시(World/Korea 형제 경로는 이미 가드됐는데 Seoul만 누락) → `ds?ds.rows:[]`, 빈 배열 `Math.max` ±Infinity, 교차필터 미매칭 `find().field` null 가드.
- **statsMode**: Analysis Builder 회귀 scatter/coef 빈 배열 Math.min/max Infinity 가드.
- **dashMode**: 위젯 인스펙터 Aggregation 변경 시 `measures[0].key` 핸들러 크래시 가드.
- **E2 vizMode**: bubble은 per-point symbolSize 콜백이라 ECharts `large` 렌더와 비호환 → 5000점 초과 시 결정적 다운샘플로 브라우저 멈춤 방지(크기 인코딩 보존). scatter는 이미 `large`.
- **감사로 clean 확인**: pivotMode/sqlMode/cleanMode/combineModal은 이미 try/catch·조기반환·삼항 가드로 안전.

Node 217/217 유지(가드는 .jsx 렌더라 단위테스트 대신 tsc+감사 검증). **NEXT: Batch F(문서 최종 동기화).**

## 세션 기록 — 2026-07-12 (밤샘 자율: Batch D1 — 지도 범용화 지역명 매칭 엔진)

지도 범용화 Stage 2의 순수 엔진 부분을 자율 완료. `d8af7bb` **`js/geoMatch.js` (window.GeoMatch)**: 데이터 컬럼의 지저분한 지역 라벨을 정규화해 지도 레이어 지역명과 매칭. 한국 행정접미사(특별시/광역시/특별자치도/도/시/군/구) strip, EN/KO 별칭 테이블(17 시도 영문 지도명↔한글 + 주요국 20+), `normalize/buildIndex/match/matchRate/bestColumn`(지역 컬럼 자동감지). KOREA_HC_NAME과 정합. 회귀 8케이스(접미사·별칭 정규화, 매칭률, 자동 컬럼 감지). Node 209→217.

**D2 (MyDataMap choropleth 배선)은 아침 게이트:** geojson 로딩·ECharts map 등록·시각검증이 필요하고 작동 중 지도 UI 리스크 + MCP Chrome이 localhost 미접근이라 자율 검증 불가. 엔진은 준비됐으니 아침에 함께 배선.
**NEXT: Batch E(견고성 가드 스윕).**

## 세션 기록 — 2026-07-12 (밤샘 자율: Batch C — 신규 순수 분석 엔진 3종)

브라우저 단독·결정적·Node 테스트 가능한 신규 분석 엔진 3종 추가(Node 189→209). 엔진+테스트는 자율 완료, C1/C2 UI 배선은 시각검증 필요라 아침 게이트.

- `b3b2c4f` **C1 `js/timeSeriesDecomp.js` (window.TSDecomp)** — 고전적 계절분해. 중심이동평균 추세(짝수 주기는 2×period MA로 위상 정렬) → season position별 평균 지수 → 잔차. additive/multiplicative, period 인자. 알려진 신호(추세+계절) 성분 완전복원 검증(6케이스).
- `b3b2c4f` **C2 `js/outliers.js` (window.Outliers)** — 다변량 Mahalanobis 거리 이상치. **statsMath.js가 browser-only(window.SM만, module.exports 없음)라 Node 테스트를 위해 Gauss-Jordan 역행렬 + Wilson-Hilferty 카이제곱 컷오프 + Acklam normInv을 자기완결로 내장.** alpha/topK 옵션, 특이공분산(상수·공선성)·행<차원 degrade(8케이스).
- `7eb3dfc` **C3 distributionFit 확장** — exponentialFit/lognormalFit(엄격 양수 MLE, degrade) + compareFits(normal/exponential/lognormal AIC 랭킹). 결정적 역CDF 샘플로 파라미터 복원·best 선택 검증(6케이스).

**아침 게이트:** C1 Stats→Time Series 계절분해 토글, C2 이상치 시각화 UI 배선(시각검증 필요).
**NEXT: Batch D(지도 범용화 Stage 2 — 지역명 매칭 단계구분도).**

## 세션 기록 — 2026-07-12 (밤샘 자율: Batch B — 엔진 엣지케이스 버그 사냥)

병렬 서브에이전트 3기로 순수 엔진 10종(dataOps/pivotEngine/kpiFormula/pca/logistic/clustering/timeSeries/spc/distributionFit/chartAdvisor)에 degenerate 입력을 던져 **실제 버그 4종**을 찾아 수정하고 **회귀 테스트 53개**를 잠갔다(Node 136→189). 커밋 `2fe6533`.

**🐛 수정된 버그:**
1. `pivotEngine` — null/빈 차원값 그룹의 셀·소계가 0으로 표시(버킷키 `null→""` 와 읽기 `String(null)="null"` 불일치). `tupleKey` 공용 정규화로 소계=총계 정합 복원. 실데이터의 흔한 공백값에서 광범위 영향.
2. `clustering.hierarchical` — `labelsAt(k<1)`이 존재하지 않는 merge 접근으로 하드 크래시. `k`를 `[1,n]` 클램프.
3. `spc` — 빈 서브그룹 `xbarR/xbarS`가 Infinity/NaN 한계 방출(→ `subgroupSize` 검증 throw), `pChart/uChart` 크기0 → per-point null, `capability` 역전스펙(lsl≥usl) → 음수 대신 null.
4. `distributionFit.jarqueBera` — n<4에서 거짓 "정규"(pValue 1) → null 반환. statsMode Q-Q 가드 3→4 동기화.

**안전 잠금(버그 없음 확인):** dataOps(union/join 매트릭스·null키·m2m), kpiFormula(0나눗셈·구문오류·COUNT*), pca(상수열·특이행렬), logistic(완전분리·빈 ROC), timeSeries(window초과·상수 ACF), chartAdvisor(null입력).
테스트 파일: `tests/{dataOps,pivotEngine,kpiFormula,spc,clustering,analytics}.edge.test.js`.
**NEXT: Batch C(신규 순수 분석 엔진 — 계절분해·다변량 이상치).**

## 세션 기록 — 2026-07-12 (밤샘 자율: Batch A — 테스트 잠금)

`docs/OVERNIGHT_PLAN.md`의 START 신호 수신 → Batch A 실행. 이번 세션의 하드코딩-치유/동적생성 로직을 JSX IIFE 밖 **dual-mode 순수 모듈**로 추출해 **실제 코드에 대한 영구 Node 회귀 테스트** 확보. 각 항목 tsc(TS1xxx 0)+Node 그린+asset bump 후 커밋. Node **98→136**(+38 테스트).

- `1481315` A1 `js/statsCfg.js` (window.StatsCfg) ← statsMode.jsx: catsOf/numsOf/defaultCfg/resolveCfg + 6케이스
- `4385e78` A2 `js/mlCfg.js` (window.MlCfg) ← mlMode.jsx: mlNums/mlCats/mlDefaultCfg/mlResolveCfg + 7케이스
- `95a2f1c` A3 `js/dashWidgets.js` (window.DashWidgets) ← dashMode.jsx: dashMeasures/dashDims/defaultWidgets/colExists/widgetStale + 8케이스
- `d50208c` A4 `js/aiIntent.js` (window.AiIntent) ← aiDrawer.jsx: dimsOf/measOf/dateOf/cardinality/lowCardDim/suggestions/interpret/dimChipOf/measChipOf + 9케이스 (buildInsights/runIntent는 stat/derive/NODE 의존이라 잔류)
- `3034677` A5 `js/sheets.js` (window.Sheets) 제네릭 시트 리듀서 + 10케이스 — **store.jsx 실배선은 아침 게이트 보류**(작동 중 store 리팩터 위험).

**아침 게이트:** (1) A5 store.jsx 배선 검토, (2) 실브라우저 왕복(각 모드가 추출 모듈로 정상 동작하는지). **NEXT: Batch B(엔진 엣지케이스 테스트 보강).**

## 세션 기록 — 2026-07-11 (대화형: 차트 서식·내보내기)

밤샘 자율(M3~M5+분석엔진) 이후, 사용자와 대화형으로 **Chart 모드 서식/내보내기**를 대폭 확장. 모두 `feat/analytics`에 커밋(main 대비 52). 매 변경 JSX 구문검사(tsc)+Node 98/98 통과, asset 버전 bump로 캐시버스트.

주요 커밋 흐름:
- `be4a7a8` 차트 oklch→canvas 폴백 버그 수정(전체 빈화면) · `e5c459f` i18n(한/영) · `6042be3` Tweaks→설정, Accent 제거
- `8664022` 복합차트(측정값별 마크)+보조축 · `cdfc31f` PNG/Save 버튼 연결
- `4deaaeb`~`f7c3f0e` Format 패널(범례/레이블/색/격자/스무딩) → 서브탭(차트/서식) → 범례 9방향+자유드래그 → 높이/4모서리 리사이즈
- `bdeca6f` Format 드롭다운(배경/축스케일/격자/텍스트) · `1088d7a`~`c0bd0dd` 내보내기(SVG/클립보드/**PPTX 데이터편집**, PptxGenJS 벤더링)
- `313fc2c` 리사이즈 대상(전체/플롯만) · `898eace`~`e39d1b1` 계열 세부(막대간격/선굵기/파이굵기·분리) → **계열 다중선택 리스트**

## 남은 것 / NEXT

1. **브라우저 실사용 검증**(사용자): 각 서식·리사이즈·내보내기(SVG/클립보드/PPTX) 실제 동작 확인. (자동화 Chrome이 localhost 미접근 → 사용자 환경 필요)
2. main 병합 게이트: `feat/analytics`까지 52커밋 스택 검토→승인→`--no-ff` 병합→태그. 원격 push는 외부전송 승인 후.
3. 추가 후보: PPT 네이티브 차트 매핑 확장(스택/보조축), 배포 시 공유 링크, statusLine(셸 PS1 없어 표시항목 미정 대기).

## ACTIVE CHECKPOINT (Core v2 M3~M5 완료)

- **M3 Union/Join:** 엔진 `fd8a9d6`(Node 9/9), UI `432f1d6`, docs `d20f60e`.
- **M4 Pivot:** 엔진 `d2c78dd`(Node 8/8), UI `86ffd60`, docs `cb236be`.
- **M5 Dashboard/KPI:** 엔진 `8d3bab3`(KPIFormula, Node 7/7), UI `25e1234`(위젯 Inspector, 수식 KPI, dangerouslySetInnerHTML 제거+html→text 마이그레이션, chart topN/table limit 노출).
- **재사용:** `registerDataset`, `ensureRids`, viz shelf/`application/node-field`, `aggFn`, `applyCross`, projectStore가 `dash`/`pivot` 직렬화.
- **남음:** 실브라우저 왕복(아침) — Combine/Pivot/KPI 수식·cross filter. Batch E/F/G.
- **롤백:** 승인 전 브랜치 스택(`feat/data-combine→pivot-builder→dashboard-builder→analytics-*`)만 삭제하면 local main 영향 없음.

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

현재 blocker: SheetJS 배포 파일 다운로드는 외부 네트워크 전송 승인이 필요하다. 원격 Git push도 명시적 외부 전송 승인 전까지 보류한다. IndexedDB/JSON 브라우저 왕복은 plan v2에 따라 `v2.0.0` release blocker로 유지한다.

## CHECKPOINT LEDGER

| Milestone | Branch | Commit/Tag | Tests | Status |
|---|---|---|---|---|
| Source/document audit | `docs/core-v2-planning` | `1e81b9e` | diff check, HTML parse | Complete |
| Core v2 plan baseline | `main` | `76d5333` / `checkpoint/core-v2-plan` | HTTP/assets, links, diff check, JSON/HTML parse | Complete |
| Project persistence | `main` | `b5aeaec` / `checkpoint/project-persistence` (local) | Node 5, diff/parse, HTTP/assets; browser round trip deferred | Complete locally |
| XLSX Import | `feat/xlsx-import` | `b369ba8`, `3b336c3`, `120c1c8` + final docs checkpoint | Node 10, Babel 17, HTTP/assets; browser round trip pending | Ready for approval |
| Union/Join | `feat/data-combine` | `fd8a9d6`, `432f1d6` | Node 9/9 (union/join matrix), runner cases, JSX syntax OK | Engine+UI done, awaiting browser round trip |
| Pivot Builder | `feat/pivot-builder` | `d2c78dd`, `86ffd60` | Node 8/8 (agg/totals/filters), runner case, JSX syntax OK | Engine+UI done, awaiting browser round trip |
| Dashboard/KPI | `feat/dashboard-builder` | `8d3bab3`, `25e1234` | Node 7/7 (KPI parser/eval), runner case, JSX syntax OK, innerHTML removed | Engine+UI done, awaiting browser round trip |
| Analytics engines E/F | `feat/analytics` | `edbe287`, `d4529b7` | Node: PCA 11, Logistic 7, TimeSeries 17, DistFit 10, SPC 7, Clustering 4 | Engines done, UI wiring deferred |
| Core v2 release | `release/core-product-v2` | pending | end-to-end regression | Not started |

## OVERNIGHT AUTONOMOUS SESSION — 2026-07-11 (밤샘 자율)

브랜치 스택(main 미병합): `feat/data-combine → pivot-builder → dashboard-builder → analytics`.

- **M3 Union/Join** `feat/data-combine`: `fd8a9d6`(엔진 Node 9/9) → `432f1d6`(Combine 모달) → `d20f60e`(docs).
- **M4 Pivot** `feat/pivot-builder`: `d2c78dd`(엔진 Node 8/8) → `86ffd60`(Pivot 모드) → `cb236be`(docs).
- **M5 Dashboard/KPI** `feat/dashboard-builder`: `8d3bab3`(KPIFormula Node 7/7) → `25e1234`(위젯 Inspector, 수식 KPI, dangerouslySetInnerHTML 제거) → `07dab60`(docs).
- **Batch E/F 분석 엔진** `feat/analytics`: `edbe287`(PCA/Logistic/TimeSeries/DistFit) → `d4529b7`(SPC/Clustering) → docs → `docs` 정정 커밋(101→90).
- **최종 검증(2026-07-11):** Node **90/90**, JSX 구문검사(tsc) 오류 0, plain-JS `node --check` 전부 OK, `git diff --check` clean, index.html 참조 자산 전부 존재, 로컬 서버 HTTP 200(curl), **엔진 통합 스모크 테스트 통과**(union→join→pivot→kpi→pca→logistic→timeseries→distfit→spc→clustering 전체 파이프라인 무예외·정상 출력), 엔진 결정성 확인(Math.random/Date.now/argless new Date 없음).
- **미실행(사용자/아침 게이트):** **앱 UI 브라우저 왕복** — 이 세션의 제어 Chrome이 로컬 서버(localhost/127.0.0.1/file://)에 접근 불가하여 미실행. plan v2/v3에 따라 release blocker로 유지. Pivot/Combine/Dashboard Inspector·KPI 수식·cross filter의 실제 클릭 검증과 IndexedDB reload는 사용자 환경에서 필요.
- **분석 엔진 UI 배선(Stats/ML 모드 시각화)** 은 아침 논의 대상(엔진은 window.* 로 로드 완료).

## LATEST SESSION CHECKPOINT — 2026-07-11

- Persistence 자동 검증 재실행: Node 5/5, `git diff --check`, HTML/JSON parse, 로컬 자산 34/34, HTTP 200 통과.
- 제어 가능한 인앱 브라우저가 없어 IndexedDB/JSON 클릭 왕복은 release blocker로 이관하고 plan을 `core-v2-plan-v2`로 갱신.
- 체크포인트 `0b192d3` 생성 후 local main에 `--no-ff` 병합: `b5aeaec`.
- annotated tag `checkpoint/project-persistence` 생성.
- 원격 push는 외부 전송 명시 승인 부족으로 보류; local main은 `origin/main`보다 7커밋 앞섬.
- `feat/xlsx-import` 브랜치를 local main 체크포인트에서 생성.
- SheetJS CE 0.20.3 vendor `b369ba8`, ImportEngine/tests `3b336c3`, workbook UI `120c1c8` 체크포인트 생성.
- CSV leading-zero, multiline quote, JSON union keys, XLSX dates/multi-sheet/preview, duplicate naming 테스트 포함; Node 10/10 통과.

---

## 🚀 Quick Start (다른 세션에서 반드시 실행)

```bash
# 1. 프로젝트 디렉토리로 이동
cd "/Users/lyuhoyun/Documents/GitHub/Visualization Tool"

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
