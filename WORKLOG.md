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
| Plan version | `safe-hardening-batch` (자율 실행 승인) |
| Current milestone | **안전 후속 배치 완료** (E2E 인프라·캐시버스트·언로드 플러시·ECharts SRI·UI 폴리시·SQL 폴백 유니코드). 병합·push는 사용자 게이트 |
| Status | FOLLOWUP §5 저위험 6트랙 완료. ML 확장(P13·P10)은 이미 main 병합됨. |
| Branch | **`main`** (origin 동기화 — ahead/behind 0). `feat/safe-hardening`도 push됨. |
| Base commit | `9c7c6b3` — merge: 안전 후속 배치 → main (--no-ff, 6커밋) |
| Last checkpoint commit | `9c7c6b3` — merge: 안전 후속 배치 → main |
| Working tree | 깨끗. |
| Last verified | 2026-07-12 — **Node 295/295**(+7 sqlFallback) · tsc 0 · **E2E 21/21**(+statsDecomp) **깨끗 종료**(force-kill 0) · asset v=277. **main 병합·push 완료** |

> ✅ **게이트 통과 (2026-07-12)**: `feat/ml-expansion` → main 병합(`28e7ae4`, --no-ff) + origin push 완료. Node 288/288 · E2E 20.

> ✅ **FOLLOWUP 6차 검증 반영 (2026-07-12)** — Fable §0-0e: P13·P10 전면 통과(E2E 19/19, Logistic one-vs-rest AUC 0.79, CV 0.684±0.026). 관찰 ②(분류 기본 target=district 12클래스 → 학습 정확도 랜덤 근처로 "고장"처럼 보임) 반영: `mlEligibility`의 clf/dt/nb/logit `validTargets`를 **클래스 수 오름차순 정렬** → 기본 target이 최저 카디널리티 범주형(building_type 3클래스). mlCfg.test +1 assertion, ML E2E 6/6 통과.
> ✅ **§0-0e ① 반영 (2026-07-12)** — 데이터셋 전환 시 현재 태스크가 부적격이면(예: 숫자만 있는 데이터셋으로 전환 + clf 선택 상태) `mlMode.jsx`에서 **첫 적격 태스크로 자동 전환**(로컬 힐링) → disabled인데 주황 하이라이트 남던 문제 해소. target도 전환된 태스크의 validTargets 기준으로 재힐링(dt/nb 전용 힐링을 일반화). E2E `mlEligibility.spec.mjs` +1(자동 전환 검증) → **ML E2E 7개**, 전체 **E2E 20**.

