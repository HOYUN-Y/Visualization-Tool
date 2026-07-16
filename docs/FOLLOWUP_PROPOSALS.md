# 후속작업 제안 (Follow-up Proposals)

> 작성: 2026-07-12 · 근거: 브라우저 실사용 클릭 검증 + 코드/문서 대조 감사
> **갱신: 2026-07-12 (6차)** — **P13(ML 적격성)·P10(DT/NB/CV·Logistic one-vs-rest) 검증 통과** (§0-0e). `feat/ml-expansion` 기준, **E2E 19/19**. 이전: 5차(DuckDB S1~S3·§0-0b)·4차(게이트)·3차(P0)·2차(P4~P8)는 §6.
> ⚠️ 코드 수정은 CLI 세션에서만 수행 — 이 문서의 지적사항은 CLI가 반영할 것.
> 성격: **제안 문서** — 승인 전 실행하지 않음. 승인 시 `IMPLEMENTATION_PLAN.md` Plan Revision에 반영 후 착수.
> 관련: [`WORKLOG.md`](../WORKLOG.md) · [`IMPLEMENTATION_PLAN.md`](../IMPLEMENTATION_PLAN.md) · [`CHANGELOG.md`](../CHANGELOG.md)

---

## 0-0. ✅ Phase 3.5 브라우저 게이트 결과 — 전 항목 통과 (2026-07-12, Fable 검증)

> 대상: `fix/mode-render-p0` (= Phase 1+2+3 + P0 수정 `4d402b9`), asset v265, Node 237/237·tsc 0 선확인.
> **판정: 병합 가능** — 아래 4개 게이트 전부 통과, 신규 콘솔 에러 0. main 병합·push는 CLI/사용자 몫.
> ⚠️ **후속 갱신(해소)**: ML 심층검증에서 발견된 **결과 렌더 크래시(§0-0b)는 `54b2e18`로 수정 완료**. 이후 **Phase 4 DuckDB 전환(S1~S3)**까지 진행돼 현재 브랜치는 `feat/duckdb`, **Playwright E2E 13/13 통과**(§0-0d). 게이트 미완이던 항목은 이제 없음.

| 게이트 | 검증 내용 | 결과 |
|---|---|---|
| ① 8모드 전환 매트릭스 | Data↔Clean/SQL/Dashboard/ML/Stats/Viz/Pivot/Map **왕복 16회 전환** | ✅ 크래시 0 |
| ① 벽돌화 해소 | **stats 모드 상태로 저장 → 리로드** (기존 벽돌 시나리오) | ✅ 정상 부팅·stats 화면 렌더 |
| ② P3 Stats 계절분해 | monthly_index → Time Series → View=**Decomposition** | ✅ Original/Trend/Seasonal/Residual **4단 차트** + 카드(42pt·PERIOD 12·additive·month) + PERIOD 4/7/12/52 토글 렌더 (스크린샷 확인) |
| ② P3 Clean 다변량 이상치 | seoul_txns → Clean 이슈바 | ✅ 카드 "**17** · 다변량 이상치 · 4 열" → 제거 클릭 → **503→486행**(`drop_rows`, rids 17) → undo 1번 복원 |
| ② P3 Map choropleth | (이전 검증에서 확인 완료) | ✅ 지역명 매칭 UI |
| ③ P9 붙여넣기 | 셀 에디터에 **실제 paste 이벤트**(2×2 TSV) | ✅ 앵커부터 4셀 매핑, `set_cells` **1스텝**, **1 undo 전체복원** |
| ③ P9 셀 이동 | 편집 중 Enter/Tab/↑ | ✅ Enter=아래·Tab=오른쪽·↑=위 (에디터 위치 추적으로 확인) |
| ③ P9 Cmd+Z | **실제 키 입력** (셀 편집 밖) | ✅ Cmd+Z→undo(999→10), Shift+Cmd+Z→redo(→999) |
| ③ P9 범위선택 | 행2 클릭 → 행6 **Shift-클릭** | ✅ 5행 선택 + "5 selected" 바 + Clear 해제 |
| ④ IndexedDB 왕복 | 셀편집(424242)+열추가+mode=pivot → saveNow → **리로드** | ✅ mode·스텝 2건·편집값·추가열 전부 복원, **__rid 연속성**(신규 rid 1009 > max 503) |

종료 상태: 테스트 흔적 정리(clearSteps) 후 data 모드로 저장 — 사용자가 열면 깨끗한 상태.

---

## 0-0b. ~~🚨 P0급 — ML 회귀·k-NN 결과 렌더 크래시~~ ✅ 수정·검증 완료 (`54b2e18`)

> **해결됨**: `mlMode.jsx:281` 제목맵을 `res.feats?.[0]` 옵셔널 체이닝으로 수정(제안한 최소 레시피). 브라우저 실측 — Regression(R²·RMSE·"Predicted vs actual" 차트)·k-NN(Confusion matrix) 둘 다 크래시 없이 렌더, 콘솔 에러 0. **E2E `mlTrain.spec.mjs`로 reg·clf 학습→렌더 회귀 잠금**(§6 5차). 아래는 원인 기록(보존).
> ⚠️ 방어책 2·3(ErrorBoundary result 클리어, autosave 오염 차단)은 미적용 — 근본 수정으로 크래시 자체가 사라져 실익 낮음. 신규 ML 결과 필드 추가 시 같은 패턴 재발 가능하니 E2E 유지가 안전망.

**(원인 기록) 증상**: ML 모드에서 **Regression 또는 k-NN Classify 학습 → 결과 렌더 즉시 크래시**. ErrorBoundary가 잡아 앱은 생존(P0 수정 효과 실증 ✓)했지만:
- "다시 시도" 무효 — 결과가 `s.ui.ml.result`에 남아 재렌더 즉시 재크래시
- 모드 이탈→재진입도 무효 → **ML 모드가 세션 내 잠김**
- `ui`는 projectStore STATE_KEYS 포함 → autosave되면 **리로드 후에도 ML 잠김** (P0 벽돌화의 모드 국소판)

