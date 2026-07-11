# 후속작업 제안 (Follow-up Proposals)

> 작성: 2026-07-12 · 근거: 브라우저 실사용 클릭 검증 + 코드/문서 대조 감사
> **갱신: 2026-07-12 (3차)** — i18n Phase 1·P3 배선·P9 처리분 검증 중 **P0 크래시 리그레션 발견** (§0-1). 상세 재검증 기록 §5.
> 성격: **제안 문서** — 승인 전 실행하지 않음. 승인 시 `IMPLEMENTATION_PLAN.md` Plan Revision에 반영 후 착수.
> 관련: [`WORKLOG.md`](../WORKLOG.md) · [`IMPLEMENTATION_PLAN.md`](../IMPLEMENTATION_PLAN.md) · [`CHANGELOG.md`](../CHANGELOG.md)

---

## 0-1. 🚨 P0 — 모드 전환 크래시 리그레션 (즉시 수정 필요)

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

> ✅ = 처리 + 재검증 통과 (§5). **남은 것: P0(최우선) → P1 → P3 시각검증 잔여 → P10~P12**.

| # | 항목 | 분류 | 노력 | 효과 | 상태 |
|---|---|---|---|---|---|
| **P0** | **모드 전환 크래시 (app.jsx 함수호출 렌더 × i18n 훅)** | **버그** | **극소(8줄)** | **★★★** | 🚨 **신규 — 즉시** |
| P1 | IndexedDB 리로드 왕복 검증 | QA | 소 | ★★★ | 대기 (P0 수정 후 — 현 상태로는 크래시 영속화와 얽힘) |
| P2 | `main` 병합 게이트 + 태그 | 프로세스 | 소 | ★★★ | ✅ 완료 — `65754ab` 병합 + `checkpoint/core-v2` 태그. 원격 push만 승인 대기 |
| P3 | 엔진 3종 UI 배선 (TSDecomp·Outliers·GeoMatch) | 기능 | 중 | ★★★ | ✅ 코드 배선(`80287a0`) — 시각검증: Map/GeoMatch ✓, **Stats·Clean은 P0에 막혀 미검증** |
| P4 | `getActiveData` 메모이제이션 | 성능 | 소 | ★★★ | ✅ 완료·검증 (+HANDOFF 규약 `7f66bb3`) |
| P5 | 편집 op 견고성 3종 | 버그예방 | 소 | ★★ | ✅ 완료·검증 |
| P6 | `.gitignore`·문서 드리프트·구 훅 | 위생 | 극소 | ★★ | ✅ 완전 완료 (`9b6820d` 훅 추적 해제 포함) |
| P7 | i18n 커버리지 (grid·data·pivot + 7모드 chrome) | UX | 중 | ★★ | ✅ 완료 (`13092a3`+Phase 1a~1g) — **단, P0 리그레션의 발화점이 됨** |
| P8 | 언가드 플레이스홀더 카피 | UX | 극소 | ★ | ✅ 완료·검증 |
| P9 | Excel식 편집 (붙여넣기·셀이동·Cmd+Z·범위선택) | 기능 | 중 | ★★ | ✅ 코드 완료(`2aa9faa`·`d469d78`) — 코어 실측 통과, 상호작용 전수는 P0 수정 후 |
| P10 | Planned 잔여 (DT/NB/CV·SQL JOIN·공유링크·PPT 매핑) | 기능 | 대 | ★★ | 대기 |
| P11 | Playwright 스모크 E2E | QA | 중 | ★★ | 대기 — **P0가 필요성을 실증** (정적검사 불가 버그) |
| P12 | 캐시버스트 `?v=` 자동화 | DX | 소 | ★ | 대기 |

---

## 1. 다음 액션 (권장 순서)

1. **P0 수정** — app.jsx 함수호출 → JSX 엘리먼트 8곳 + 부팅 모드 폴백. 수정 후 8개 모드 전환 매트릭스 브라우저 재검증(이 세션의 제어 브라우저로 즉시 가능).
2. **P3 시각검증 마무리** — P0 해소 후 Stats(TSDecomp 계절분해)·Clean(다변량 이상치) 진입 확인. Map/GeoMatch는 확인 완료.
3. **P9 상호작용 검증** — 실붙여넣기·Cmd+Z·Enter 이동·shift 범위선택.
4. **P1** IndexedDB 왕복 — P0 수정 후 (mode 영속화 동작 포함해서 검증).
5. **P11** E2E 스모크 — "8모드 전환 + 핵심 클릭" 시나리오를 최소셋으로: P0류 리그레션 영구 방지.
6. P10·P12는 기존 계획대로.

---

## 2. 완료 항목 상세 (재검증 근거)

### ~~P2. main 병합 게이트~~ ✅
`65754ab`(97커밋 merge) + `0c89626` + `checkpoint/core-v2` annotated tag 확인. 이후 i18n Phase 1도 `387705f`로 main 병합. 현재 `feat/analytics`는 main 대비 5커밋(P3 배선+P9). **원격 push만 외부전송 승인 대기.**

### ~~P3. 엔진 3종 UI 배선~~ ✅ 코드 / 시각검증 부분
- `TSDecomp` → statsMode, `Outliers` → cleanMode+statsMode, `GeoMatch` → mapMode 배선 확인 (grep + `80287a0`)
- 시각검증: **Map › 내 데이터의 지역명 매칭 UI 표시 확인** ✓. Stats·Clean 진입은 P0 크래시로 차단 → P0 수정 후 마무리.

### ~~P4·P5·P6·P8~~ ✅ (2차 갱신에서 검증 완료 — §5 참조)
P4는 HANDOFF 유지규약 명문화(`7f66bb3`)까지, P6은 `auto-push.sh` 추적 해제(`9b6820d`)·`.claude/hooks` gitignore(`301ae06`)까지 완결.

### ~~P7. i18n~~ ✅ (기능 자체는 완결)
`13092a3`(grid·data·pivot, 80키+사전 대칭 테스트) + Phase 1a~1g(dash/clean/map/stats/ml/sql/ai chrome). `tests/i18n.test.js` 회귀 잠금.
⚠️ 단, 모드 export 최상위에 추가된 `useStore(lang)`가 app.jsx 안티패턴과 결합해 **P0를 유발** — P0 수정(엘리먼트 렌더)이 곧 이 구조의 정상화임.

### ~~P9. Excel식 편집~~ ✅ 코드 + 코어 실측
- `set_cells` 배치 op + `editCells` 액션(`2aa9faa`), 붙여넣기(`gridPaste.js` TSV 파서)·Enter/Tab 셀이동·Cmd+Z·shift 범위선택(`d469d78`)
- **실측 통과**: 2셀 일괄 편집=1스텝, undo 1번에 전체 복원, `parseClipboardMatrix('a\tb\nc\td')` 정상. `tests/gridPaste.test.js`+`storeEdit.test.js`(+16) 잠금.
- 상호작용 전수(실제 클립보드 paste·키보드 흐름)는 P0 수정 후 일괄.

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

## 5. 재검증 기록

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
