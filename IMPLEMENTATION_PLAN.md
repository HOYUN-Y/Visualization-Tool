# insight Analytics Workbench — Implementation Plan

> **Plan version:** `core-v2-plan-v5`
> **Status:** Core v2 **완료** (`v2.0.0`, 2026-07-12) · T1 하드닝 배치 1차 완료 (2026-07-17) · 잔여는 [§12 하드닝 백로그](#12-하드닝-백로그-core-v2-이후-잔여)
> **Updated:** 2026-07-17
> **Canonical scope:** **이 문서가 계획의 정본이다.** 무엇을 왜 어떤 순서와 기준으로 구현하는지 정의한다. 현재 진행 위치와 다음 행동은 `WORKLOG.md` 상단을 따른다.

**문서 지도**

| 문서 | 역할 |
|---|---|
| **`IMPLEMENTATION_PLAN.md`** (이 문서) | **계획 정본** — 앞으로 할 일. §4~§9는 완료된 Core v2 마일스톤 이력, §12가 살아있는 백로그 |
| `WORKLOG.md` | 현재 상태 + 완료 기록 + **릴리스 이력**(2026-07-17 `CHANGELOG.md` 통합). 세션 시작 시 상단부터 읽는다 |
| `HANDOFF.md` | 코드 아키텍처 |
| `README.md` | 사용자용 개요 |
| `docs/archieve/FOLLOWUP_PROPOSALS.md` | **폐기** — 다른 모델의 제안 문서. 2026-07-17에 §12와 WORKLOG로 분해 흡수. 참조하지 말 것 |

> ⚠️ **세션 시작 전 필수** — 이 문서는 클론의 로컬 상태일 뿐 프로젝트의 진실이 아니다. 먼저 실행할 것:
> ```bash
> git fetch origin && git status -sb
> ```
> `behind`가 0이 아니면 **문서를 신뢰하기 전에 동기화한다.** 2026-07-17에 낡은 클론이 6일 전 완료된 작업을 재구현하려던 사고가 있었다(`WORKLOG.md` 상단 참조).

---

## 1. 목표와 확정 결정

> ✅ **이 절의 목표는 2026-07-12 달성됐다 (`v2.0.0` 태그).** 아래 구현 순서 6단계는 전부 완료돼 **이력**이다. 살아있는 작업은 [§12 하드닝 백로그](#12-하드닝-백로그-core-v2-이후-잔여).
> **운영 원칙 중 "승인 전에는 다음 기능 브랜치를 시작하지 않는다"는 Core v2 한정으로 종료됐다** — 백로그 항목에는 적용되지 않는다. (2026-07-17에 이 규칙을 완료된 마일스톤에 적용하려다 혼선이 있었다.)

현재 no-build 브라우저 앱에서 실제 업무에 필요한 핵심 제품 기능을 완성한 뒤 `v2.0.0`으로 동결한다.

구현 순서:

1. 다중 프로젝트 저장·복원 — IndexedDB + JSON
2. XLSX Import와 결정적 타입 추론
3. Union/Join 데이터 결합
4. Pivot Table Builder
5. Dashboard 위젯 설정과 안전한 KPI 수식
6. 통합 안정화와 `v2.0.0`

확정된 운영 원칙:

- 현재 `window.*` + in-browser Babel 구조에서 Core v2를 완성한다.
- 기능별 브랜치와 2~4개 단일 책임 커밋을 사용한다.
- 각 기능은 사용자 승인 후에만 `main`에 `--no-ff` 병합한다.
- 승인 전에는 다음 기능 브랜치를 시작하지 않는다.
- 제어 가능한 브라우저가 세션에 제공되지 않으면 자동 검증 통과와 사용자의 명시적 진행 지시로 기능 체크포인트 병합은 허용하되, 미실행 브라우저 시나리오는 `v2.0.0` 릴리스 차단 항목으로 유지한다.
- 자동 push는 사용하지 않는다.
- 고급 ML·시계열·SPC·실제 LLM·Next.js/FastAPI 전환은 Core v2 범위에서 제외한다.

---

## 2. 문서와 세션 인계 규칙

문서 우선순위:

1. `IMPLEMENTATION_PLAN.md` — 승인된 범위·설계·테스트·커밋 계획
2. `WORKLOG.md` 상단 — 현재 milestone, 브랜치, 마지막 체크포인트, 다음 행동 (하단은 릴리스 이력)
3. `HANDOFF.md` — 현재 코드 아키텍처
4. `README.md` — 사용자용 개요
5. `prompt.txt` — 최초 아이디어 참고용이며 현재 기준이 아님

세션 시작 절차:

```bash
sed -n '1,120p' IMPLEMENTATION_PLAN.md
sed -n '1,100p' WORKLOG.md
git status --short --branch
git log -5 --oneline --decorate
```

체크포인트 규칙:

- 안전한 중간 지점마다 코드와 WORKLOG 상태를 함께 커밋한다.
- 세션 종료나 컨텍스트 압축 전 완성되지 않은 상태는 기능 브랜치에 `wip(<feature>): checkpoint before handoff`로 기록한다.
- WIP 커밋은 테스트 상태와 다음 정확한 행동을 WORKLOG에 남기며 `main`에 병합하지 않는다.
- WORKLOG에 기록한 커밋은 amend/rebase하지 않는다.
- 계획 변경은 이 문서 하단 Plan Revision에 승인 사유를 기록하고 plan version을 올린다.

---

## 3. Git 체크포인트 전략

계획 기준점:

- Branch: `docs/core-v2-planning`
- Commits:
  1. `docs: sync current implementation status and roadmap`
  2. `docs(plan): add Core v2 implementation plan and restructure worklog`
  3. `chore(git): disable legacy auto-push workflow`
- Merge tag: `checkpoint/core-v2-plan`

기능별 병합 후 annotated tag:

- `checkpoint/project-persistence`
- `checkpoint/xlsx-import`
- `checkpoint/data-combine`
- `checkpoint/pivot-builder`
- `checkpoint/dashboard-builder`
- 최종 release tag: `v2.0.0`

공유된 `main`의 롤백은 reset이 아니라 다음 방식으로 수행한다.

```bash
git revert -m 1 <merge-commit>
```

---

## 4. Milestone 1 — 프로젝트 저장·복원

**Branch:** `feat/project-persistence`

### 저장 모델

IndexedDB `insight-workbench`, schema version 1:

- `projects`: 프로젝트 메타데이터, Store 상태, 분석 이력
- `datasets`: `projectId:datasetId` 키로 데이터셋 저장
- `settings`: 마지막 프로젝트 ID

Portable JSON:

```js
{
  schemaVersion: 1,
  exportedAt,
  project: { id, name, createdAt, updatedAt },
  state: { theme, mode, activeId, ui, clean, viz, pivot, dash, tweaks },
  datasets: [],
  analysis: { mlHistory, lastAnalysisResult }
}
```

### 동작

- 첫 실행 시 현재 기본 데이터로 `Untitled Project` 생성
- 프로젝트 생성, 열기, 이름 변경, 복제, 삭제, 최근 프로젝트 복원
- Store 변경 후 1초 debounce 자동저장
- `visibilitychange` 시 저장 flush
- Save 버튼을 `Save now`로 연결
- `Saved / Saving / Unsaved / Error` 상태 표시
- JSON Export/Import 및 schema validation
- 동일 project ID Import 시 새 ID로 복제
- 미래 schema version은 명시적으로 거부
- `ui.aiOpen`과 세션 로그는 저장하지 않음
- Hydration 시 `__rid` 시퀀스를 저장된 최댓값 이후로 복원

### 공개 인터페이스

- `Store.subscribe(listener)`
- `Store.actions.hydrateProject(bundle)`
- `Store.actions.registerDataset(dataset, { activate })`
- `Store.actions.removeDataset(id)`
- `window.ProjectStore`: `init`, `list`, `create`, `open`, `rename`, `duplicate`, `remove`, `saveNow`, `exportJSON`, `importJSON`, `getStatus`

기존 `NODE.datasets.push()` 경로는 모두 `registerDataset()`으로 교체한다.

### 커밋

1. `feat(project): add versioned IndexedDB project repository`
2. `refactor(store): centralize dataset registration and project hydration`
3. `feat(project): add project library autosave and JSON backup`
4. `test(docs): verify persistence and update worklog checkpoint`

---

## 5. Milestone 2 — XLSX Import와 타입 추론

**Branch:** `feat/xlsx-import`

SheetJS CE `0.20.3`의 `xlsx.full.min.js`를 로컬 벤더 파일로 고정하고 라이선스와 SHA-256을 기록한다.

### 동작

- CSV/TSV/JSON/XLSX 공통 `ImportEngine`
- TopBar와 Data Explorer Drop 영역이 같은 흐름 사용
- XLSX 시트명, 범위, 예상 행/열, 첫 20행 Preview
- 하나 이상의 시트를 선택해 시트별 별도 데이터셋 생성
- Import 전 컬럼 타입 override
- 중복 데이터셋명 `_2`, `_3` 처리
- Import 완료 후 프로젝트 자동저장

### 타입 추론 순서

1. 빈 문자열 → `null`
2. `true/false/yes/no` → boolean
3. 선행 0 코드가 아닌 정수 → integer
4. 유한 소수 → float
5. ISO 날짜 또는 XLSX Date cell → datetime
6. 고유값 ≤30, 고유 비율 ≤20% → category
7. 나머지 → string

CSV는 원문 문자열로 먼저 읽어 우편번호·상품코드의 선행 0을 보존한다.

### 공개 인터페이스

- `ImportEngine.parseFile(file)`
- `ImportEngine.inspectWorkbook(file)`
- `ImportEngine.inferColumns(rows)`
- `ImportEngine.materialize(selection, overrides)`

### 커밋

1. `vendor(xlsx): pin SheetJS CE 0.20.3 standalone build`
2. `refactor(import): centralize parsers and deterministic type inference`
3. `feat(import): add workbook preview and multi-sheet import`
4. `test(docs): verify import formats and update worklog checkpoint`

### Milestone 2 체크포인트 및 다음 작업 절차

2026-07-11 구현 체크포인트:

- `b369ba8` — SheetJS CE 0.20.3 vendor, Apache-2.0 license, SHA-256
- `3b336c3` — 공통 ImportEngine, 결정적 타입 추론, Node fixtures
- `120c1c8` — Workbook preview, 복수 시트 선택, 타입 override UI
- 자동 검증: Node 10/10, Babel 17/17, local assets 36/36, index/runner HTTP 200

다음 세션은 아래 순서를 그대로 따른다.

1. `feat/xlsx-import`와 `WORKLOG.md` 상단 상태를 확인하고 `node --test tests/*.test.js`, `git diff --check`를 재실행한다.
2. 제어 가능한 Chromium에서 `tests/runner.html` 3/3 통과를 확인한다.
3. 앱 Import modal에서 CSV 선행 0 보존, XLSX 2개 이상 시트 Preview/선택, 타입 override, 중복 이름 suffix, Import 후 새로고침 복원을 검증한다.
4. 실패 시 이 브랜치에서 수정·회귀 테스트·WORKLOG 기록 후 새 체크포인트를 만든다. 성공 시 사용자에게 결과를 보고하고 승인 게이트에서 대기한다.
5. 승인 후에만 `main`에 `--no-ff` 병합하고 annotated tag `checkpoint/xlsx-import`를 생성한다.
6. 최신 `main`에서 `feat/data-combine`을 생성하고 WORKLOG를 Milestone 3 상태로 전환한다. 원격 push는 사용자의 명시적 외부 전송 승인 후 수행한다.

---

## 6. Milestone 3 — Union/Join

**Branch:** `feat/data-combine`

Data 모드에 `Combine datasets` 모달을 추가한다.

Union:

- 2개 이상 데이터셋 선택
- 컬럼 key 기준 정렬, 첫 데이터셋 컬럼 순서 유지
- 없는 값은 null
- 타입 충돌은 `boolean → integer → float → string` 승격
- 선택적으로 `__source` 컬럼 추가

Join:

- 정확히 2개 데이터셋
- Inner/Left/Right/Full Outer
- 복수 키 매핑
- null 키는 매칭하지 않음
- 숫자·날짜·문자열 정규화 비교
- many-to-many 허용, 확정 전 예상 행 수와 폭증 경고
- 우측 중복 컬럼은 `<rightShort>__<column>`으로 변경
- 첫 100행 Preview

결과는 동적 recipe가 아닌 새 데이터셋으로 materialize한다.

```js
lineage: {
  op: "union" | "join",
  sourceIds: [],
  joinType?,
  keyPairs?,
  createdAt
}
```

### 공개 인터페이스

- `DataOps.union(datasets, options)`
- `DataOps.join(left, right, options)`
- `DataOps.preview(operation)`

### 커밋

1. `feat(combine): add pure union and join engines`
2. `feat(combine): add dataset combination preview workflow`
3. `feat(combine): materialize results with lineage metadata`
4. `test(docs): verify combine matrix and update worklog checkpoint`

---

## 7. Milestone 4 — Pivot Table Builder

**Branch:** `feat/pivot-builder`

Rail에 Pivot 모드를 추가한다.

### 동작

- Rows, Columns, Values, Filters 드래그앤드롭
- Rows/Columns 복수 필드
- Values 복수 measure와 개별 집계
- Sum, Avg, Count, Count Distinct, Median, Min, Max
- 범주 필터와 숫자 범위 필터
- 행/열 Grand Total
- 복수 Column 차원은 평탄화된 헤더 사용
- 새 데이터셋 저장 및 Chart 모드에서 열기
- Pivot 설정을 프로젝트에 저장
- null과 빈 그룹 안전 처리

```js
pivot: {
  rows: [],
  columns: [],
  values: [{ key, agg, label }],
  filters: []
}
```

### 공개 인터페이스

- `PivotEngine.build(rows, columns, spec)`
- `PivotEngine.toDataset(result, name)`

### 커밋

1. `feat(pivot): add deterministic pivot aggregation engine`
2. `feat(pivot): add drag-and-drop Pivot workspace`
3. `feat(pivot): save results and open them in Chart mode`
4. `test(docs): verify pivot behavior and update worklog checkpoint`

---

## 8. Milestone 5 — Dashboard 설정과 KPI Builder

**Branch:** `feat/dashboard-builder`

선택한 위젯을 우측 Inspector에서 편집한다.

- 공통: 제목, 위치, 크기
- Chart: 타입, Dimension, Measure/집계, Color, Top N
- KPI: 라벨, 계산식, 형식, 단위, 소수 자릿수
- Table: Dimension, Measure/집계, 행 제한
- Text: 일반 텍스트 편집

`dangerouslySetInnerHTML`을 제거하고 기존 `spec.html`은 로딩 시 태그를 제거해 `spec.text`로 변환한다.

안전한 KPI 문법:

```text
SUM(field) AVG(field) COUNT(*) COUNTD(field)
MIN(field) MAX(field) MEDIAN(field)
+ - * / ( ) 숫자 리터럴
```

예: `SUM(profit) / SUM(revenue) * 100`

`eval`과 `new Function`은 사용하지 않는다. 잘못된 컬럼, 문법 오류, 0 나누기는 `—`와 Inspector 오류로 표시한다. KPI는 Cross Filtering 이후 행을 기준으로 계산한다.

Image, Annotation, 기준선, Dashboard PDF는 Core v2에서 제외한다.

### 공개 인터페이스

- `KPIFormula.parse(expression)`
- `KPIFormula.evaluate(ast, rows, columns)`
- Dashboard state에 `selectedWidgetId`와 확장 widget spec 추가

### 커밋

1. `feat(kpi): add safe aggregate formula parser and evaluator`
2. `feat(dashboard): add widget configuration inspector`
3. `refactor(dashboard): migrate text widgets and persist builder state`
4. `test(docs): verify dashboard restoration and update worklog checkpoint`

---

## 9. 통합 안정화와 v2.0.0

**Branch:** `release/core-product-v2`

End-to-end 흐름:

```text
프로젝트 생성 → XLSX Import → Join → Pivot → Chart → Dashboard/KPI
→ 자동저장 → 브라우저 재시작 → 상태 복원 → 프로젝트 JSON Export/Import
```

추가 작업:

- 기존 Data/Clean/SQL/Chart/Map/Stats/ML 회귀 검증
- quota 초과, 손상 JSON, 빈 XLSX, Join 폭증 오류 처리
- UI의 가짜 XLSX/DB/DuckDB 표기를 실제 상태와 일치시킴
- 전체 문서 동기화
- 앱 버전을 `v2.0.0`으로 통일

커밋:

1. `fix(core): resolve integrated project workflow regressions`
2. `docs(release): document core product v2 and close worklog milestone`

최종 태그: `v2.0.0`

---

## 10. 테스트와 승인 기준

no-build `tests/runner.html`과 고정 fixture를 사용한다.

각 체크포인트에서:

- `git diff --check`
- HTML 파싱
- 브라우저 콘솔 오류 0건
- 기존 모든 모드 진입
- 새로고침 전후 프로젝트 상태 비교
- JSON Export/Import round trip
- CSV/TSV/JSON/XLSX 행·열·타입 검증
- Inner/Left/Right/Full Join 검증
- Pivot 다중 값·필터·Grand Total 검증
- KPI 수식과 Cross Filtering 재계산 검증
- Clean Undo/Redo와 `__rid` 안정성 검증
- WORKLOG의 다음 행동이 실제 Git 상태와 일치하는지 검증

주 대상은 최신 데스크톱 Chromium이다. `v2.0.0` 전 Firefox와 Safari에서 저장·Import·Pivot 기본 흐름을 추가 확인한다.

세션에 제어 가능한 브라우저가 없을 때는 Node 테스트, Babel/HTML 파싱, 전체 로컬 자산 HTTP 200을 재검증하고 제한을 `WORKLOG.md`에 기록한다. 사용자가 계속 진행을 명시한 경우 체크포인트 병합은 가능하지만, IndexedDB/다운로드/새로고침 왕복 테스트를 통과한 것으로 간주하지 않으며 release branch에서 반드시 실행한다.

---

## 11. 명시적 제외

> ⚠️ **이 절은 `core-v2-plan-v1`(2026-07-10) 기준이며 일부는 이미 뒤집혔다.** 아래 취소선 항목은 Core v2 이후 실제로 구현·병합됐다. 이력 보존을 위해 원문을 남긴다.

- ~~Next.js/FastAPI/DuckDB 전환~~ → **DuckDB-WASM은 구현·병합됨**(Phase 4 S1~S3, `v2.0.0`). SQL 모드가 DuckDB에서 실행되며 JS 폴백 보유. Next.js/FastAPI 전환은 여전히 제외.
- Versioned Snapshot
- 노드 기반 Pipeline/Lineage
- 실제 LLM과 NL→SQL
- ~~고급 ML/PCA~~ → **구현·병합됨**: PCA·Decision Tree·Naive Bayes·Logistic(one-vs-rest)·Cross Validation·DBSCAN·Hierarchical
- ~~시계열/SPC/DOE~~ → **시계열(분해·ACF/PACF)·SPC는 구현·병합됨**. DOE는 여전히 제외.
- ~~Image/Annotation/Dashboard PDF~~ → **PPT 네이티브 차트 매핑은 구현·병합됨**(`js/pptxExport.js`). Image/Annotation/PDF는 여전히 제외.

여전히 제외: Next.js/FastAPI 전환 · Versioned Snapshot · 노드 기반 Pipeline/Lineage · 실제 LLM/NL→SQL · DOE · Image/Annotation/Dashboard PDF.

---

## 12. 하드닝 백로그 (Core v2 이후 잔여)

> **출처:** `docs/archieve/FOLLOWUP_PROPOSALS.md`(다른 모델 Fable의 제안 문서, 폐기됨) §5 잠재 리스크 레지스터를 2026-07-17에 흡수. 완료분은 `WORKLOG.md` §완료 원장으로 갔다.
> **상태 표기는 2026-07-17 코드 실사로 재확인한 것**이며 제안 문서의 주장을 그대로 옮기지 않았다. 근거 명령을 각 항목에 남긴다.
> **성격:** 전부 "지금 로컬 개인 사용에는 문제 없고, 특정 조건이 충족될 때 터지는 것". 강제 착수 순서는 없다.

### 우선순위 정의

| 티어 | 조건 |
|---|---|
| **T1** | 배포·공유를 실제로 하기 전 필수 |
| **T2** | 데이터·사용 규모 확대 시 |
| **T3** | 품질·완성도 |

### A. 배포·환경

| ID | 항목 | 확인된 현재 상태 (2026-07-17) | 티어 | 완화책 |
|---|---|---|---|---|
| ~~**A2**~~ | ~~React development 빌드 + 인브라우저 Babel~~ | ✅ **해소 (2026-07-17)** — `npm run build` → `dist/`: JSX 18개 esbuild 사전 트랜스파일 · React production **로컬 vendoring**(SRI 불필요·CDN 2회 제거) · Babel Standalone(~3MB) 제거 · 로더 Babel 게이트 재작성. **개발은 no-build 그대로.** `npm run verify:dist`가 빌드 산출물을 실브라우저로 검증 | — | — |
| **A3′** | DuckDB-WASM CDN 런타임 의존 | ❌ 잔존 — `vendor/`에 sheetjs·pptxgenjs만 존재, DuckDB는 jsDelivr ESM 동적 import(수 MB, SRI 없음). ECharts SRI는 ✅ 해소됨 | T1 | `vendor/duckdb/` 로컬 벤더링(SheetJS 선례 2건) + 폴백 배지 고지. **JS 폴백이 있어 오프라인서도 SQL 자체는 동작**(JOIN/윈도우만 미지원) |
| ~~**A4**~~ | ~~`navigator.clipboard` HTTPS 요구~~ | ✅ **해소 (2026-07-17)** — `Charts.clipboardSupport()`가 런타임에 사유 판별(`ready`/`insecure`/`unsupported`). 차트 복사는 사유 안내 + **PNG 자동 폴백**, 공유링크는 사유 안내 + 수동 복사 prompt. HTTPS 이전 시 코드 변경 없이 자동 정상화 | — | — |
| **A5** | 최신 CSS 의존 | ❌ 잔존 — `oklch()`/`color-mix()`가 **CSS 7개 파일**에 분포. Safari <16.2 / Chrome <111 스타일 붕괴 | T2 | 지원 브라우저 명시(README 완료) 또는 빌드 시 폴백 생성 |
| ~~**A6**~~ | ~~IndexedDB 영속성 한계~~ | ✅ **해소 (2026-07-17)** — init에서 `StorageManager.persist()`로 **축출 면제 요청**(실제 완화책). 결과를 `getStatus().storage`(`granted`/`best-effort`/`unsupported`)로 노출하고, **granted가 아닐 때만** 1회 배너로 JSON 백업 안내 | — | — |

### B. 데이터 무결성·동시성

| ID | 항목 | 확인된 현재 상태 (2026-07-17) | 티어 | 완화책 |
|---|---|---|---|---|
| **B1** | 다중 탭 last-write-wins | ⚠️ **경고까지 해소 (2026-07-17)** — BroadcastChannel로 탭 간 announce/close, `getStatus().conflict`·`peerSavedAt` 노출, 상단바 배지(피어 저장 시 stale 강조). **잠금은 아님** — 사용자가 무시하면 여전히 덮어쓴다 | T2 | 잔여: Web Locks로 실제 차단, 또는 저장 전 mtime 비교 후 확인 프롬프트 |
| **B3′** | formula column 한글/공백 컬럼 접근 | ❌ 잔존 — SQL 주경로·폴백 파서는 ✅ 해소됐으나 formula는 `row.한글` 불가 | T3 | `FormulaEval`에 `row["이름"]` 인덱스 문법 지원 |
| **B4** | undo 스택 무한 성장 | 미변경 — 셀 편집 1회 = 스텝 1개 영구 축적 | T2 | 연속 `set_cell` 병합, 스텝 상한 + 베이스라인 스냅샷 압축 |

### C. 인터랙션·UI

| ID | 항목 | 확인된 현재 상태 (2026-07-17) | 티어 | 완화책 |
|---|---|---|---|---|
| **C1** | 전역 리렌더 store | ❌ 잔존 — `store.jsx:158` `useStore(sel)`가 **selector 결과 비교 없이** 모든 `setState`에 전 구독 컴포넌트 `force()` | T2~T3 | selector 결과 얕은 비교 후 skip(10줄 내). 장기: 그리드 가상화 |
| ~~**C3**~~ | ~~`alert()`/`confirm()` 네이티브 다이얼로그~~ | ✅ **해소 (2026-07-17)** — `js/ui.jsx`(`window.UI`) 신규: 토스트 + promise 기반 `alert`/`confirm`/`prompt`. 네이티브 호출 **20곳 전부 교체**(alert 14·confirm 2·prompt 4). 계약은 네이티브와 동일(`confirm`→bool, `prompt`→string\|null)이라 호출부 로직 불변. Escape 취소·Enter 제출·자동 포커스. E2E `uiDialogs` 7 — **실제 rename/delete 플로우에서 네이티브 다이얼로그 미발화를 명시 검증** | — | — |
| **C6** | 접근성 부재 | ❌ 잔존 — aria 속성 **1개**, 포커스 트랩·키보드 내비 없음 | T3 | 개인 도구론 범위 밖 명시. 신규 모달부터 포커스 트랩 관례 |
| **C7** | 라이트 테마 검증 공백 | 미변경 — 최근 기능이 다크에서만 검증 | T3 | E2E에 라이트 테마 스크린샷 1패스 |
| **C8** | 소형 화면 레이아웃 | 미변경 — 1280px 미만 미검증 | T3 | 최소 지원 폭 정의 + 이하에서 패널 접기 |
| ~~**C9**~~ | ~~Korea 시군구 버블맵 좌표 오배치~~ | ✅ **해소 (2026-07-17)** — 원인: `MUN_LATLON`이 시군구명만으로 조회하는데 동명 구가 객체 리터럴에 중복(`북구` 부산·광주 → 뒤가 이김). 데이터의 `북구` 3개(부산/대구/광주)·`서구` 3개가 각각 한 좌표에 겹쳐, 툴팁은 "북구/부산광역시"인데 버블은 광주에 찍혔다(약 200km). esbuild `duplicate-object-key` 경고로 발견 — 브라우저 Babel은 경고하지 않았고 기존 테스트 354개도 못 잡았다. 수정: `MUN_LATLON_BY_PROV`(`시도\|이름`) 우선 조회 + 모호한 `북구`/`서구`는 평면 맵에서 **제거**해 province 없이는 해석되지 않게 함. 좌표 미상은 서울 `[37.5,127.0]`에 찍던 폴백을 없애고 skip + 경고. E2E `mapCoords` 3 | — | — |

### D. 성능·규모

| ID | 항목 | 확인된 현재 상태 (2026-07-17) | 티어 | 완화책 |
|---|---|---|---|---|
| **D1** | 전량 인메모리 + 복제 파이프라인 | 미변경 — `applySteps` 전 행 복제. 메모(P4)로 재계산은 감소했으나 XLSX 수십만 행 시 복제 1회가 수백 MB | T2 | 규모 경고를 하드 가드로(행수 상한+샘플링) |
| ~~**D2**~~ | ~~Babel 트랜스파일 시간~~ | ✅ **해소** — A2 빌드가 사전 트랜스파일. dev는 기존대로 | — | — |

### E. 분석 정확성 (2026-07-17 전수 코드 실사에서 신규 등재)

> **성격이 A~D와 다르다.** 위 항목들은 "특정 조건에서 터지는 것"이지만, 여기 항목은 **조용히 틀린 답을 정상처럼 표시하는 것**이다.
> 앱이 통계 도구인 이상 이쪽이 더 위험하다 — 사용자는 틀렸다는 사실 자체를 알 수 없다.

| ID | 항목 | 확인된 현재 상태 (2026-07-17) | 티어 | 완화책 |
|---|---|---|---|---|
| ~~**E1**~~ | ~~회귀가 완전 공선성에서 조용히 오답~~ | ✅ **해소 (2026-07-17)** — `matInverse`의 `piv \|\| 1e-9`가 0 피벗을 대체해 쓰레기 역행렬 반환 → se≈1e7·p≈1로 "유의하지 않음" 오보. `dummy_encode`(전 수준)+절편으로 **실제 도달 가능**(더미 변수 함정). 스케일 상대 임계값으로 `null` 반환 + `regression`이 `code:"collinear"` throw + UI 2경로 안내. **`statsMath.js`에 dual-mode export 추가 = 이 파일 최초의 테스트 14개**(옛 구현서 4개 실패 실증) + E2E 3 | — | — |
| **E2** | `insightEngine` 프로파일이 컬럼을 조용히 자름 | ❌ 잔존 — 왜도 검사는 앞 6개 컬럼(`insightEngine.js:45` `slice(0,6)`), 상관 검사도 앞 6개(`:57`). **7번째 이후 컬럼은 프로파일되지 않는데 사용자에게 알리지 않는다** → "이상 없음"으로 읽힘 | T3 | 상한을 유지하되 "N개 중 6개만 검사함"을 출력에 명시. `IE`는 dual-mode export가 없어 테스트 0개(`statsMath` 선례) |
| **E3** | 왜도/첨도 정의가 파일마다 다름 | ❌ 잔존 — `statsMath.skewness`는 ddof 보정 G1, `distributionFit.jarqueBera`(`:182`)는 모집단 적률. 같은 데이터가 **Profile 패널과 Distribution 패널에서 다른 값**으로 표시 | T3 | 한쪽으로 통일하거나 각 표시에 정의를 명기 |
| **E4** | `timeSeries.acf`가 결측을 압축 | ❌ 잔존 — `:201-205`가 비유한값을 버리고 남은 값을 조밀 배열로 밀어 **이후 모든 관측의 lag가 밀린다**(`acf([1,2,null,4,5],1)`은 4를 2의 lag-1로 취급). 같은 파일의 다른 함수는 전부 `null`을 내보내는데 여기만 훼손 | T3 | lag별 pairwise deletion, 최소한 docstring 명시 |
| **E5** | `logistic`의 "수렴"은 사실이 아님 | ❌ 잔존 — 주석(`:147`)은 "converged weights"라 하지만 `:128`은 **무조건 200회 GD**(lr=0.1, 허용오차 없음). 완전 분리 데이터에선 MLE가 발산하는데 200회 지점 값을 그대로 반환하고, `finalLoss`에 수렴 플래그가 없어 호출부가 구별 불가 | T3 | 수렴 판정 + `converged` 플래그 노출, 또는 IRLS/Newton 전환(이 규모면 ~5회) |
| **E6** | `sqlFallback`의 `LIKE`가 `*`를 안 이스케이프 | ❌ 잔존 — `:54`가 `[.+?^${}()|[\]\\]`만 이스케이프하고 `*`는 누락 → `LIKE 'a*'`가 정규식 `^a*$`로 컴파일돼 **조용히 다른 뜻**이 됨 | T3 | `*`를 이스케이프 목록에 추가. 폴백 전용이라 영향 범위는 좁음 |

### F. 코드 구조 (2026-07-17 실사)

> 버그가 아니라 **부채**. 저장소는 이미 `statsCfg.js`·`mlCfg.js`·`pivotEngine.js`·`dashWidgets.js`로 "순수 로직을 plain `.js`로 추출 → Node 테스트 → `window` export" 패턴을 성공적으로 증명했다. 아래는 그 패턴을 아직 적용하지 않은 곳들이다.

| ID | 항목 | 현재 상태 | 티어 | 완화책 |
|---|---|---|---|---|
| **F1** | `mapMode`가 `getActiveData` 규약 위반 | ❌ 잔존 — 저장소 최상위 규칙(README §개발 규칙 2)을 **Map만** 어긴다. `mapMode.jsx:43·123·320-321·539-540·601·675`가 `NODE.datasets.find(...).rows`를 직접 읽어 **해당 데이터셋의 Clean 단계가 지도에 반영되지 않는다**. 나머지 8개 모드는 준수 | T2 | `derive.getActiveData(id).rows`로 교체(6곳, 기계적). 올바른 선례: `sqlMode.jsx:59` |
| **F2** | Clean 이슈바 "제거/채우기" 죽은 버튼 | ❌ 잔존 — `cleanMode.jsx:113`의 action이 `fn: () => { }`. `Issue`(`:145`)가 정상 렌더·클릭 가능한 버튼을 그리는데 **아무 일도 안 일어난다**. 옆 "중복 제거"·"이상치 제거"는 동작해서 더 눈에 띔 | T3 | 결측 처리 op에 배선하거나 버튼 제거 |
| **F3** | `vizMode.jsx` 1431줄이 4역할 | ❌ 잔존 — `buildOption`(460줄 if-사다리)·`applyFormat`(170줄)은 **React 없는 순수 함수이고 이미 `window.buildVizOption`으로 export돼 dashMode가 쓴다.** 앱에서 가장 복잡한 로직이 가장 테스트 불가능 | T3 | `js/vizOptions.js`로 추출(`statsCfg.js` 선례 그대로) |
| **F4** | `animation:false`가 복붙 17곳 | ❌ 잔존 — `baseGrid()` 스프레드 시 공짜지만 `setOption(_, true)`가 통째 교체라 미사용 옵션은 손수 재선언(mapMode 9·statsMode 3·vizMode 3·mlMode 2). **새 차트가 빠뜨려도 아무도 못 잡는다** | T3 | 옵션 생성을 한 경로로 모으거나 E2E 가드 |
| **F5** | 중복 3종 | ❌ 잔존 — 탭바 3벌(`viz`/`pivot`/`dash`, ~150줄)·`editHandlers` 2벌(`dataMode:105`≡`cleanMode:57`)·`const T = (k)=>I18N.t(lang,k)` 40+회 | T3 | `<SheetTabs>` 1개, 공용 `editHandlers`, `useT()` 훅 |
| **F6** | `formulaEval` 화이트리스트에 `Math.random` | ❌ 잔존 — `:34`. 다른 18개 엔진이 전부 결정성을 지키는데 여기만 구멍 → 저장된 프로젝트가 다르게 재현됨. **보안 아님, 순수성 누수** | T3 | `MATH_FNS`에서 `random` 제거 |

### 트리거별 체크리스트

- **공유·링크·배포 결정 시**: A2(dev 빌드) → A4(HTTPS) → A6(저장 한계 고지) → C3(다이얼로그). *A1(수식 코드실행)은 ✅ 해소 — 공유링크 보안 선행 완료.*
- **통계 결과를 남에게 보여줄 때**: E2(조용한 컬럼 절단) → E3(왜도 불일치). *E1(공선성)은 ✅ 해소.*
- **Map에서 Clean 결과를 쓸 때**: F1 (지금은 정제 전 원본이 표시됨).
- **XLSX 대용량 사용 시작 시**: D1 → B4 → C1.
- **팀·다중 기기 사용 시작 시**: B1 → A6. *B2(언로드 플러시)는 ✅ 해소.*
- **오프라인 보장 필요 시**: A3′(DuckDB 벤더링).

---

## 13. 로그인 · 회원관리

> ## ✅ 결정 (2026-07-17): **A — 접근 제한만. 앱에 로그인을 구현하지 않는다.**
>
> 목적은 "아무나 내 URL을 못 열게" 하는 것 하나다(§13.2 A). 이는 **호스팅 레이어에서 해결하며 앱 코드는 0줄**이다. local-first·no-backend 전제를 그대로 유지한다.
>
> - **앱 코드 변경 없음** — 로그인 화면·계정·세션·비밀번호 전부 만들지 않는다.
> - **데이터는 계속 브라우저에만** 있다. 서버가 사용자 데이터를 보관하지 않으므로 그 책임도 지지 않는다.
> - **§13.3(전용 페이지 vs 관리자 계정)은 보류** — B/C/D로 승격될 때만 의미가 있다. 지금 정하지 않는다.
> - **배포처 미정**이므로 구체적 설정은 정해진 뒤에 한다(§13.3′).
>
> **상태:** 배포처 확정 전까지 착수할 것 없음. **코드 착수 금지 유지.**
> **현재 원칙 (2026-07-17 사용자 확인):** **로컬에서 잘 도는 게 1순위. 당분간 단독 사용.** 로컬 사용성을 해치면서까지 앞당기지 않는다.
> **상업화:** 계획 없음.

### 13.1 먼저 인정해야 할 구조적 제약

**로그인과 회원관리는 백엔드 없이 성립하지 않는다.** 이 앱은 현재 100% 클라이언트다 — 정적 파일 + IndexedDB이고 서버가 없다. 브라우저 안에만 있는 인증은 **인증이 아니다**:

- 비밀번호를 클라이언트에서 검증하면 그 검증 코드와 기준값이 사용자에게 전부 노출된다. DevTools로 우회된다.
- IndexedDB·localStorage의 "로그인 상태"는 사용자가 직접 수정할 수 있다.
- 데이터가 각 브라우저에만 있으므로 "계정"이 기기를 넘어 따라다니지 않는다.

따라서 진짜 로그인을 도입하는 순간 **`v2.0.0`의 근본 전제(local-first, no-backend, 백엔드 없이 배포)가 깨진다.** 이건 기능 추가가 아니라 **아키텍처 전환**이다. §11이 여전히 제외로 두는 FastAPI 전환과 사실상 같은 결정이다.

> **결론:** 로그인은 "나중에 붙이는 기능"이 아니라 **제품 정체성의 분기점**이다. 먼저 §13.2를 답해야 §13.3이 의미를 가진다.

### 13.2 목적 — **A로 확정** (2026-07-17)

"전용 페이지 vs 관리자 계정"은 **UI 형태**이고, 그건 목적이 정해진 뒤에야 답할 수 있다. 목적에 따라 필요한 백엔드 규모가 10배 차이난다.

| 목적 | 실제로 필요한 것 | 무게 | 상태 |
|---|---|---|---|
| **A. 접근 제한만** — "아무나 내 URL 못 열게" | 로그인 UI 불필요. 호스팅 레이어 인증으로 **앱 코드 0줄** | 극소 | ✅ **확정** |
| B. 기기 간 내 프로젝트 동기화 | 인증 + 서버 저장소. IndexedDB → 서버 동기화, 충돌 해결(§12 B1과 직결) | 대 | 미채택 |
| C. 여러 사용자가 각자 프로젝트 보유 | B + 사용자별 격리 + 가입·비밀번호 재설정·탈퇴 | 대 | 미채택 |
| D. 협업 — 프로젝트 공유·권한 | C + 권한 모델 + 공유 UI. 현재 공유링크(P10)가 부분 대체 중 | 특대 | 미채택 |

**A를 택한 이유:** 단독 사용 + 상업화 계획 없음 → B~D는 전부 없는 문제를 위한 백엔드다. A는 앱을 건드리지 않고 local-first를 유지하며, 나중에 실제로 필요해지면 그때 승격하면 된다. 조기 결정이 낳는 비용이 크고 되돌리기 어렵다.

**A로도 유지되는 것:** 데이터는 계속 브라우저에만 있다(§13.4-5의 "후자"). 서버가 사용자 데이터를 보관하지 않으므로 유출·백업·삭제 요청 대응 책임이 생기지 않는다.

### 13.3 회원관리 UI 형태 — **보류** (A에서는 불필요)

> §13.2가 **C 이상**으로 승격될 때만 의미가 있다. **현재 A이므로 이 절은 잠들어 있다** — 참고용으로만 남긴다.

| 선택지 | 내용 | 적합 조건 |
|---|---|---|
| 관리자 계정 로그인 | 같은 앱에 `role=admin`으로 로그인, 관리 화면을 모드로 노출 | 사용자 수 적음(~수십). 별도 배포 없음. 관리 UI가 앱 번들에 섞이는 부담 |
| 회원관리 전용 페이지 | `/admin` 별도 정적 페이지·별도 인증 | 사용자 수 많음. 관리 UI가 앱과 분리돼 앱 번들·공격면이 깨끗. 배포 대상 2개 |

사용자 수가 1이면 둘 다 과잉이다. 실제 사용자가 생기면 그때 규모가 답을 정해준다.

### 13.3′ A 실행 방법 — **배포처 확정 후** (현재 미정)

배포처를 아직 정하지 않았으므로(2026-07-17) 구체 설정은 그때 한다. 어느 쪽이든 **앱 코드는 건드리지 않는다.**

| 배포처 | A 구현 방법 | 비고 |
|---|---|---|
| **Cloudflare Pages** | **Cloudflare Access** — 이메일 OTP·Google 등으로 앱 앞단 게이트. 앱은 그대로 정적 배포 | 무료 티어 존재. HTTPS 자동(§12 A4 동시 해소). **A에 가장 잘 맞음** |
| **AWS** | CloudFront + Lambda@Edge Basic Auth, 또는 S3 정적 + Cognito 게이트 | 설정 부담이 Cloudflare보다 큼 |
| 사내·개인 서버 | Nginx Basic Auth 또는 IP 화이트리스트 | HTTPS를 직접 보장해야 함 |

> **주의:** Basic Auth는 http://에서 자격증명을 평문 전송한다. 어떤 방식이든 **HTTPS 확정 후** 적용한다. 현재 계획인 "우선 http" 구간에서는 접근 제한을 적용하지 않거나, 그 구간을 아예 공개하지 않는다.

### 13.4 만약 진행한다면 — 전제 조건

로그인 도입 전에 **반드시** 선행되어야 하는 것:

1. **§12 T1 전량** — 특히 A2(프로덕션 빌드). 인증을 dev 빌드로 서비스하지 않는다.
2. **HTTPS 필수** — 인증 토큰을 http://로 보내는 것은 논외. §12 A4가 자동 해소된다.
3. **B1(다중 탭) 선결** — 서버 동기화는 다중 탭 충돌의 상위 문제다. 로컬에서 못 푼 충돌을 서버에서 풀 수 없다.
4. **비밀번호를 직접 다루지 않는다** — OAuth(Google/GitHub) 또는 Cloudflare Access·Auth0 등 관리형 인증에 위임. 자체 비밀번호 저장·해싱·재설정·유출 대응은 개인 프로젝트가 감당할 범위가 아니다.
5. **데이터 소유 모델 결정** — 프로젝트가 서버에 저장되는가(= 사용자 데이터를 보관하는 책임 발생), 아니면 인증만 서버·데이터는 로컬 유지인가. **후자면 local-first를 지키면서 A를 만족한다.**

### 13.5 결정 이력과 남은 미결정

| # | 항목 | 상태 |
|---|---|---|
| 1 | §13.2 목적 A~D 중 무엇인가 | ✅ **A 확정** (2026-07-17) — 접근 제한만, 앱 코드 0줄 |
| 2 | 전용 페이지 vs 관리자 계정 (§13.3) | 💤 **보류** — A에서는 불필요. C 이상 승격 시에만 |
| 3 | 데이터를 서버에 둘 것인가 (§13.4-5) | ✅ **아니오** — 브라우저 로컬 유지. A의 귀결 |
| 4 | **배포처** (Cloudflare / AWS / 자체) | ❓ **미정** (2026-07-17) — §13.3′의 A 실행 방법이 여기에 달림 |

**다음 행동:** 없음. 배포처가 정해지면 §13.3′에서 해당 행을 실행한다. 그 전까지 이 절은 착수 대상이 아니다.

---

## 14. 지도 타일 배경 (MapTiler 등) — 후보 · 미착수

> **상태:** 후보 등재만. 코드 착수 금지. **사용자 의사(2026-07-17): "천천히".**
> **동기:** 도로·지형 배경 위에 데이터를 표기하고 싶다.

### 14.1 현재 구조와 무엇이 다른가

지금 지도는 ECharts `geo` + GeoJSON에 좌표를 직접 투영(WGS84→UTM52N)해 그리는 **행정구역 경계 + 버블**이다. 배경 타일이 없다. 타일을 쓰려면 **MapLibre GL JS 같은 렌더러가 추가로 필요하다** — ECharts 단독으로는 불가능하다. 즉 지도 스택을 하나 더 들이는 결정이다.

### 14.2 적용 범위 — "내 데이터" 탭 한정 권고

| 탭 | 타일이 도움이 되는가 |
|---|---|
| **내 데이터** (임의 위경도) | ✅ **유일하게 설득력 있음** — 배경 없이 점만 찍으면 그게 어디인지 알 수 없다 |
| Seoul · 구 / Korea · 행정구역 | ❌ choropleth는 경계가 주인공. 타일은 오히려 방해 |
| World · GDP | ❌ 동일 |

### 14.3 착수 전 해결해야 할 것

1. **API 키가 클라이언트에 노출된다.** 빌드 없는 정적 앱이라 숨길 데가 없다. MapTiler는 도메인 제한을 걸 수 있고 실무상 통용되지만, **로컬 파일·`http://`에서는 도메인 제한이 무의미**하다 → **배포처와 HTTPS가 확정된 뒤에만** 의미가 있다(§13.5-4와 동일 선행조건).
2. **local-first가 깨진다.** 타일은 팬·줌마다 네트워크를 친다. 오프라인에서 회색 화면. 현재는 GeoJSON만 받으면 그 뒤로 오프라인 동작한다. **§12 A3′와 같은 종류의 의존을 하나 더 만든다** → 오프라인 시 현재 렌더러로 폴백하는 설계가 전제.
3. **무료 할당량.** MapTiler 무료는 월 10만 타일 수준. 공개 서비스로 열면 사용자 몇 명의 팬·줌으로 소진되고, 초과 시 과금 또는 지도 정지. "상업화 계획 없음"과 충돌.

### 14.4 대안

| 방안 | 키 | 비고 |
|---|---|---|
| **MapTiler** + MapLibre GL | 필요 | 품질 좋음. 무료 할당량·도메인 제한 전제 |
| OSM 래스터 타일 직접 | 불필요 | 무료·키 없음. 단 **OSMF 타일 사용 정책**상 프로덕션 트래픽 금지에 가깝고 성능 제약 |
| 자체 타일 호스팅 | 불필요 | 비용·운영 부담이 개인 프로젝트 범위 밖 |

### 14.5 착수 조건 (전부 충족 시)

- [ ] 배포처 확정 (§13.5-4)
- [ ] HTTPS 확정
- [ ] 키 도메인 제한 적용 가능
- [ ] 오프라인·할당량 초과 시 **현재 ECharts 렌더러로 폴백** 설계
- [ ] 적용 범위를 "내 데이터" 탭으로 한정

---

## 15. Plan Revisions

| Version | Date | Change | Approval |
|---|---|---|---|
| `core-v2-plan-v1` | 2026-07-10 | 최초 승인 계획. 하이브리드 구조, 핵심 제품 기능만, 기능별 승인 게이트 확정. | User approved |
| `core-v2-plan-v2` | 2026-07-11 | 브라우저 제어가 없는 세션의 체크포인트 규칙 추가. 자동 검증+명시적 진행 승인으로 병합 가능하나 브라우저 왕복은 v2 릴리스 차단 항목으로 유지. | User instructed continuation |
| `core-v2-plan-v3` | 2026-07-11 | 밤샘 자율 실행 승인. §1 "승인 전 다음 브랜치 미착수"를 **브랜치 스택 방식**으로 완화 — M3→M4→M5를 자율 연쇄 구현하되 main 병합·태그·원격 push·실브라우저 왕복은 전부 아침 사용자 게이트로 보류. 범위: Core v2 + Phase 2 순수-JS 분석(Batch E) + 규모제한(Batch F, 경고). Phase 3 제외. 서브에이전트 병렬/테스트 위임 허용. 상세: `~/.claude/plans/temporal-juggling-fountain.md`. | User approved |
| `core-v2-plan-v4` | 2026-07-17 | **Core v2 종료 반영 + 계획 문서 일원화.** ① M1~M6 전부 완료·`v2.0.0` 태그 확인 — §4~§9 마일스톤은 이력으로 전환. ② §11 명시적 제외 정정 — DuckDB·고급 ML/PCA·시계열/SPC·PPT 매핑은 실제로 구현·병합돼 제외 목록이 사실과 달랐음. ③ **§12 하드닝 백로그 신설** — `docs/FOLLOWUP_PROPOSALS.md`(다른 모델 제안 문서)를 분해해 미완 14항목 흡수, 각 항목을 코드 실사로 재확인 후 등재. 완료 24항목은 `WORKLOG.md` 완료 원장으로. FOLLOWUP 원본은 `docs/archieve/`로 이동, 계획 정본은 이 문서 하나. ④ §1 "승인 전 다음 브랜치 미착수" 원칙은 Core v2 한정으로 종료 — 백로그는 강제 순서 없음. | User instructed (2026-07-17) |
| `core-v2-plan-v5` | 2026-07-17 | **T1 하드닝 1차 + 배포 방향 확정.** 사용자가 배포 의사를 밝힘(우선 http → 향후 Cloudflare/AWS + HTTPS + 공개 서비스, 상업화 계획 없음) — **단, 로컬 단독 사용이 1순위 원칙**이므로 dev 경로 무변경·추가 구현만. ① A2/D2 해소 — esbuild 원샷 배포 빌드(`npm run build`) + 실브라우저 검증(`npm run verify:dist`). 개발은 no-build 유지 결정. ② A4·A6 해소, B1은 경고까지(잠금은 잔여). ③ **§13 로그인·회원관리 구상 신설** — 백엔드 필수라는 구조적 제약과 미결정 3건 기록, 코드 착수 금지. ④ C9(시군구 좌표 오배치) 신규 등재 — 배포 빌드가 발견. | User instructed (2026-07-17) |
