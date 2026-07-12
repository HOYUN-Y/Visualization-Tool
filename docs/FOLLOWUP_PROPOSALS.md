# 후속작업 제안 (Follow-up Proposals)

> 작성: 2026-07-12 · 근거: 브라우저 실사용 클릭 검증 + 코드/문서 대조 감사
> **갱신: 2026-07-12 (4차)** — **Phase 3.5 브라우저 게이트 전 항목 통과** (§0-0). P0 수정 검증 완료, P1·P3·P9 검증 완료. 이전 이력: 3차(P0 발견)·2차(P4~P8)는 §6.
> ⚠️ 코드 수정은 CLI 세션에서만 수행 — 이 문서의 지적사항은 CLI가 반영할 것.
> 성격: **제안 문서** — 승인 전 실행하지 않음. 승인 시 `IMPLEMENTATION_PLAN.md` Plan Revision에 반영 후 착수.
> 관련: [`WORKLOG.md`](../WORKLOG.md) · [`IMPLEMENTATION_PLAN.md`](../IMPLEMENTATION_PLAN.md) · [`CHANGELOG.md`](../CHANGELOG.md)

---

## 0-0. ✅ Phase 3.5 브라우저 게이트 결과 — 전 항목 통과 (2026-07-12, Fable 검증)

> 대상: `fix/mode-render-p0` (= Phase 1+2+3 + P0 수정 `4d402b9`), asset v265, Node 237/237·tsc 0 선확인.
> **판정: 병합 가능** — 아래 4개 게이트 전부 통과, 신규 콘솔 에러 0. main 병합·push는 CLI/사용자 몫.
> ⚠️ **후속 갱신**: 이후 ML 심층검증에서 **ML 회귀·k-NN 결과 렌더 크래시(§0-0b)** 발견 — 게이트 범위(모드 전환) 밖의 리그레션. **병합 전 §0-0b 1줄 수정 동반 권장.**

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

## 0-0b. 🚨 신규 P0급 — ML 회귀·k-NN 결과 렌더 크래시 (ML 심층검증, 2026-07-12 추가)

> Phase 3.5 게이트의 "8모드 전환"은 통과했으나(전환만으로는 안 터짐), **ML에서 실제 학습을 돌리면** 발견되는 리그레션. **병합 전 수정 권장** — 수정은 CLI에서.

**증상**: ML 모드에서 **Regression 또는 k-NN Classify 학습 → 결과 렌더 즉시 크래시**. ErrorBoundary가 잡아 앱은 생존(P0 수정 효과 실증 ✓)하지만:
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

> ✅ = 처리 + 재검증 통과 (§0-0·§6). **P0~P9 전부 완료 — 남은 것: main 병합(CLI) → P11 → P10·P12 → §5 잠재 리스크**.

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
| P10 | Planned 잔여 (DT/NB/CV·SQL JOIN·공유링크·PPT 매핑) | 기능 | 대 | ★★ | 대기 — Phase 4 DuckDB가 SQL JOIN 결정을 대체 |
| P11 | Playwright 스모크 E2E | QA | 중 | ★★ | 대기 — P0가 필요성 실증. **"8모드 전환" 시나리오는 §0-0 ①을 그대로 스크립트화하면 됨** |
| P12 | 캐시버스트 `?v=` 자동화 | DX | 소 | ★ | 대기 |

---

## 1. 다음 액션 (권장 순서 — CLI 세션용)

> Phase 3.5 게이트 통과로 1~4번(구 P0/P3/P9/P1 검증)은 전부 소화됨. 남은 순서:

1. **`fix/mode-render-p0` → main 병합** — 게이트 전 항목 통과(§0-0), 병합 가능 판정. `--no-ff` + 태그. (원격 push는 별도 승인)
2. **Phase 4 DuckDB S1 PoC** — WORKLOG 계획대로. make-or-break 게이트(브라우저 로드·쿼리)라 브라우저 반복 필요 → 검증은 Fable 세션에 위임 가능.
3. **P11 E2E 스모크** — §0-0 ①의 "8모드 전환 매트릭스"를 Playwright로 스크립트화(이미 검증된 시나리오 그대로). P0류 리그레션 영구 차단.
4. P10(DT/NB/CV·PPT 매핑) · P12(캐시버스트 자동화) · §5 잠재 리스크 중 "몇 줄 수정" 4건(beforeunload·ECharts SRI·SQL 유니코드·export 대상).