> ✅ **안전 후속 배치 (2026-07-12, `feat/safe-hardening` 5커밋)** — FOLLOWUP §5 저위험 자율 항목 일괄:
> - **Track 1 E2E 인프라**(`269ca49`): `tests/e2e/helpers.mjs`(bootApp hydration-safe + teardownDuckDB), 7스펙 통일. **전체 스위트 5분 force-kill 해소** — 원인은 시스템 Chrome GPU/shm 헬퍼 프로세스 미종료 + 병렬 워커 teardown 레이스 → `playwright.config` `launchOptions(--disable-gpu/--disable-dev-shm-usage/--no-sandbox)` + `workers:1`. 5.5분(kill 2~3) → **2.3분·kill 0**.
> - **Track 6 SQL 폴백 유니코드**(`f3ce2d7`): `runSQL`→`js/sqlFallback.js`(dual-mode) 추출, `[\w]+`→`[\p{L}\p{N}_]+`(u). 한글 컬럼/테이블 지원. `tests/sqlFallback.test.js` +7.
> - **Track 3 언로드 플러시**(`1d13d4b`): projectStore pagehide/beforeunload saveNow(B2).
> - **Track 5 UI**(`d2a44b1`): 다변량 이상치 카드 컬럼명 툴팁 + statsDecomp multiplicative E2E.
> - **Track 2·4 자산**(`3eb86f0`): `scripts/bump-assets.sh`+`npm run bump`(캐시버스트 자동화·드리프트 통일 v277), ECharts SRI(sha384).
> - 검증: **Node 295/295 · E2E 21/21 깨끗 종료 · tsc 0**. 제외(결정 필요): C4 export 대상·A1 formula 안전파서·C2 클릭=선택.
> ✅ **게이트 통과 (2026-07-12)**: `feat/safe-hardening`(6커밋) → main 병합(`9c7c6b3`, --no-ff) + origin push 완료(`f892a94..9c7c6b3`). main=origin/main 동기화. 6번째 커밋 = WORKLOG 갱신(`05e799c`).
> ✅ **C4 export 대상 명시 (2026-07-16, `fix/c4-export-target` 3커밋)** — FOLLOWUP §5 C4: export가 전역 `Charts.lastInst`(마지막 렌더 차트)에만 의존해 대시보드 다중차트·차트전환 직후 **엉뚱한 차트가 PPT/PNG로** 나가던 문제. `EChart`에 `onInst(inst)` 콜백 추가(각 차트가 자기 인스턴스 노출) + export 헬퍼(downloadPNG/SVG/copyPNG)에 optional `inst` 인자(생략 시 lastInst 폴백=하위호환). Chart 모드(VizCenter)는 `chartInstRef`로 캡처해 doExport/doCopy/doPPTX에 명시 전달. 전역 TopBar ExportBtn은 모드 무관이라 폴백 유지(의도). 검증: Node **295/295** · **E2E 22/22**(신규 `chartExport.spec.mjs` — onInst 캡처·명시 인스턴스·폴백·대상 전무 false) · tsc 0. 커밋 `392ece0`·`1f49f82`·`8c1cf8b`. PR #1 머지 완료.
> ✅ **A1 formula column 안전파서 (2026-07-17, `fix/a1-formula-safe-parser` 2커밋)** — FOLLOWUP §5 A1(T1 배포 전 필수): Clean 모드 Formula Column이 `new Function("row","Math",expr)`로 **임의 JS 실행** — 공유 프로젝트 JSON/공유링크(P10) 열면 코드실행 벡터. `js/formulaEval.js`(`window.FormulaEval`) 신규 — eval/new Function 없는 재귀하강 파서+트리워커, `row.*` 읽기 + `Math.*`(화이트리스트)만 허용, 프로토타입 체인(`constructor`/`__proto__`) 차단으로 `constructor.constructor("…")()` 탈출 봉쇄. 산술·비교·논리·삼항·`**`·`%` 지원, `compile()`은 문법오류 throw(UI 사전거부)·per-row fn은 null-safe(기존 동작 유지). `store.jsx` formula case를 `FormulaEval.compile`로 교체, index.html 등록 + 자산 v278 bump. 검증: Node **307/307**(+12 formulaEval) · **E2E 22/22**(신규 formulaColumn — 정상계산 + constructor 탈출·전역할당 무력화 브라우저 실증) · tsc 0. 커밋 `ae3dbff`·`4cfae88`. **P10 공유링크 보안 선행 완료.** 병합·push는 사용자 게이트.
| Updated at | 2026-07-12 |

> ☀️ **아침 게이트(`fix/mode-render-p0`)** — 활성 계획 Phase 3.5. **① 8모드 전환+리로드 복원은 Playwright E2E로 자동 검증 완료(P0.5) → 재확인 불필요.** 사용자는 **시각·상호작용만**: ② P3(Stats decomposition 4단 차트·Clean 다변량 이상치 카드; Map은 Fable ✓), ③ P9(붙여넣기·Enter/Tab·Cmd+Z·Shift-범위), ④ IndexedDB 왕복. 이상 없으면 `fix/mode-render-p0`→main 병합(P0+P2+P3 일괄) → `feat/duckdb` 분기 → Phase 4.
> E2E 재현: `npx playwright test`.
>
> ✅ **게이트 통과 (2026-07-12 Fable 브라우저 검증)** — ①~④ **전 항목 통과**, 콘솔 에러 0. 결과표: `docs/FOLLOWUP_PROPOSALS.md` §0-0. **병합 가능 판정** — main 병합·push는 CLI에서 진행. (관찰 2건: 다변량 카드 컬럼명 미표시, multiplicative 미클릭 — FOLLOWUP §1 참고)