**근본 원인** ([`js/mlMode.jsx:281`](../js/mlMode.jsx) — 도입 커밋 `54214b9`):
차트 제목을 객체 리터럴 맵으로 선택하는데, **JS 객체 리터럴은 모든 value를 즉시 평가**함:
```js
{ reg: "...", ..., dbscan: "... " + res.feats[0] + ..., hier: "... " + res.feats[0] }[res.kind]
```
`reg`/`clf` 결과 객체에는 `feats` 키가 없음(50·83행 return) → `res.feats[0]`에서 `undefined[0]` throw. `feats`를 포함하는 km/logit/pca/dbscan/hier 결과만 렌더 가능.

**수정 레시피 (CLI용)**:
1. 제목 맵을 지연 평가로 — switch/함수 맵, 또는 최소 `res.feats?.[0]` 옵셔널 체이닝 (1줄)
2. (방어) ErrorBoundary `componentDidCatch`에서 `ui.ml.result` 클리어 → "다시 시도" 실효성 확보 + autosave 오염 차단
3. (회귀 방지) reg/clf 학습→렌더를 E2E(P11) 시나리오에 추가 — "8모드 전환"만으론 못 잡음이 실증됨

**세션 복구법**: 콘솔에서 `Store.setState(s=>{...})`로 `ui.ml.result` 삭제 후 모드 왕복. (이번 검증 종료 시 정리·저장 완료 — 현재 저장 상태 깨끗함)

**ML 7종 태스크 검증 결과** (seoul_txns, 기본 특성):

| 태스크 | 결과 |
|---|---|
| Regression | 🚨 학습 성공(R²=0.493 이력 기록) → **렌더 크래시** |
| k-NN Classify | 🚨 학습 성공(Acc 70.3%) → **동일 크래시** |
| Logistic + ROC | ⚠️ 3클래스 타깃(building_type)에서 binary 가드 발동 → **`alert()` 에러 표시** — 임베드 브라우저에선 억제/블로킹되어 **무반응처럼 보임** (§5 C3 리스크 실증). seoul 데이터엔 2클래스 컬럼이 없어 정상경로 UI 검증 불가 (엔진은 Node 7테스트 통과) |
| PCA | ✅ Scree+로딩표 렌더, PC1 36.7%·CUM(2) 69.7% |
| KMeans | ✅ K=3, inertia 790, 군집크기 179/179/101, 산점도 |
| DBSCAN | ✅ 1 cluster·noise 11 (eps 0.8 기본) |
| Hierarchical | ✅ ward·K=3 |
| 모델 비교 이력 | ✅ 8회 누적·점수 표시 정상 |

**부가 관찰** (사소, CLI 참고): ① 기본 목표가 `id` — 회귀에서 무의미한 타깃이 기본값 ② 태스크 전환 후 이전 결과 화면이 유지되어 우측 작업 하이라이트와 불일치 ③ logit의 binary 가드 메시지를 alert 대신 인앱 표시 권장(C3).

---

## 0-0d. ✅ Phase 4 — DuckDB-WASM 전환 (S1~S3) 검증 통과 (2026-07-12)

> `feat/duckdb` (v269). SQL 엔진을 손수 만든 JS 파서 → **DuckDB-WASM(CDN)** async로 교체, JS 폴백 유지. make-or-break 게이트(브라우저 로드·쿼리) 통과.

| 항목 | 검증 | 결과 |
|---|---|---|
| S1 로드 | `window.DuckDB.status` | ✅ `"ready"` (jsDelivr `@duckdb/duckdb-wasm` ESM 동적 import + Web Worker) |
| S1 쿼리 | 기본 쿼리 실행 | ✅ SQL 모드 자동실행 "20행·~1.9s·DuckDB-WASM" 배지 |
| S2 테이블 등록 | 데이터셋→테이블 | ✅ 7개 데이터셋 전부 등록(우측 테이블 목록), `__rid` 제외(E2E 확인) |
| S2 데이터셋 간 | **JOIN** seoul_txns⋈district_stats | ✅ 정상(성동구 58건 등) — 구 JS 파서로 불가능했던 기능 |
| **역량 확장** | **윈도우 함수** RANK OVER PARTITION BY + QUALIFY | ✅ 정상 (구 파서 불가) |
| **한글 컬럼(B3 재평가)** | 따옴표 식별자 `"구역"` | ✅ DuckDB가 유니코드 식별자 처리 — SQL 측 B3 상당 해소 |
| S3 폴백 | DuckDB 실패 시 | ✅ 코드상 `runSQL` JS 엔진 폴백(오프라인/CDN 불가 대비), 배지 "in-browser JS" |
| S3 오류 처리 | 잘못된 SQL | ✅ E2E: 에러 표시(크래시 아님) |
| **E2E 스위트** | `npx playwright test` | ✅ **13/13 통과 (30초)** |

**E2E 커버리지(신규 자산 — P11 실현)**: `modeSwitch`(8모드 전환+chaining+un-bricking) · `mlTrain`(reg·clf 렌더) · `duckdb`(CDN 로드·JOIN+CTE) · `duckdbTables`(등록·교차쿼리·__rid 제외) · `sqlMode`(자동실행·교차데이터·bad query). **§5·§0 지적의 안전망이 실제 구축됨.**

**신규 관찰 (버그 아님, CLI 참고)**:
- **DuckDB 첫 로드 = CDN 다운로드 수 MB + 워커 초기화** — 첫 SQL 진입에 지연. §5 A3(CDN 단일점)에 항목 하나 추가되나, **JS 폴백이 있어 오프라인에도 SQL 자체는 동작**(우아한 저하). 다만 폴백 JS 파서는 JOIN/윈도우 미지원이라 기능 격차 존재 → 장기적으로 DuckDB 자산 로컬 vendoring(SheetJS 선례) 고려.
- **B3(한글 컬럼)**: SQL은 DuckDB로 해소됐으나 **formula column(`row.한글`)·구 sqlMode 폴백 파서(`[\w]+`)** 는 여전 → §5 B3는 "SQL 주경로 해소, 폴백·formula 잔여"로 축소.

---

## 0-0e. ✅ P13(ML 적격성) + P10(신규 모델) 검증 통과 (2026-07-12)