### 검증 중 발견한 신규 관찰 (버그 아님, CLI 참고)
- **다변량 이상치 카드에 대상 컬럼명 미표시** — "17 · 다변량 이상치 · 4 열"만 표시. 어떤 4개 열 기준인지 툴팁/서브라벨로 노출하면 신뢰도↑ (단변량 카드는 컬럼명 표시 중).
- **계절분해 additive/multiplicative 전환은 미클릭** — 렌더 경로는 additive로 검증됨. multiplicative는 CLI에서 한 번 눌러보거나 E2E에 포함 권장.

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
2. **Decision Tree·Naive Bayes·Cross Validation** — ML 7종과 동일 패턴
3. **SQL JOIN/window** — 자체 파서 확장 vs **DuckDB-WASM 전환** 결정 필요
4. **공유 링크** — 배포 전제, Phase 3 인접

### P11. Playwright 스모크 E2E — 우선순위 상향 권고
P0가 "Node 237/237 그린인데 앱은 벽돌"을 실증. 최소 시나리오: **8모드 전환 매트릭스** + 편집→undo + 피벗→차트 + Export 메뉴. `tests/e2e/` + 로컬 서버.

### P12. 캐시버스트 자동화
`?v=NNN` 수동 치환(현재 **v264**)을 `scripts/bump-assets.sh` 또는 커밋 훅으로.

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
| **A1. formula column의 `new Function`** | `store.jsx:297` — 임의 JS 실행. 로컬 1인 도구에선 무해. **프로젝트 JSON 공유·공유 링크(P10) 도입 순간** 남이 심은 수식이 내 브라우저에서 실행되는 코드 실행 벡터가 됨 | 계정/세션 탈취급 | 공유 기능 전 KPIFormula식 **안전 파서로 교체**(선례 있음) 또는 열기 전 수식 목록 표시+승인. CSP 병행 |
| **A2. React development 빌드 배포** | `react.development.js` + Babel Standalone 인브라우저 트랜스파일. 로컬에선 감내 | 프로덕션 성능 수 배 저하·첫 로드 수 초·콘솔 경고 노출 | 배포 시 production UMD 교체 + JSX 사전 트랜스파일(esbuild 원샷이면 no-build 철학 유지 가능) |
| **A3. CDN 단일 장애점** | React/Babel은 SRI+버전고정 ✓ 양호. **ECharts는 SRI 없음**, 4종 전부 CDN — 오프라인·사내망·CDN 장애 시 앱 자체가 안 뜸 | 앱 전체 다운 | ECharts SRI 추가, 장기적으로 SheetJS처럼 로컬 vendoring (이미 선례 2건) |
| **A4. `navigator.clipboard` HTTPS 요구** | 클립보드 복사(PPT용)가 secure context 전용. localhost는 예외라 **지금은 됨**. http:// 배포 시 조용히 실패(false 반환만) | 기능 무반응 — 사용자는 고장으로 인식 | 실패 시 "HTTPS 필요" 토스트 + PNG 다운로드 폴백 안내 |
| **A5. 최신 CSS 의존** | `oklch()`·`color-mix()`가 css 7개 파일에 분포. 차트색은 JS 변환으로 해결했지만 **CSS 자체는 미해결** — Safari <16.2 / Chrome <111에서 스타일 붕괴 | 구형 브라우저 레이아웃/색 깨짐 | 지원 브라우저 명시(README) 또는 빌드 시 폴백 생성. 최소한 지원선 문서화 |
| **A6. IndexedDB 영속성의 한계** | Safari ITP(7일 미사용 시 삭제)·시크릿 모드·스토리지 압박 축출. 사용자에게 고지 없음 | 프로젝트 통째 소실 → 신뢰 손상 | 첫 실행 시 "로컬 저장 한계 + JSON 백업 권장" 1회 안내, 주기적 백업 리마인드 |

### B. 데이터 무결성·동시성 (T1~T2)

