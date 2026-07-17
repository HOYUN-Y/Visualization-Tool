# insight Analytics Workbench — Implementation Plan

> **Plan version:** `core-v2-plan-v4`
> **Status:** Core v2 **완료** (`v2.0.0`, 2026-07-12) · 잔여 작업은 [§12 하드닝 백로그](#12-하드닝-백로그-core-v2-이후-잔여)
> **Updated:** 2026-07-17
> **Canonical scope:** **이 문서가 계획의 정본이다.** 무엇을 왜 어떤 순서와 기준으로 구현하는지 정의한다. 현재 진행 위치와 다음 행동은 `WORKLOG.md` 상단을 따른다.

**문서 지도**

| 문서 | 역할 |
|---|---|
| **`IMPLEMENTATION_PLAN.md`** (이 문서) | **계획 정본** — 앞으로 할 일. §4~§9는 완료된 Core v2 마일스톤 이력, §12가 살아있는 백로그 |
| `WORKLOG.md` | 현재 상태 + 완료 기록. 세션 시작 시 상단부터 읽는다 |
| `HANDOFF.md` | 코드 아키텍처 |
| `CHANGELOG.md` | 릴리스 이력 |
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
2. `WORKLOG.md` 상단 — 현재 milestone, 브랜치, 마지막 체크포인트, 다음 행동
3. `HANDOFF.md` — 현재 코드 아키텍처
4. `CHANGELOG.md` — 릴리스 이력
5. `README.md` — 사용자용 개요
6. `prompt.txt` — 최초 아이디어 참고용이며 현재 기준이 아님

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
| **A2** | React development 빌드 + 인브라우저 Babel | ❌ 잔존 — `index.html`이 `react.development.js`/`react-dom.development.js` 로드, JSX 22개 매 로드 트랜스파일 | T1 | production UMD 교체 + esbuild 원샷 사전 트랜스파일(no-build 철학 유지 가능). **D2와 동일 작업** |
| **A3′** | DuckDB-WASM CDN 런타임 의존 | ❌ 잔존 — `vendor/`에 sheetjs·pptxgenjs만 존재, DuckDB는 jsDelivr ESM 동적 import(수 MB, SRI 없음). ECharts SRI는 ✅ 해소됨 | T1 | `vendor/duckdb/` 로컬 벤더링(SheetJS 선례 2건) + 폴백 배지 고지. **JS 폴백이 있어 오프라인서도 SQL 자체는 동작**(JOIN/윈도우만 미지원) |
| **A4** | `navigator.clipboard` HTTPS 요구 | 미변경 — secure context 전용, localhost 예외라 현재는 동작. http:// 배포 시 조용히 false 반환 | T1 | 실패 시 "HTTPS 필요" 토스트 + PNG 다운로드 폴백 |
| **A5** | 최신 CSS 의존 | ❌ 잔존 — `oklch()`/`color-mix()`가 **CSS 7개 파일**에 분포. Safari <16.2 / Chrome <111 스타일 붕괴 | T2 | 지원 브라우저 명시(README 완료) 또는 빌드 시 폴백 생성 |
| **A6** | IndexedDB 영속성 한계 | 미변경 — Safari ITP(7일)·시크릿·스토리지 축출. 사용자 고지 없음 | T1 | 첫 실행 1회 안내 + JSON 백업 리마인드 |

### B. 데이터 무결성·동시성

| ID | 항목 | 확인된 현재 상태 (2026-07-17) | 티어 | 완화책 |
|---|---|---|---|---|
| **B1** | 다중 탭 last-write-wins | ❌ 잔존 — `BroadcastChannel`·`navigator.locks` **코드에 전무**(grep 0건). 같은 프로젝트를 두 탭에서 열면 1초 autosave가 서로 덮어씀 | T1~T2 | Web Locks 또는 BroadcastChannel로 "다른 탭에서 열림" 경고. 최소: mtime 비교 후 덮어쓰기 확인 |
| **B3′** | formula column 한글/공백 컬럼 접근 | ❌ 잔존 — SQL 주경로·폴백 파서는 ✅ 해소됐으나 formula는 `row.한글` 불가 | T3 | `FormulaEval`에 `row["이름"]` 인덱스 문법 지원 |
| **B4** | undo 스택 무한 성장 | 미변경 — 셀 편집 1회 = 스텝 1개 영구 축적 | T2 | 연속 `set_cell` 병합, 스텝 상한 + 베이스라인 스냅샷 압축 |

### C. 인터랙션·UI

| ID | 항목 | 확인된 현재 상태 (2026-07-17) | 티어 | 완화책 |
|---|---|---|---|---|
| **C1** | 전역 리렌더 store | ❌ 잔존 — `store.jsx:158` `useStore(sel)`가 **selector 결과 비교 없이** 모든 `setState`에 전 구독 컴포넌트 `force()` | T2~T3 | selector 결과 얕은 비교 후 skip(10줄 내). 장기: 그리드 가상화 |
| **C3** | `alert()`/`confirm()` 네이티브 다이얼로그 | ❌ 잔존 — **17곳**(ML 모드는 P13에서 제거 완료, 그 외 rename 충돌·dummy encode 등) | T2~T3 | 인앱 토스트/다이얼로그로 점진 교체 |
| **C6** | 접근성 부재 | ❌ 잔존 — aria 속성 **1개**, 포커스 트랩·키보드 내비 없음 | T3 | 개인 도구론 범위 밖 명시. 신규 모달부터 포커스 트랩 관례 |
| **C7** | 라이트 테마 검증 공백 | 미변경 — 최근 기능이 다크에서만 검증 | T3 | E2E에 라이트 테마 스크린샷 1패스 |
| **C8** | 소형 화면 레이아웃 | 미변경 — 1280px 미만 미검증 | T3 | 최소 지원 폭 정의 + 이하에서 패널 접기 |

### D. 성능·규모

| ID | 항목 | 확인된 현재 상태 (2026-07-17) | 티어 | 완화책 |
|---|---|---|---|---|
| **D1** | 전량 인메모리 + 복제 파이프라인 | 미변경 — `applySteps` 전 행 복제. 메모(P4)로 재계산은 감소했으나 XLSX 수십만 행 시 복제 1회가 수백 MB | T2 | 규모 경고를 하드 가드로(행수 상한+샘플링) |
| **D2** | Babel 트랜스파일 시간 | ❌ 잔존 — **A2와 동일 작업** | T1 | A2와 함께 해소 |

### 트리거별 체크리스트

- **공유·링크·배포 결정 시**: A2(dev 빌드) → A4(HTTPS) → A6(저장 한계 고지) → C3(다이얼로그). *A1(수식 코드실행)은 ✅ 해소 — 공유링크 보안 선행 완료.*
- **XLSX 대용량 사용 시작 시**: D1 → B4 → C1.
- **팀·다중 기기 사용 시작 시**: B1 → A6. *B2(언로드 플러시)는 ✅ 해소.*
- **오프라인 보장 필요 시**: A3′(DuckDB 벤더링).

---

## 13. Plan Revisions

| Version | Date | Change | Approval |
|---|---|---|---|
| `core-v2-plan-v1` | 2026-07-10 | 최초 승인 계획. 하이브리드 구조, 핵심 제품 기능만, 기능별 승인 게이트 확정. | User approved |
| `core-v2-plan-v2` | 2026-07-11 | 브라우저 제어가 없는 세션의 체크포인트 규칙 추가. 자동 검증+명시적 진행 승인으로 병합 가능하나 브라우저 왕복은 v2 릴리스 차단 항목으로 유지. | User instructed continuation |
| `core-v2-plan-v3` | 2026-07-11 | 밤샘 자율 실행 승인. §1 "승인 전 다음 브랜치 미착수"를 **브랜치 스택 방식**으로 완화 — M3→M4→M5를 자율 연쇄 구현하되 main 병합·태그·원격 push·실브라우저 왕복은 전부 아침 사용자 게이트로 보류. 범위: Core v2 + Phase 2 순수-JS 분석(Batch E) + 규모제한(Batch F, 경고). Phase 3 제외. 서브에이전트 병렬/테스트 위임 허용. 상세: `~/.claude/plans/temporal-juggling-fountain.md`. | User approved |
| `core-v2-plan-v4` | 2026-07-17 | **Core v2 종료 반영 + 계획 문서 일원화.** ① M1~M6 전부 완료·`v2.0.0` 태그 확인 — §4~§9 마일스톤은 이력으로 전환. ② §11 명시적 제외 정정 — DuckDB·고급 ML/PCA·시계열/SPC·PPT 매핑은 실제로 구현·병합돼 제외 목록이 사실과 달랐음. ③ **§12 하드닝 백로그 신설** — `docs/FOLLOWUP_PROPOSALS.md`(다른 모델 제안 문서)를 분해해 미완 14항목 흡수, 각 항목을 코드 실사로 재확인 후 등재. 완료 24항목은 `WORKLOG.md` 완료 원장으로. FOLLOWUP 원본은 `docs/archieve/`로 이동, 계획 정본은 이 문서 하나. ④ §1 "승인 전 다음 브랜치 미착수" 원칙은 Core v2 한정으로 종료 — 백로그는 강제 순서 없음. | User instructed (2026-07-17) |