> ☀️ **아침 브라우저 게이트(시각·상호작용 확인 후 병합)**
> - **Phase 2 P3**(`feat/analytics-wiring`): (1) Stats›Time Series View=decomposition→Original/Trend/Seasonal/Residual 4단 차트, (2) Clean 이슈바 "다변량 이상치" 카드→제거, (3) Map›내 데이터 "단계구분도"→지역명 매칭 채색.
> - **Phase 3 P9**(`feat/excel-edit`): Data 편집모드에서 (a) Excel/시트에서 복사→셀 붙여넣기(1 undo), (b) 편집 중 Enter/↓/↑/Tab 이동, (c) Cmd+Z/Shift+Cmd+Z(셀 편집 밖에서), (d) Shift-클릭 행 범위선택.
> - 문제 없으면 브랜치 스택을 순서대로 main 병합(feat/analytics-wiring → feat/excel-edit) 후 필요 시 origin push.
>
> ⏭️ **NEXT (Phase 4 DuckDB, 새 세션)**: `feat/duckdb` 분기 → **S1 로딩 PoC**(vendor/duckdb/에 glue+worker+wasm 벤더링+SHA256/라이선스, index.html에 첫 `<script type="module">` island로 DuckDB 인스턴스화 → `window.DuckDB.query(sql)` 노출 → 사소 쿼리). **브라우저 로드·쿼리 성공 여부가 make-or-break 게이트** — 성공 시 S2 어댑터(js/sqlEngine.js, rows→테이블 등록)·S3 sqlMode async 교체. 상세: `~/.claude/plans/temporal-juggling-fountain.md`.

> 활성 계획: `~/.claude/plans/temporal-juggling-fountain.md` (Phase 0~4 체크리스트). 실브라우저 검증은 Claude Desktop/Fable로 대체.

## 밤샘 자율 실행 정책 (사용자 승인 2026-07-11)

- 사용자가 "내 개입 없이 진행 가능한 부분은 새벽 내내 자율 진행" 명시 승인. 계획: `~/.claude/plans/temporal-juggling-fountain.md`.
- **자율:** 순수 엔진 구현 + Node 테스트 + JSX 구문검사 + UI 배선 + 기능 브랜치 체크포인트 커밋 + 문서 동기화.
- **아침 게이트(사용자):** `main` 병합, annotated tag, 원격 push, 실브라우저 왕복 검증.
- **브랜치 스택:** `feat/xlsx-import → feat/data-combine → feat/pivot-builder → feat/dashboard-builder`. main 미병합으로 연쇄.
- 목표 종착점: Core v2(M3~M5) + Batch E(Phase 2 순수-JS 분석) + Batch F(규모제한, 경고). Phase 3 제외.
- 검증 도구: `node --test tests/*.test.js`, `tsc --noEmit --allowJs --checkJs false --jsx react … js/*.jsx` (TS1xxx 구문오류만 확인), `git diff --check`.

## 세션 기록 — 2026-07-12 (Track C — P10: Decision Tree·Naive Bayes·Cross Validation)

기존 ML 7종과 동일 패턴(순수 엔진 .js + Node 테스트 → mlMode 배선)으로 3종 추가. 엔진 3개는 독립 파일이라 서브에이전트 병렬 → 메인이 검수. ML UI는 Playwright 헤드리스로 자율 검증.