> `feat/ml-expansion` (v275). Logistic 반복 알림의 근본 해결(P13) + Decision Tree·Naive Bayes·Cross Validation·Logistic one-vs-rest(P10). 정적 Node **288/288**·tsc 0, **E2E 19/19**(신규 mlEligibility·mlNewTasks 6개 포함).

| 항목 | 검증 | 결과 |
|---|---|---|
| P13 적격성 로직 | `mlEligibility(columns,rows)` 순수함수 | ✅ reg(≥2숫자)·clf/dt/nb(2~20클래스 범주형+숫자특성)·logit(one-vs-rest)·unsup(≥2숫자+행수) 규칙 |
| P13 게이팅(부적격) | kospi_stock(범주형 없음) | ✅ clf/dt/nb/logit **DOM 버튼 disabled** + 사유("2~20 클래스 범주형 목표 필요"), target "적격 대상 없음" |
| P13 Train 가드 | 부적격 상태 Train 클릭 | ✅ 버튼 disabled·클릭 무반응·**alert 없음**·크래시 없음 |
| P13 클래스 주석 | target 셀렉터 | ✅ "building_type (3 클래스)"·"district (12 클래스)" 표기 |
| P10 Logistic one-vs-rest | building_type(3클래스)+양성=아파트 | ✅ **AUC 0.79 ROC 렌더**, 기존 "binary target" 알림 완전 우회 |
| P10 Decision Tree | seoul 학습 | ✅ 크래시 없이 렌더(kind=dt) |
| P10 Naive Bayes | seoul 학습 | ✅ 크래시 없이 렌더(kind=nb) |
| P10 Cross Validation | k-NN + 5-fold 토글 | ✅ "Accuracy: 0.684 ± 0.026" 카드, test-split 70.3%와 일관 |
| 태스크 전환 result | reg 학습 → km 전환 | ✅ result 클리어·빈상태 렌더(과거 §0-0b "잔존" 관찰은 **오탐**이었음 — 이력 테이블 헤더 오인) |
| 콘솔 | 전 과정 | ✅ 에러 0 |

**개선 필요/재확인 관찰 (버그 아님, CLI 반영 후보)**:
- **① 부적격인데 선택 유지되는 태스크** — 범주형 있는 데이터에서 clf 선택 후 **숫자만 있는 데이터셋으로 전환**하면, clf 버튼이 disabled인데도 **주황 하이라이트(선택 상태) 유지** + 중앙은 일반 빈상태만 표시. → 데이터셋 전환 시 현재 태스크가 부적격이면 **적격 태스크로 자동 전환**하거나, 중앙에 "이 데이터로 이 분석 불가: {사유}"를 명시 권장.
- **② 분류 기본 target = district(12클래스)** — DT/NB 첫 학습이 12클래스 district에 걸려 정확도 ~10%(랜덤 8% 근처)로 나옴 → 초보자는 "모델이 고장?"으로 오해 가능. **최소 클래스 범주형(building_type 3클래스)을 기본 target으로** 하거나 정확도 옆에 "랜덤 기준선 N%" 병기 권장. (P13 "기본 target id 회피"는 반영됐으나, 저카디널리티 우선까지 가면 더 좋음)
- ③ (참고) 태스크 전환 시 result 초기화는 정상 작동 확인 — 이전 문서의 "잔존 패널" 관찰은 철회.

---

## 0-1. ~~🚨 P0 — 모드 전환 크래시 리그레션~~ ✅ 수정·검증 완료 (`4d402b9`)

> **해결됨**: app.jsx 8곳 함수호출 → JSX 엘리먼트 렌더 + 주석으로 규칙 명문화(HANDOFF에도 반영). §0-0 게이트 ①에서 왕복 16회 + 벽돌 시나리오 재현으로 해소 확인. 아래는 원인 기록(보존).

**증상**: Data → **Clean·SQL·Dashboard·ML·Stats** 전환 시 앱 전체가 블랙스크린으로 죽음. 게다가 **autosave가 오염된 `mode`를 영속화**하므로 리로드해도 부팅 즉시 재크래시 — 사실상 앱 벽돌화. (Viz·Pivot·Map은 안전)

**근본 원인** (2026-07-12 라이브 재현으로 확정):
1. **잠복 안티패턴** (Phase 1부터 존재): [`js/app.jsx`](../js/app.jsx) 61~76행이 모드 컴포넌트를 JSX 엘리먼트가 아닌 **일반 함수 호출**로 렌더 — `content = window.StatsMode()`. 이러면 모드 내부 훅이 전부 **App의 훅으로 계상**됨.
2. **발화점**: i18n Phase 1 (`83f411e` 등)이 5개 모드 export 최상위에 `useStore(s=>s.tweaks.lang)` 추가 → data 모드(App 훅 7개) ↔ 해당 모드(8개) 전환 시 훅 개수 변화 → React "Rendered more hooks" 크래시.
3. **ErrorBoundary 무력**: 경계가 content(자식)만 감싸는데 훅 오류는 **App 자신**에서 발생 → root unmount → 블랙스크린.
4. **벽돌화**: `mode`가 projectStore STATE_KEYS에 포함 → 크래시 직전 모드가 저장됨 → 재부팅 시 hydration 후 재렌더에서 동일 크래시 반복.

**수정 레시피** (한 가지만 해도 해결, 둘 다 권장):
- (근본) app.jsx 8곳을 엘리먼트 렌더로: `window.CleanMode()` → `<window.CleanMode />` — 각 모드가 자기 훅 스코프를 가짐.
- (방어) 부팅 hydration 시 렌더 불가 모드면 `data`로 폴백, ErrorBoundary가 잡은 크래시 모드는 저장에서 제외.

**사용자 복구법** (수정 전 벽돌 상태를 만났을 때): 개발자도구 콘솔에서
`Store.actions.setMode('data'); ProjectStore.saveNow();` 후 새로고침. (이번 검증 세션에서 이 방법으로 복구 완료 — 현재 저장 상태는 안전한 data 모드)

**왜 기존 검증을 통과했나**: Node 237/237·tsc 전부 그린 — 이 버그는 **React 렌더 규칙 위반**이라 정적 검사·단위테스트로는 안 잡힘. P11(Playwright E2E)의 "모드 전환 스모크"가 정확히 이걸 잡는 안전망.