| 리스크 | 현재 상태 / 터지는 조건 | 영향 | 완화책 |
|---|---|---|---|
| **B1. 다중 탭 last-write-wins** | 탭 락·storage 이벤트·BroadcastChannel 전무 (확인). 같은 프로젝트를 두 탭에서 열면 1초 autosave가 서로 덮어씀 | 한쪽 작업 통째 유실 (조용히) | Web Locks 또는 BroadcastChannel로 "다른 탭에서 열림" 경고. 최소: 탭 간 mtime 비교 후 덮어쓰기 확인 |
| **B2. `beforeunload` 저장 플러시 부재** | `visibilitychange(hidden)` flush만 존재(확인). 1초 디바운스 창에서 탭 강제종료·크래시 시 마지막 편집 유실 | 마지막 1초 내 편집 소실 | `beforeunload`에도 saveNow 추가 (logger엔 이미 있음 — 패턴 복사) |
| **B3. 한글/특수문자 컬럼명 상호운용 격차** | rename이 임의 문자열 key 허용(예: `층수`). **SQL 파서는 `[\w]+`만 매치**(유니코드 미포함, `sqlMode.jsx:15,27,97` 확인) → 한글 컬럼은 SELECT/WHERE/ORDER 불가. formula도 공백 포함 이름은 `row.이름` 접근 불가 | "이름 바꿨더니 SQL에서 사라짐" — 원인 추적 어려운 사용자 혼란 | SQL 정규식 유니코드화(`[\p{L}\w]+` + u 플래그) 또는 rename 시 key/label 분리(내부 key 유지) |
| **B4. undo 스택 무한 성장** | 셀 편집 1회 = 스텝 1개 영구 축적. 긴 세션(수백 편집) 시 applySteps 재생 비용·autosave 페이로드·프로젝트 JSON 크기 비례 증가 | 점진적 저하 — 어느날 "느려졌다" | 연속 set_cell 병합(같은 셀), 스텝 수 상한+베이스라인 스냅샷 압축 |

### C. 인터랙션·UI (T2~T3)

| 리스크 | 현재 상태 / 터지는 조건 | 영향 | 완화책 |
|---|---|---|---|
| **C1. 전역 리렌더 store** | `useStore`가 selector **비교 없이** 모든 setState에 전 구독 컴포넌트 force render (확인). 지금은 페이지당 100행이라 감내 | 위젯 많은 대시보드·대형 그리드에서 타이핑 지연·전역 버벅임 | selector 결과 얕은 비교 후 skip (10줄 내), 장기: 그리드 가상화 |
| **C2. 싱글클릭 = 즉시 편집** | 편집 모드에서 셀 클릭이 곧 에디터 오픈 — "선택"과 "편집" 미구분. P9 범위선택·복사 UX와 충돌 예정 | 복사하려다 실수 편집, Excel 관례와 상충 | Excel 관례로: 클릭=선택, 더블클릭/F2/타이핑 시작=편집 (P9 마무리 때 함께 결정 권장) |
| **C3. `alert()`/`confirm()` 네이티브 다이얼로그** | rename 충돌 alert, dummy encode confirm 등. iframe/임베드·자동화 환경에서 블로킹, 브랜드 UX 이질 | 임베드 배포 시 UX 파손 | 인앱 토스트/다이얼로그 컴포넌트로 점진 교체 |
| **C4. `Charts.lastInst` 전역 export 대상** | Export가 "마지막 렌더된 차트 인스턴스" 기준 (확인). 대시보드 다중 차트·차트 전환 직후엔 **의도와 다른 차트**가 export될 수 있음 | 잘못된 차트가 PPT/PNG로 나감 — 발견 늦음 | export 진입점에서 대상 차트 명시(현재 활성 시트의 인스턴스 참조 전달) |
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

- **공유/링크/배포 결정 시**: A1(수식 실행) → A2(dev 빌드) → A4(HTTPS) → C3(다이얼로그) 순으로 먼저.
- **XLSX 대용량 사용 시작 시**: D1 → B4 → C1.
- **팀/다중 기기 사용 시작 시**: B1 → A6 → B2.
- **지금 코드 몇 줄로 싸게 막을 수 있는 것**: B2(beforeunload 1줄), A3(ECharts SRI 1속성), B3(정규식 유니코드화), C4(export 대상 명시).

---

## 6. 재검증 기록

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