- `0707044` **C1-C3 순수 엔진**: `js/decisionTree.js`(CART gini 분류트리, +11) · `js/naiveBayes.js`(Gaussian NB, log-space proba, +10) · `js/crossVal.js`(k-fold mulberry32 시드, mean±std, +14). 전부 결정적·dual-mode. Node 253→288.
- `ad0920c` **C4a DT/NB 배선**: `dtModel`/`nbModel` 래퍼(clfMetrics 공용 헬퍼), 태스크 버튼·dispatch·결과 렌더(clf/dt/nb 공용 혼동행렬·per-class, DT는 depth/nNodes). `mlResolveCfg`가 dt/nb도 범주 태스크로 인식.
- `03c7eee` **C4b Cross Validation**: `runCV`(엔진레벨 fit/predict로 reg/clf/dt/nb/logit k-fold), Off/5-fold 토글, "교차검증 (5-fold)" mean±std 카드. try/catch로 학습 무영향.
- **E2E** `mlNewTasks.spec.mjs` +3(DT·NB 학습 무크래시·CV mean±std). ML E2E 총 6(P13 3 + P10 3).

**남은 것(사용자 게이트)**: `feat/ml-expansion`→main 병합·push. 그 외 FOLLOWUP: P10 잔여(PPT 매핑·공유링크)·§5 리스크(A1 수식 보안 등 배포 전)·E2E boot 통일.

## 세션 기록 — 2026-07-12 (v2.0.0 ship + P13 ML 데이터 적격성 검증)

**Track A ship**: `feat/duckdb`→main `--no-ff` 병합 `3acaf4d` + **`v2.0.0` 태그** + origin push(main·태그·feat/duckdb 동기화). DuckDB 전환 정식 릴리스.

**Track B — P13(사용자 발의 §7)**: "이 데이터로 어떤 모델 돌릴 수 있는지 사전 검증" — 근본 해결.
- `1b58e1f` **B1**: `js/mlCfg.js` `mlEligibility(columns,rows)` — 태스크별 `{ok,reason,validTargets}`. reg(숫자≥2)·clf/dt/nb(2~20클래스 범주+숫자특성)·logit(범주 target, one-vs-rest로 다중클래스 가능·binaryTargets 플래그)·pca/km/dbscan/hier(숫자≥2+행수). mlDefaultCfg가 'id' 기본 target 회피. mlCfg.test +6.
- `b356ec6` **B2·B3**: `mlMode.jsx` 3단 방어 — 부적격 태스크 버튼 disabled+툴팁, target 셀렉터 적격 컬럼만+클래스수 주석("적격 대상 없음" placeholder), Train 가드+인라인 사유. **`alert()` 전면 제거**(§5 C3 임베드 블로킹 해소). 태스크 전환 시 result 초기화(§0-0b 부가관찰). **B3**: 다중클래스 target+양성 클래스 드롭다운→one-vs-rest 이진화(logit이 sample 데이터서 영구 비활성 되던 것 해소).
- **E2E** `mlEligibility.spec.mjs` +3 통과. **중요 발견**: E2E가 `setMode`를 IndexedDB hydration 완료 전에 호출하면 복원값으로 되돌려지는 레이스 → boot에 **loader-hidden 대기** 추가로 해소. (타 스펙도 동일 잠재 — 후속 통일 권장.)

**NEXT: Track C — P10(Decision Tree·Naive Bayes·Cross Validation) 엔진+배선.**

## 세션 기록 — 2026-07-12 (Phase 4 S2·S3: DuckDB 전환 완료 — SQL 모드 async)

S1 로딩 통과 후 S2(테이블 등록)·S3(sqlMode async 교체)까지 완주. **SQL 모드가 DuckDB-WASM에서 전체 SQL을 실행**. 전 단계 헤드리스 E2E로 자율 검증(전체 스위트 **13 passed**, exit 0).