---

## 0-2. 우선순위 요약

> ✅ = 처리 + 재검증 통과 (§0-0·§6). **P0~P9·P11·P13 완료 + DuckDB(P10 SQL) + P10 DT/NB/CV 완료. 남은 것: `feat/ml-expansion`→main 병합·push(CLI) → P12·§5 잠재 리스크 → P10 잔여(공유링크·PPT 매핑) → §0-0e 폴리시 2건**.

| # | 항목 | 분류 | 노력 | 효과 | 상태 |
|---|---|---|---|---|---|
| P0 | 모드 전환 크래시 (app.jsx 함수호출 렌더 × i18n 훅) | 버그 | 극소 | ★★★ | ✅ **수정·검증 완료** (`4d402b9`, §0-0 ①) |
| P1 | IndexedDB 리로드 왕복 검증 | QA | 소 | ★★★ | ✅ **완료** (§0-0 ④ — mode·스텝·편집값·열·rid 연속성 복원) |
| P2 | `main` 병합 게이트 + 태그 | 프로세스 | 소 | ★★★ | ✅ 완료 — 다음 병합분: `fix/mode-render-p0`→main (게이트 통과, CLI 수행). 원격 push 승인 대기 |
| P3 | 엔진 3종 UI 배선 (TSDecomp·Outliers·GeoMatch) | 기능 | 중 | ★★★ | ✅ **완료·시각검증 통과** (§0-0 ② — 계절분해 4단·다변량 17건 제거·Map 매칭) |
| P4 | `getActiveData` 메모이제이션 | 성능 | 소 | ★★★ | ✅ 완료·검증 (+HANDOFF 규약 `7f66bb3`) |
| P5 | 편집 op 견고성 3종 | 버그예방 | 소 | ★★ | ✅ 완료·검증 |
| P6 | `.gitignore`·문서 드리프트·구 훅 | 위생 | 극소 | ★★ | ✅ 완전 완료 |
| P7 | i18n 커버리지 (grid·data·pivot + 7모드 chrome) | UX | 중 | ★★ | ✅ 완료 — P0 발화점이었으나 P0 수정으로 구조 정상화 |
| P8 | 언가드 플레이스홀더 카피 | UX | 극소 | ★ | ✅ 완료·검증 |
| P9 | Excel식 편집 (붙여넣기·셀이동·Cmd+Z·범위선택) | 기능 | 중 | ★★ | ✅ **완료·상호작용 전수 통과** (§0-0 ③) |
| P10 | Planned 잔여 (~~DT/NB/CV~~·~~SQL JOIN~~·공유링크·PPT 매핑) | 기능 | 대 | ★★ | 부분 — **DT/NB/CV ✅완료·검증**(§0-0e), **SQL JOIN ✅DuckDB**(§0-0d). **공유링크·PPT 매핑만 잔여** |
| P11 | Playwright 스모크 E2E | QA | 중 | ★★ | ✅ **완료** — `tests/e2e/*` 13/13 통과(모드전환·un-bricking·ML·DuckDB·SQL). P0류 리그레션 안전망 구축 |
| P12 | 캐시버스트 `?v=` 자동화 | DX | 소 | ★ | 대기 (현 v269) |
| P13 | ML 데이터 적격성 검증 (태스크별 실행 가능 여부 + target 필터) | UX/버그 | 소~중 | ★★★ | ✅ **완료·검증**(§0-0e — 게이팅·클래스주석·Train가드·alert제거·one-vs-rest). 잔여 폴리시 2건(§0-0e 관찰 ①②) |

---

## 1. 다음 액션 (권장 순서 — CLI 세션용)

> Phase 3.5 게이트 + §0-0b + DuckDB(S1~S3) + P11 E2E + **P13·P10(DT/NB/CV) 전부 소화**. 남은 순서:

1. **`feat/ml-expansion` → main 병합·태그** — E2E **19/19** 통과. `--no-ff` + 태그. 원격 push는 별도 외부전송 승인. (브랜치 스택 `duckdb→ml-expansion` 순서 확인)
2. **§0-0e ML 폴리시 2건** (착수 쉬움·체감 큼): ① 데이터셋 전환 시 부적격 태스크 자동 전환/안내, ② 분류 기본 target을 최소 클래스 범주형으로. 둘 다 `mlMode.jsx`.
3. **§5 "몇 줄 수정" 3건** — beforeunload 저장(B2) · ECharts SRI(A3) · export 대상 명시(C4). (B3는 SQL 주경로 해소, formula/폴백만 잔여)
4. **P12**(캐시버스트 자동화) · **P10 잔여**(공유링크·PPT 매핑) · **§5 배포 전 필수**(A1 formula 안전파서 — 공유 기능 전).
4. **P10 잔여**(DT/NB/CV·공유링크·PPT 매핑) · **P12**(캐시버스트 자동화) · **§5 배포 전 필수**(A1 formula 안전파서 — 공유 기능 도입 전).

### 이전 검증에서 남긴 관찰 (버그 아님, CLI 참고 — 아직 미반영)
- **ML 기본 target이 `id`** — 회귀에서 무의미. numeric 중 분산 큰 컬럼을 기본값으로. (P13과 함께 처리 적합)
- **다변량 이상치 카드에 대상 컬럼명 미표시** — "17 · 4 열"만. 어떤 4열인지 툴팁 노출 권장.
- **계절분해 multiplicative 미클릭** — additive만 실측. multiplicative는 CLI/E2E에서 1회 확인 권장.
- **태스크 전환 후 이전 결과 화면 잔존** — 우측 작업 하이라이트와 불일치(§0-0b 부가 관찰). P13 UI 손볼 때 result 초기화 함께.

---

## 2. 완료 항목 상세 (재검증 근거)

### ~~P2. main 병합 게이트~~ ✅
`65754ab`(97커밋 merge) + `0c89626` + `checkpoint/core-v2` annotated tag 확인. 이후 i18n Phase 1도 `387705f`로 main 병합. 현재 `feat/analytics`는 main 대비 5커밋(P3 배선+P9). **원격 push만 외부전송 승인 대기.**