- `6684c28` **S2**: `window.DuckDB.registerDatasets()` — 각 데이터셋 cleaned view(`__rid` 제외)를 테이블로 등록(테이블명=`sanitizeTableName(ds.id)`, quoted 식별자로 한글/특수문자, 충돌 de-dupe). `tests/e2e/duckdbTables.spec.mjs`(+3): 행수 일치·**데이터셋 간 쿼리 공존**·__rid 제외.
- `5ad544d` **S3 core**: `sqlMode.jsx` 동기 runSQL→async `runQuery`(ready→registerDatasets→query). useEffect 초기실행+로딩/에러 상태, badge에 엔진. **폴백**: DuckDB 미로드 시 기존 JS 엔진(코드 보존). registerDataset 저장 유지. `tests/e2e/sqlMode.spec.mjs`(+3): 기본쿼리 자동실행·**CTE+window 함수**(구 엔진 불가)·에러 무크래시.
- `7b50b94` **S3 폴리시**: Reference "지원 기능"을 전체 SQL(JOIN·subquery·CTE·window)로(기존엔 JOIN 안 된다고 오표기), StatusBar "Local engine"을 DuckDB 로드 시 "DuckDB-WASM"으로. i18n `sqlFullSql`.
- **부수효과 해소**(FOLLOWUP B3): 한글/특수문자 컬럼명이 이제 SQL에서 조회 가능(DuckDB 따옴표 식별자).
- **알려진 사소 이슈**: Playwright 전체 스위트에서 DuckDB Web Worker가 teardown서 안 죽어 프로세스 force-kill(5min 지연) — 테스트는 통과. db.terminate() teardown 추가 = 후속.
- **남음**: 사용자 최종 브라우저 확인(SQL에서 실제 JOIN·저장) → **v2.0.0 태그**(사용자 게이트). feat/duckdb→main 병합도 사용자/최종확인 후.

## 세션 기록 — 2026-07-12 (Phase 4 S1: DuckDB-WASM 로딩 PoC — make-or-break 통과)

Playwright 헤드리스로 DuckDB 전환의 make-or-break를 **자율 검증**(P0.5에서 얻은 헤드리스 브라우저 능력 활용). CDN 로딩 방식(`@duckdb/duckdb-wasm@1.29.0` jsDelivr ESM, `getJsDelivrBundles`→Blob Worker→instantiate)이 시스템 Chrome 헤드리스에서 정상 로드·쿼리됨을 먼저 스탠드얼론 probe로 확인 후 정식 배선.

- `0b6cf49` **S1**:
  - `js/duckdbEngine.mjs` — 앱 최초 ES 모듈. `window.DuckDB.{ready(Promise),query(sql),registerTables(specs),status,version}` 노출. query는 Arrow Table→`window.DuckDBMap.arrowToResult`.
  - `js/duckdbMap.js`(dual-mode 순수) — `arrowTypeToApp`(Int→integer/Float·Decimal→float/Bool→boolean/Date·Timestamp→datetime/Utf8→string)·`coerceCell`(BigInt→Number, Date→ISO)·**`decimalToNumber`(Decimal128 4-word 복원)**·`arrowToResult`·`sanitizeTableName`.
  - index.html: duckdbMap.js(classic)+duckdbEngine.mjs(module) 등록, v266.
  - 테스트: `tests/duckdbMap.test.js` +8(타입맵·coerce·**decimal 복원**·sanitize), `tests/e2e/duckdb.spec.mjs` +2(로드·타입매핑·**JOIN+CTE**).
- **실측 함정**: DuckDB가 `3.5`·AVG를 DECIMAL로 타이핑 → Arrow가 `{0:35,1:0,2:0,3:0}`(scale 1) 4-word 객체로 직렬화 → schema scale로 복원(coerceCell만으론 scale 모름 → arrowToResult에서 컬럼별 처리). E2E로 발견·수정.
- **결과**: Node 237→245, E2E 총 5 passed(모드전환 3·DuckDB 2). **DuckDB 브라우저 로드·쿼리·JOIN 자율 검증 완료 → 전환 리스크 대폭 해소.**
- **NEXT: S2**(`window.DuckDB.registerTables`로 전체 데이터셋 등록·cleaned view·__rid 제외) → **S3**(sqlMode async 교체·폴백·Reference·배지). CDN 의존이라 각 단계 E2E로 자율 검증 가능.

## 세션 기록 — 2026-07-12 (P0.5: 모드 전환 스모크 E2E — P0 헤드리스 자동 검증)