### ~~P3. 엔진 3종 UI 배선~~ ✅ 완료 (시각검증까지 통과 — §0-0 ②)
- `TSDecomp` → Stats›Time Series Decomposition 4단 차트 실렌더 ✓ (스크린샷)
- `Outliers` → Clean 이슈바 카드 17건 감지·제거·undo 왕복 ✓
- `GeoMatch` → Map 내 데이터 매칭 UI ✓

### ~~P4·P5·P6·P8~~ ✅ (2차 갱신에서 검증 완료 — §6 참조)
P4는 HANDOFF 유지규약 명문화(`7f66bb3`)까지, P6은 `auto-push.sh` 추적 해제(`9b6820d`)·`.claude/hooks` gitignore(`301ae06`)까지 완결.

### ~~P7. i18n~~ ✅ (기능 자체는 완결)
`13092a3`(grid·data·pivot, 80키+사전 대칭 테스트) + Phase 1a~1g(dash/clean/map/stats/ml/sql/ai chrome). `tests/i18n.test.js` 회귀 잠금.
⚠️ 단, 모드 export 최상위에 추가된 `useStore(lang)`가 app.jsx 안티패턴과 결합해 **P0를 유발** — P0 수정(엘리먼트 렌더)이 곧 이 구조의 정상화임.

### ~~P9. Excel식 편집~~ ✅ 완료 (상호작용 전수 통과 — §0-0 ③)
- `set_cells` 배치 op(`2aa9faa`) + 붙여넣기·셀이동·Cmd+Z·범위선택(`d469d78`), 테스트 +16 잠금
- **상호작용 실측 전부 통과**: paste 이벤트(2×2 TSV)→4셀 1스텝·1 undo / Enter↓·Tab→·↑ 이동 / 실키 Cmd+Z·Shift+Cmd+Z / Shift-클릭 5행 범위 + "5 selected" 바

---

## 3. 중기 (P10~P12)

### P10. CHANGELOG Planned 잔여 기능
1. **PPT 네이티브 차트 매핑 확장** (스택/보조축/캔들) — PptxGenJS 기반 이미 존재
2. **Decision Tree·Naive Bayes·Cross Validation** — ML 7종과 동일 패턴 (P13 적격성과 함께 하면 시너지)
3. ~~**SQL JOIN/window**~~ ✅ **Phase 4 DuckDB-WASM 전환으로 해소**(§0-0d) — 자체 파서 확장 논의 종료
4. **공유 링크** — 배포 전제, Phase 3 인접. **A1(formula 코드실행) 안전파서 선행 필수**

### ~~P11. Playwright 스모크 E2E~~ ✅ 완료
`tests/e2e/*.mjs` 5스펙 **13/13 통과**: modeSwitch(8모드+chaining+un-bricking) · mlTrain(reg·clf) · duckdb(CDN·JOIN+CTE) · duckdbTables(등록·교차·__rid) · sqlMode(자동실행·교차·bad query). `npm run test:e2e`(playwright.config.mjs). **확장 여지**: 편집→undo·피벗→차트·Export·계절분해 multiplicative 추가.

### P12. 캐시버스트 자동화
`?v=NNN` 수동 치환(현재 **v269**)을 `scripts/bump-assets.sh` 또는 커밋 훅으로.

---

## 4. 참고 — 검증에서 확인되어 조치 불필요한 것

- 피벗 필드 드롭 시 Import 모달 → 검증 도구 합성 이벤트 오발 (실사용 무관)
- aiDrawer null 가드 → 일반화되어 보존 / clean·vizSheets·pivotSheets 저장 포함 확인
- Node·tsc·자산·PptxGenJS SHA-256 → 전부 통과 이력 유지

---

## 5. 잠재 리스크 레지스터 — 지금은 괜찮지만 나중에 터질 수 있는 것

> 2026-07-12 코드 실사 기반. **현재 로컬 사용에서는 문제 없음** — 각 항목은 "터지는 조건"이 충족될 때 문제가 됨.
> 우선순위: **T1 = 배포/공유 전 필수** · T2 = 데이터/사용 규모 확대 시 · T3 = 품질/완성도.

### A. 배포·환경 (T1)

| 리스크 | 현재 상태 / 터지는 조건 | 영향 | 완화책 |
|---|---|---|---|
| **A1. formula column의 `new Function`** ✅ **해결** | ~~`store.jsx:297` — 임의 JS 실행~~ → `window.FormulaEval`(재귀하강 파서+트리워커, eval/new Function 없음)로 교체. `row.*` 읽기 + `Math.*` 화이트리스트만 허용, 프로토타입 체인(`constructor`/`__proto__`) 차단. `fix/a1-formula-safe-parser`, Node **307/307**(+12) · **E2E 22/22**(신규 formulaColumn — constructor 탈출·전역할당 무력화 실증) | ~~계정/세션 탈취급~~ → **공유 링크(P10) 보안 선행 완료** | ~~안전 파서로 교체~~ ✅. 잔여: 공유 기능 도입 시 CSP 병행 권장 |
| **A2. React development 빌드 배포** | `react.development.js` + Babel Standalone 인브라우저 트랜스파일. 로컬에선 감내 | 프로덕션 성능 수 배 저하·첫 로드 수 초·콘솔 경고 노출 | 배포 시 production UMD 교체 + JSX 사전 트랜스파일(esbuild 원샷이면 no-build 철학 유지 가능) |
| **A3. CDN 단일 장애점** (2026-07-12 갱신) | React/Babel은 SRI+버전고정 ✓. **ECharts SRI 없음**. **+DuckDB-WASM이 런타임 jsDelivr ESM 동적 import 추가**(수 MB, SRI 없음) — 단 **JS 폴백이 있어 오프라인서도 SQL은 동작**(JOIN/윈도우만 미지원). 앱 자체는 여전히 CDN 4+1종 의존 | 오프라인 시 SQL 고급기능 저하·첫 로드 지연. CDN 장애 시 앱 미기동 | ECharts SRI 추가, DuckDB 자산 로컬 vendoring(SheetJS 선례 2건), 폴백 배지로 사용자 고지 |
| **A4. `navigator.clipboard` HTTPS 요구** | 클립보드 복사(PPT용)가 secure context 전용. localhost는 예외라 **지금은 됨**. http:// 배포 시 조용히 실패(false 반환만) | 기능 무반응 — 사용자는 고장으로 인식 | 실패 시 "HTTPS 필요" 토스트 + PNG 다운로드 폴백 안내 |
| **A5. 최신 CSS 의존** | `oklch()`·`color-mix()`가 css 7개 파일에 분포. 차트색은 JS 변환으로 해결했지만 **CSS 자체는 미해결** — Safari <16.2 / Chrome <111에서 스타일 붕괴 | 구형 브라우저 레이아웃/색 깨짐 | 지원 브라우저 명시(README) 또는 빌드 시 폴백 생성. 최소한 지원선 문서화 |
| **A6. IndexedDB 영속성의 한계** | Safari ITP(7일 미사용 시 삭제)·시크릿 모드·스토리지 압박 축출. 사용자에게 고지 없음 | 프로젝트 통째 소실 → 신뢰 손상 | 첫 실행 시 "로컬 저장 한계 + JSON 백업 권장" 1회 안내, 주기적 백업 리마인드 |

### B. 데이터 무결성·동시성 (T1~T2)

| 리스크 | 현재 상태 / 터지는 조건 | 영향 | 완화책 |
|---|---|---|---|
| **B1. 다중 탭 last-write-wins** | 탭 락·storage 이벤트·BroadcastChannel 전무 (확인). 같은 프로젝트를 두 탭에서 열면 1초 autosave가 서로 덮어씀 | 한쪽 작업 통째 유실 (조용히) | Web Locks 또는 BroadcastChannel로 "다른 탭에서 열림" 경고. 최소: 탭 간 mtime 비교 후 덮어쓰기 확인 |
| **B2. `beforeunload` 저장 플러시 부재** | `visibilitychange(hidden)` flush만 존재(확인). 1초 디바운스 창에서 탭 강제종료·크래시 시 마지막 편집 유실 | 마지막 1초 내 편집 소실 | `beforeunload`에도 saveNow 추가 (logger엔 이미 있음 — 패턴 복사) |
| **B3. 한글/특수문자 컬럼명 상호운용** (2026-07-12 **대폭 축소**) | **SQL 주경로는 DuckDB로 해소** — 따옴표 식별자 `"구역"` 실측 정상(§0-0d). **잔여**: ① DuckDB 실패 시 폴백하는 구 `runSQL` 파서(`[\w]+`)는 여전히 한글 불가 ② formula column `row.한글`/공백 이름 접근 불가 | 폴백 상황·formula에 한정 (일반 SQL은 해결) | 폴백 파서 유니코드화 또는 폴백 시 안내, formula는 `row["이름"]` 문법 지원 |
| **B4. undo 스택 무한 성장** | 셀 편집 1회 = 스텝 1개 영구 축적. 긴 세션(수백 편집) 시 applySteps 재생 비용·autosave 페이로드·프로젝트 JSON 크기 비례 증가 | 점진적 저하 — 어느날 "느려졌다" | 연속 set_cell 병합(같은 셀), 스텝 수 상한+베이스라인 스냅샷 압축 |

### C. 인터랙션·UI (T2~T3)

| 리스크 | 현재 상태 / 터지는 조건 | 영향 | 완화책 |
|---|---|---|---|
| **C1. 전역 리렌더 store** | `useStore`가 selector **비교 없이** 모든 setState에 전 구독 컴포넌트 force render (확인). 지금은 페이지당 100행이라 감내 | 위젯 많은 대시보드·대형 그리드에서 타이핑 지연·전역 버벅임 | selector 결과 얕은 비교 후 skip (10줄 내), 장기: 그리드 가상화 |
| **C2. 싱글클릭 = 즉시 편집** | 편집 모드에서 셀 클릭이 곧 에디터 오픈 — "선택"과 "편집" 미구분. P9 범위선택·복사 UX와 충돌 예정 | 복사하려다 실수 편집, Excel 관례와 상충 | Excel 관례로: 클릭=선택, 더블클릭/F2/타이핑 시작=편집 (P9 마무리 때 함께 결정 권장) |
| **C3. `alert()`/`confirm()` 네이티브 다이얼로그** | rename 충돌 alert, dummy encode confirm 등. iframe/임베드·자동화 환경에서 블로킹, 브랜드 UX 이질 | 임베드 배포 시 UX 파손 | 인앱 토스트/다이얼로그 컴포넌트로 점진 교체 |
| **C4. `Charts.lastInst` 전역 export 대상** ✅ **해결** | ~~Export가 "마지막 렌더된 차트 인스턴스" 기준~~ → EChart `onInst` 콜백으로 각 차트가 자기 인스턴스 노출, export 헬퍼(PNG/SVG/copyPNG)에 optional `inst` 인자 추가(생략 시 lastInst 폴백=하위호환). Chart 모드는 `chartInstRef`로 명시 대상화. `fix/c4-export-target`(`392ece0`·`1f49f82`·`8c1cf8b`), **E2E 22/22**(신규 chartExport) | ~~잘못된 차트가 PPT/PNG로~~ | ~~export 진입점에서 대상 명시~~ ✅ |
| **C5. 함수호출 렌더 재발 위험** | P0 수정 전까지: 아직 안전한 Viz·Pivot·Map도 최상위 훅 1개 추가되는 순간 동일 크래시 | P0 재발 | P0 수정(JSX 엘리먼트化)이 곧 원천 차단. HANDOFF 규칙에 "모드는 엘리먼트로 렌더" 명문화 |
| **C6. 접근성 부재** | 포커스 트랩·aria·키보드 내비 없음. 개인 도구론 무방 | 조직 배포·감사 요구 시 큰 공사 | 당장은 범위 밖 명시. 신규 모달부터 포커스 트랩 관례 적용 |
| **C7. 라이트 테마 검증 공백** | 최근 기능(피벗·서식 패널·SPC·Export 메뉴) 다크에서만 검증됨 | 라이트 전환 시 대비 부족·하드코딩 색 노출 가능 | E2E(P11)에 라이트 테마 스크린샷 1패스 포함 |
| **C8. 소형 화면 레이아웃** | 고정 레일 + 좌우 패널. 1280px 미만·노트북 반화면 미검증 | 패널 겹침/잘림 | 최소 지원 폭 정의 + 그 이하에서 패널 접기 |