**핵심 돌파구**: "MCP Chrome이 사용자 localhost 미접근"이라 시각검증을 계속 사용자 게이트로 미뤄왔는데, **Playwright는 자체 헤드리스(시스템 Chrome) 인스턴스를 띄워 localhost:8742에 접근 가능** → 이 클래스(렌더 크래시)는 내가 자율 검증 가능. 시스템 Chrome 존재+CDN 네트워크 가능 확인 후 진행.

- `659524f` **`tests/e2e/modeSwitch.spec.mjs` + `playwright.config.mjs`**: Playwright(channel:chrome, 브라우저 다운로드 없음) + `webServer`(python http.server, reuseExistingServer). 3 tests — (1) data→9모드 전환 무크래시, (2) 전 모드 연쇄 전환, (3) 비-data 모드 영속화→리로드 복원(벽돌화 해소). 크래시 판정=blank root/ErrorBoundary/React hook·render 에러.
- **결과: 3 passed** → **P0 수정이 헤드리스로 자동 검증됨**. 정적검사(Node/tsc)가 못 잡던 "Rendered more hooks" 클래스의 영구 회귀망 확보. `npx playwright test`.
- package.json은 **테스트 하네스 전용**(앱은 여전히 no-build), node_modules·playwright 아티팩트 gitignore.
- 마이너 후속(비차단): ml 진입 시 ECharts `clientWidth`(null container) 콘솔 에러 1건 — 렌더 정상, 크래시 아님.
- **NEXT**: 사용자 시각·상호작용 검증(P3/P9/IndexedDB)만 남음 → `fix/mode-render-p0`→main 병합 → Phase 4 DuckDB.

## 세션 기록 — 2026-07-12 (🚨 P0: 모드 전환 크래시 리그레션 수정)

Fable가 3차 브라우저 검증(`docs/FOLLOWUP_PROPOSALS.md` §0-1)에서 발견: Data→Clean/SQL/Dashboard/ML/Stats 전환 시 앱 블랙스크린, `mode` 영속화로 리로드 후 재크래시(벽돌화). **Node 237/237·tsc 그린이지만 React 렌더 규칙 위반이라 정적검사로 안 잡힘.** 이 버그는 **이미 main에 있었음**(Phase 1 i18n 머지분).

- **근본원인**: `js/app.jsx`가 모드를 함수호출(`content = window.CleanMode()`)로 렌더 → 모드 내부 훅이 App 훅으로 계상. i18n Phase 1이 모드 export 최상위에 `useStore(lang)` 추가 → 모드 전환 시 App 훅 개수 변동 → "Rendered more hooks" 크래시. ErrorBoundary는 content(자식)만 감싸 App 자신 오류 못 잡음 → root unmount.
- `4d402b9` **수정**: L62~76의 `window.XMode()` 8곳 → `<window.XMode/>` 엘리먼트 렌더. 각 모드가 자기 훅 스코프 확보, **ErrorBoundary가 이제 모드 크래시를 실제로 잡아** 벽돌화 해소("데이터 화면으로" 버튼). HANDOFF에 "모드=엘리먼트 렌더" 규칙 명문화. Node 237/237.
- **교훈**: 정적검사가 못 잡는 클래스 → **P0.5 Playwright "8모드 전환 스모크" E2E**로 재발 차단(계획에 추가).
- **NEXT**: 브라우저서 8모드 전환+P3/P9+IndexedDB 검증(Phase 3.5) → `fix/mode-render-p0`→main 병합 → Phase 4 DuckDB.

## 세션 기록 — 2026-07-12 (Phase 3: P9 Excel식 편집)

Data 그리드에 스프레드시트식 편집 추가. store 배치 op가 핵심(원자적 undo). Node 230→237.