### D. 성능·규모 (T2)

| 리스크 | 현재 상태 / 터지는 조건 | 영향 | 완화책 |
|---|---|---|---|
| **D1. 전량 인메모리 + 복제 파이프라인** | applySteps가 전 행 복제. 메모(P4)로 재계산은 줄었지만 **XLSX 수십만 행 임포트 시** 복제 1회 자체가 수백 MB | 탭 OOM·프리즈 | Batch F 규모 경고를 하드 가드로(행수 상한+샘플링 제안), 장기 DuckDB-WASM |
| **D2. Babel 트랜스파일 시간** | JSX 22개 파일을 매 로드마다 브라우저에서 컴파일 | 첫 화면까지 수 초(저사양 배가) | A2와 동일 — 사전 트랜스파일 |

### 요약 — 트리거별 체크리스트

- **공유/링크/배포 결정 시**: ~~A1(수식 실행)~~ ✅ → A2(dev 빌드) → A4(HTTPS) → C3(다이얼로그) 순으로 먼저.
- **XLSX 대용량 사용 시작 시**: D1 → B4 → C1.
- **팀/다중 기기 사용 시작 시**: B1 → A6 → B2.
- **지금 코드 몇 줄로 싸게 막을 수 있는 것**: B2(beforeunload 1줄) ✅ · A3(ECharts SRI 1속성) ✅ · B3(정규식 유니코드화) ✅ · **C4(export 대상 명시) ✅ 해결**.

---

## 6. 재검증 기록

### 6차 — 2026-07-12 (P13 ML 적격성 + P10 DT/NB/CV — `feat/ml-expansion`)

대상: `1b58e1f`…`32821b5`. 상세표는 §0-0e. 요약:
- 정적: Node **288/288** · tsc 0 · 신규엔진(crossVal·decisionTree·naiveBayes) 구문 0 · 자산 0 (v275)
- 라이브: 적격성 게이팅(kospi 부적격 버튼 disabled+사유) · 클래스주석 · Train가드 · Logistic one-vs-rest(AUC 0.79) · DT·NB 렌더 · CV(0.684±0.026)
- **E2E 19/19**(신규 mlEligibility 3 + mlNewTasks 3 포함) · 콘솔 0 · 종료 시 정리·저장
- 관찰: §0-0e 폴리시 2건(부적격 선택 유지·기본 target 고카디널리티). 과거 "태스크 전환 잔존 패널"은 오탐으로 철회.

### 5차 — 2026-07-12 (§0-0b ML 수정 + Phase 4 DuckDB S1~S3 — `feat/duckdb`)

대상: `54b2e18`(ML 크래시) … `1f857f1`(Phase 4 완주). 방법: 정적 + 라이브 브라우저 + Playwright E2E.

| 검증 | 결과 |
|---|---|
| 정적 | Node **245/245** · JSX tsc 0 · `.mjs` 구문 0 · 자산 누락 0 (v269) |
| ML §0-0b | Regression→R²·RMSE·차트, k-NN→Confusion 둘 다 크래시 없이 렌더, 콘솔 0 (`res.feats?.[0]` 수정 확인) |
| DuckDB S1 | `window.DuckDB.status="ready"`, SQL 자동실행 "20행·DuckDB-WASM" |
| DuckDB S2 | 7데이터셋 테이블 등록, JOIN(seoul⋈district) + 윈도우(RANK/QUALIFY) 정상 — 구 파서 불가 기능 |
| DuckDB B3 | 한글 컬럼 `"구역"` 따옴표 식별자 쿼리 정상 |
| DuckDB S3 | JS 폴백 코드 확인, bad query=에러(E2E) |
| **E2E** | `npx playwright test` **13/13 통과 (30초)** — modeSwitch·mlTrain·duckdb·duckdbTables·sqlMode |
| 종료 | ML 결과 클리어 + data 모드 저장(깨끗) |

### 4차 — 2026-07-12 (Phase 3.5 브라우저 게이트 — `fix/mode-render-p0`)

전체 결과표는 §0-0. 보충 사항:
- 사전 정적 검증: Node 237/237 · tsc TS1xxx 0 · 자산 참조 누락 0 (v265) · P0 수정 diff 리뷰(8곳 엘리먼트 렌더 + 재발방지 주석)
- 콘솔 에러: 검증 세션 전체 **0건** (리로드 3회 포함)
- 검증 방법 특기: paste는 `ClipboardEvent+DataTransfer` 실이벤트, Cmd+Z/Shift+Cmd+Z는 실키 입력, 벽돌화 재현은 "위험 모드 저장→리로드" 원시나리오 그대로
- 종료 시 테스트 흔적 전량 정리(clearSteps + data 모드 저장) — 아침에 깨끗한 상태

### 3차 — 2026-07-12 (i18n Phase 1 · P3 배선 · P9 · main 병합 검증)

대상: `7f66bb3`…`f4285cc` (20커밋). 방법: 정적 검증 + 라이브 브라우저 실측.

| 검증 | 결과 |
|---|---|
| Node 테스트 | **237/237 pass** (i18n·gridPaste·storeEdit +16) |
| tsc 구문 / 자산 참조 / git status | 0 오류 / 누락 0 (**v264**) / clean |
| main 병합 | `65754ab`·`387705f` + `checkpoint/core-v2` 태그 확인 |
| P9 실측 | `editCells` 2셀 → 1스텝·양쪽 반영·undo 1번 전체복원 ✓, TSV 파서 ✓ |
| P3 배선 | 3엔진 모드 파일 참조 확인 ✓, Map/GeoMatch UI 표시 ✓ |
| **P0 발견** | data→stats 전환 → **블랙스크린** 재현. 원인 훅 추적(`83f411e`가 StatsMode 최상위 useStore 추가 × app.jsx 함수호출 렌더). 5개 모드 최상위 훅 grep로 영향 범위 확정. autosave 영속화로 리로드 후에도 재크래시 확인 → `setMode('data')+saveNow`로 복구 |
| 종료 상태 | 앱 정상(data 모드 저장), 콘솔 잔존 에러는 크래시 시점 기록분 |

### 2차 — 2026-07-12 (P4·P5·P6·P8)

| 검증 | 결과 |
|---|---|
| Node 221/221 · tsc 0 · v254 · status clean | 통과 |
| P4 실측 | 동일 입력 → 동일 참조, editCell 후 무효화 |
| P5 실측 | rename 충돌 no-op · invalid 숫자→null · isComposing 2곳 |
| P6·P8 | `.DS_Store` 추적 0 · 경로/플랜헤더 정정 · 카피 교체 |

---

## 7. P13 — ML 데이터 적격성 검증 (사용자 발의, 2026-07-12)

> **✅ 구현·검증 완료** (`1b58e1f`·`b356ec6`, §0-0e). `mlEligibility`로 태스크 게이팅+클래스주석+Train가드+alert제거, Logistic one-vs-rest까지. 아래는 원안 기록(보존) — 잔여 폴리시 2건은 §0-0e 관찰.
>
> 발단: "`Logistic needs a binary target (exactly 2 classes)` 알림이 계속 나온다. 이 데이터로 **어떤 모델을 돌릴 수 있는지 검증하는 로직**이 필요하다."
> 진단 결과 **정당한 지적** — 당시 사후 `alert()`만 있고 사전 적격성 검사가 전무했음. 아래는 근거·설계·CLI 구현 가이드(구현됨).

### 문제 (코드·데이터 실측)

`js/mlMode.jsx`:
- `targets = (task==='clf'||task==='logit') ? catCols : numCols` — **카디널리티 무관하게** 모든 범주형을 target 후보로 나열(`400~408행`).
- Logistic 엔진은 정확히 2클래스 요구(`113행`), 실패 시 throw → `train()` catch에서 **`alert(err.message)`** (`437행`)만. 사전 차단·비활성화·안내 없음.
- 결과: 유효 target이 없어도 태스크·target 선택이 다 열려 있고, **학습 눌러야 비로소 알림**. 반복 발생.

**결정적 근거 — 샘플 데이터 전수 스캔(binary 범주형 개수)**:

| 데이터셋 | 범주형(고유값) | binary(2클래스) |
|---|---|---|
| seoul_txns | district(12)·building_type(3)·complex_name(409)… | **0** |
| monthly_index | month(42) | 0 |
| kospi_stock | date(320) | 0 |
| district_stats | district(12) | 0 |
| world_gdp | country(30)·region(6) | 0 |

→ **기본 제공 7개 데이터셋 어디에도 binary 범주형이 없음** = Logistic + ROC는 현재 상태로 **성공 불가능한 태스크**인데도 버튼·target이 정상처럼 노출됨. (building_type 3클래스가 최근접)

### 제안 설계 — "데이터가 정하는 실행 가능성"

**A. 태스크별 적격성 함수 (순수, 테스트 가능)** — `js/mlCfg.js`에 `mlEligibility(columns, rows)` 추가:
태스크마다 `{ ok, reason, validTargets }`를 반환.

| 태스크 | 적격 조건 |
|---|---|
| Regression | 숫자 target ≥1 **AND** 숫자 특성 ≥1 |
| k-NN Classify | 범주형 target(2~약20 클래스) ≥1 AND 숫자 특성 ≥1 |
| Logistic + ROC | **정확히 2클래스** 범주형 target ≥1 AND 숫자 특성 ≥1 |
| PCA/KMeans/DBSCAN/Hier | 숫자 컬럼 ≥2 AND 행 ≥ (k 또는 minPts) |

**B. UI 반영 (3단 방어)**:
1. **태스크 버튼**: 부적격이면 비활성(dim) + 배지/툴팁("binary 대상 없음", "숫자 열 2개 필요"). 발 들이기 전에 차단.
2. **target 셀렉터**: 태스크에 맞는 컬럼만 나열하고 **클래스 수 주석** — 예 `building_type (3 클래스)`. logit이면 2클래스만, 없으면 "적격 대상 없음" placeholder + Train 비활성.
3. **Train 버튼**: `eligibility.ok===false`면 disabled + 사유 인라인 표시. **`alert()` 제거**(§5 C3 리스크 동시 해소 — 임베드/자동화서 alert는 블로킹·무반응).

**C. (선택) 데이터 준비도 요약**: 패널 상단에 "이 데이터로 가능한 분석: PCA·KMeans·DBSCAN·Hier·Regression·k-NN / 불가: Logistic(2클래스 대상 없음)" 한 줄.

### 보너스 — Logistic을 실데이터로 쓰게 만들기 (범위 판단 필요)
검증만 하면 "logit은 영원히 비활성"이 됨. 실사용 길을 하나 열어주면 좋음(둘 중 택1, P10 후보):
- **(권장) 양성 클래스 선택으로 이진화**: 다중클래스 target + "양성 클래스" 드롭다운 → one-vs-rest. 예 `building_type` + 양성=`아파트` → 아파트 vs 나머지. 엔진 `Logistic.fit`은 그대로, 라벨 전처리만 UI에서.
- (대안) 숫자 컬럼 임계값 이진화: `price_manwon > 중앙값` → 고가/저가.

### CLI 구현 순서 제안
1. `mlCfg.js`에 `mlEligibility` 순수 함수 + `tests/mlCfg.test.js`에 케이스(binary 유무·숫자열 수·행수 경계) 추가 — 정적 회귀 잠금.
2. `mlMode.jsx`: 태스크 버튼 `disabled`·target 필터/클래스주석·Train 가드·alert 제거. (§0-0b 렌더 크래시 수정과 같은 파일이라 **함께 처리 효율적**.)
3. E2E(P11)에 "부적격 태스크 비활성·target 주석" 어서션 1개.

> **관계**: §0-0b(reg/clf 렌더 크래시)와 별개 이슈지만 같은 파일·같은 세션 수정 대상. §5 C3(alert 리스크)도 B-3에서 함께 해소됨.