- `2aa9faa` **3a `set_cells` 배치 op + `actions.editCells`**: 여러 (rid,col,value)를 한 undo 스텝. 숫자열 coerce(invalid→null) 재사용. `tests/storeEdit.test.js` +5(배치·단일 undo/redo·coerce·안전 skip·빈 리스트) — store.jsx 실코드 스텁 하네스.
- `d469d78` **3b-3e (grid.jsx + editHandlers)** [상호작용 아침 게이트]:
  - 3b 붙여넣기: `js/gridPaste.js` `parseClipboardMatrix`(순수·dual-mode, `tests/gridPaste.test.js` +7: CRLF·trailing NL·빈셀·1x1·null). 셀 input `onPaste`가 블록이면 앵커부터 매트릭스 매핑(그리드 경계 clip), `edit.onCells` 1회=1 undo. (초과행 자동추가는 2차)
  - 3c 셀 이동: 편집 input에서 Enter/↓→아래, ↑→위, Tab/Shift+Tab→좌우(경계서 다음행 wrap), isComposing 가드.
  - 3d Cmd/Ctrl+Z→undo, Shift+Z·Ctrl+Y→redo. 기존 editable keydown effect에 추가, INPUT/TEXTAREA 포커스 시 네이티브 텍스트 undo 보존.
  - 3e Shift-클릭: `lastSelRid` 앵커, 행 클릭 시 shiftKey면 pageRows 범위 selRows 추가.
  - editHandlers(cleanMode·dataMode)에 `onCells`/`onUndo`/`onRedo` 배선.

**NEXT: Phase 4 DuckDB-WASM(새 세션, 브라우저 반복 필요). S1 로딩 PoC부터.**

## 세션 기록 — 2026-07-12 (Phase 2: P3 미배선 엔진 3종 UI 배선)

밤샘/Batch C에서 만들어 Node 테스트까지 끝났지만 화면이 없던 엔진 3종을 UI에 연결(`80287a0`). 엔진은 이미 테스트되어 배선만 추가. Node 225/225. **실제 렌더는 브라우저 확인 필요(아침 게이트).** 각 파일 독립이라 서브에이전트 3기 병렬 → 메인이 diff+tsc 검수.

- **2A TSDecomp → Stats › Time Series**(statsMode +65줄): `cfg.tsView` 토글(smoothing|decomposition). decomposition 시 config에 period `seg`[4/7/12/52]·additive/multiplicative 추가, 렌더는 기존 정렬 series로 `TSDecomp.decompose` → Original/Trend/Seasonal/Residual 4단 스택 EChart. period<2/n<2·period throw는 try/catch로 "Not enough data".
- **2B Outliers → Clean 이슈바**(cleanMode +13줄): `issues` useMemo에 numeric measure 컬럼(≥2)으로 `Outliers.detect` 추가 → 4번째 `<Issue>` "다변량 이상치" 카드. 제거는 `results[].index`→`__rid`→기존 `actions.deleteRows`. `!ok`(특이공분산)/컬럼<2면 카드 없음(무크래시).
- **2C GeoMatch → Map › 내 데이터**(mapMode +107줄): `useBaseMap`에 `_baseMapNames` 캐시+getter 추가해 geojson 지역명(remap 후) 노출. `mode:"points"|"choropleth"` 토글, choropleth 시 `GeoMatch.bestColumn` 자동감지+"지역 컬럼" 셀렉터, `match`로 data→geoName 매핑·**합계 집계**, `series:[{type:"map"}]`+visualMap(province 패턴 재사용). 매칭률/미매칭 note, 매칭 실패 시 안내.

**NEXT: Phase 3 P9 — Excel식 편집(grid.jsx + store `set_cells` 배치 op). `feat/excel-edit` 분기.**

## 세션 기록 — 2026-07-12 (Phase 1: i18n 커버리지 — 7파일 한/영)

정책: 도메인/기술 용어(A: R²·AUC·ANOVA·집계명·차트타입·SQL키워드·transform명·지표라벨)는 영문 유지, 일반 UI chrome(B: 버튼·섹션헤더·빈상태·필드라벨·탭·placeholder·leftTitle/rightTitle)는 한글. 파일별 서브에이전트 초안→메인 검수(tsc+i18n 대칭 테스트)→커밋. `tests/i18n.test.js`가 ko/en 대칭·빈값·폴백 자동 검증(매 파일 통과). Node 225/225 유지.

- `bbc28d6` **1a dashMode** (46키: 인스펙터 필드·Add widget·Cross-filter·Layout)
- `909f8c8` **1b cleanMode** (42키: 연산그룹·버튼·빈상태·step 라벨 생성형; transform 고유명 영문)
- `10ac4bc` **1c mapMode** (21키: Seoul/World 탭·라벨·안내; Korea/내데이터 기존 한글; "내 데이터" 탭은 EN모드서도 한글 — 사소)
- `83f411e` **1d statsMode** (빈상태·Picker·Run Analysis + **Verdict 해석문 lang 삼항 in-place 번역**, 도메인 심볼 R²·Cohen's d·η²·χ²·σ 영문·${} 보간 보존)
- `9ae7176` **1e mlMode** (21키: 빈상태·설정·Train model·이력)
- `ea9fd16` **1f sqlMode + 1g aiDrawer** (22키: Run/Save·섹션·예시제목 + 헤더/부제)

재사용 키: dashDataExplorer·rows·gClear·dUndo/dRedo·gAddRow/gAddCol·pRows/pColumns·gApply·cols·statInterpretation.
**잔여(별도)**: stats/ml 내부 분석 라벨 중 A로 분류해 영문 유지한 것들(테스트명·지표·차트옵션)은 의도적. mapMode "내 데이터" 탭 EN 라벨은 미세 폴리시.
**NEXT: Phase 2 P3 — TSDecomp/Outliers/GeoMatch UI 배선(`feat/analytics-wiring` 분기).**

## 세션 기록 — 2026-07-12 (Phase 0: main 병합 + 깃 위생)

신규 로드맵 승인(병합→i18n→P3→P9→DuckDB). Phase 0 실행:
- `65754ab` **`feat/analytics`(97커밋) → main `--no-ff` 병합**. main이 feat/analytics의 조상이라 충돌 0. 병합 후 Node 225/225 재확인.
- 태그 **`checkpoint/core-v2`** @ 병합 커밋 (v2.0.0은 DuckDB 전환 후 보류).
- `9b6820d` 무력화된 `auto-push.sh` 훅 추적 해제 + `.claude/hooks/` gitignore → tree clean.
- **push 없음**(외부전송 별도 승인 — 로컬 main이 origin보다 106커밋 앞섬).
- **다음**: `feat/i18n` 분기 → Phase 1a(dashMode i18n).

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

## 세션 기록 — 2026-07-12 (FOLLOWUP P7: i18n 커버리지)

한국어 모드에서 영문 잔존하던 핵심 chrome을 한/영 i18n으로 완성(`13092a3`). `js/i18n.js` 사전에 ko/en **대칭 80키** 추가 후 3개 파일 배선:
- **grid.jsx**(DataGrid/ColumnsMenu/FilterPopover): 검색·행/열 추가·편집 힌트·컬럼 메뉴(정렬/필터/고정/숨김/이름변경/타입 6종/삽입/삭제)·컬럼 토글·필터 팝오버(min/max/All/None/Clear/Apply)
- **dataMode.jsx**: Preview/Profiling 탭·Edit/Editing·Undo/Redo·auto-profiled·좌측 Explorer(검색/Datasets/Combine/Union·Join/Connect/Drop/hint)
- **pivotMode.jsx**: Rows/Columns/Values 셸프+힌트·note·Clear·Pivot Table 제목·Save&open·빈 상태

`tests/i18n.test.js`(+4): ko/en 키 대칭·빈값 없음·`t()` 폴백·신규키 해석 회귀 잠금. Node 221→225.
**잔여(별도 큰 스윕)**: stats/ml/sql/dashboard 내부 분석 라벨(테스트명·지표·차트옵션)은 도메인 용어라 번역 방침 별도 판단.

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
