# 후속작업 제안 (Follow-up Proposals)

> 작성: 2026-07-12 · 근거: 브라우저 실사용 클릭 검증(Data 편집·피벗→차트 연계·Export·SPC·ML 7종) + 코드/문서 대조 감사
> 성격: **제안 문서** — 승인 전 실행하지 않음. 승인 시 `IMPLEMENTATION_PLAN.md` Plan Revision에 반영 후 착수.
> 관련: [`WORKLOG.md`](../WORKLOG.md) · [`IMPLEMENTATION_PLAN.md`](../IMPLEMENTATION_PLAN.md) · [`CHANGELOG.md`](../CHANGELOG.md)

---

## 0. 우선순위 요약

> ✅ = 2026-07-12 저위험 quick-win으로 처리 완료 (커밋: P5/P8 코드, P6 위생·드리프트).

| # | 항목 | 분류 | 노력 | 효과 | 권장 | 상태 |
|---|---|---|---|---|---|---|
| P1 | IndexedDB 리로드 왕복 검증 (release blocker 해소) | QA | 소 | ★★★ | 즉시 | 대기 |
| P2 | `main` 병합 게이트 + 태그 (87+커밋 스택) | 프로세스 | 소 | ★★★ | 즉시 | 대기(사용자) |
| P3 | 구현 완료 엔진 3종 UI 배선 (TSDecomp·Outliers·GeoMatch) | 기능 | 중 | ★★★ | 단기 | 대기(시각검증) |
| P4 | `getActiveData` 메모이제이션 | 성능 | 소 | ★★★ | 단기 | 대기 |
| P5 | 편집 op 견고성 3종 (rename 충돌·set_cell 타입·IME Enter) | 버그예방 | 소 | ★★ | 단기 | ✅ 완료 |
| P6 | `.gitignore` 추가 + 문서 드리프트 3건 정정 | 위생 | 극소 | ★★ | 즉시 | ✅ 완료 |
| P7 | i18n 커버리지 완성 (영문 잔존 라벨) | UX | 중 | ★★ | 단기 | 대기 |
| P8 | 언가드 플레이스홀더 카피 정비 ("Module — In this build iteration") | UX | 극소 | ★ | 단기 | ✅ 완료 |
| P9 | Excel식 편집 확장 (다중셀 붙여넣기·방향키 이동·Cmd+Z) | 기능 | 중 | ★★ | 중기 |
| P10 | CHANGELOG Planned 잔여 (DT/NB/CV·SQL JOIN·공유링크·PPT 매핑 확장) | 기능 | 대 | ★★ | 중기 |
| P11 | Playwright 스모크 E2E 자동화 | QA | 중 | ★★ | 중기 |
| P12 | 캐시버스트 `?v=` 자동화 | DX | 소 | ★ | 중기 |

---

## 1. 즉시 (P1·P2·P6) — 반나절 이내

### P1. IndexedDB 리로드 왕복 검증
plan v2부터 `v2.0.0` release blocker로 지정된 항목. 이제 제어 브라우저가 로컬 서버에 접근 가능하므로 자동 검증 가능:
프로젝트 편집 → `Saved` 확인 → `location.reload()` → 상태(데이터셋·clean 스텝·vizSheets·pivotSheets·dash) 복원 대조 → JSON 백업/복원 왕복까지.

### P2. main 병합 게이트
`feat/analytics`가 local `main` 대비 87+커밋. 스택이 길어질수록 리뷰·롤백 비용 증가.
- 검토 → `--no-ff` 병합 → annotated tag (`checkpoint/core-v2-*`)
- 원격 push는 기존 방침대로 별도 외부전송 승인.

### P6. 저장소 위생 + 문서 드리프트
- **`.gitignore` 신설**: 추적 중인 `.DS_Store` **5건**이 모든 세션의 `git status`를 오염 중. `.gitignore`(`.DS_Store`, `**/.DS_Store`) + `git rm --cached`로 인덱스에서 제거 필요.
- **WORKLOG Quick Start 경로 오류**: `/Users/hoyun/…/Visualization-Tool` → 실제 `/Users/lyuhoyun/…/Visualization Tool` (복붙 시 실패).
- **IMPLEMENTATION_PLAN 헤더 버전**: 헤더 `core-v2-plan-v2` vs Revision 표·WORKLOG `v3` — 헤더만 미갱신.
- **`.claude` 과거 자동 푸시 훅**: 이전 절대경로 참조로 이미 "비공식" 선언됨 → 파일 자체 제거/무력화로 혼란 원천 차단.

---

## 2. 단기 (P3·P4·P5·P7·P8) — 1~2세션

### P3. 구현 완료 엔진 3종 UI 배선 (코드는 있는데 사용자가 못 씀)
Node 테스트까지 통과했지만 어떤 화면에서도 호출되지 않음:

| 엔진 | 현재 | 제안 배선 |
|---|---|---|
| `window.TSDecomp` (계절분해, 97줄) | index.html 로드만 | Stats › Time Series에 "Seasonal Decomposition" 토글 — trend/seasonal/residual 3분할 차트 |
| `window.Outliers` (다변량 이상치, 95줄) | 로드만 | Clean 모드 이슈바 "Outliers" 카드에 다변량(마할라노비스) 옵션 추가, 또는 Stats 신규 분석 |
| `window.GeoMatch` (지역명 정규화·매칭, 113줄) | 로드만 — mapMode 미사용 확인 | Map › 내 데이터 모드에서 지역명 컬럼 자동 매칭(위경도 없이 시도/시군구명으로 choropleth) |

> 참고: `DistFit`의 지수·로그정규 MLE+AIC 확장(Batch C3)도 Stats Distribution UI 노출 여부 점검 필요.

### P4. `getActiveData` 메모이제이션
`store.jsx:358` — 매 호출마다 전체 rows 복제 + 전체 스텝 재적용. 지금(503행)은 무해하나 **XLSX Import로 수만 행이 들어오면 모든 리렌더마다 O(steps×rows)**.
```
캐시 키: (datasetId, cursor, steps 배열 참조) → { rows, columns }
무효화: addStep/undo/redo/clearSteps/registerDataset 시
```
설계상 스텝 배열이 불변(추가 시 새 배열)이라 참조 비교만으로 안전하게 캐시 가능.

### P5. 편집 op 견고성 3종 (검증 중 발견)
1. **rename 충돌 가드** — 기존 컬럼 key로 rename 시 조용히 덮어씀 (`rows[to]=rows[col]` → 데이터 소실). UI(grid `commitHead`)와 op 양쪽에서 중복 키 거부.
2. **set_cell 타입 오염** — numeric 열에 `Number()` 실패 문자열이 그대로 저장됨 → 이후 통계/차트에서 해당 셀만 무시되는 조용한 오류. 제안: 커밋 시 invalid면 빨간 테두리 + 커밋 거부(또는 null 확인 다이얼로그).
3. **IME Enter 커밋** — 한글 입력 직후 Enter가 조합 종료로 소비되어 2번 눌러야 커밋. `onKeyDown`에 `e.nativeEvent.isComposing` 가드 1줄이면 해결. (blur 커밋은 정상)

### P7. i18n 커버리지 완성
언어 토글은 있으나 한국어 모드에서 영문 잔존: `Data Preview`·`Profiling`·`Edit`·`Add row`·`Add column`·`Search all columns…`·DataGrid 메뉴(`Sort ascending`…)·Pivot `Rows/Columns/Values` 등. `js/i18n.js` 사전에 일괄 등록 + 하드코딩 문자열 스윕.

### P8. 언가드 플레이스홀더 카피
Batch E 모드 가드가 띄우는 "Module — In this build iteration" 화면(차트 모드 초기 진입 시 목격)은 개발용 카피. 사용자 언어로 교체 + 복구 액션(예: "데이터 모드로 이동") 버튼 제공.

---

## 3. 중기 (P9~P12)

### P9. Excel식 편집 확장 (v1.9.0 후속)
- **다중 셀 붙여넣기**: Excel/시트에서 복사한 TSV 블록을 선택 셀 기준으로 `set_cell` 벌크 적용 (JMP 대비 최대 격차)
- **방향키 셀 이동**: 편집 커밋 후 Enter=아래, Tab=오른쪽 (연속 입력 흐름)
- **Cmd/Ctrl+Z 단축키**: 편집 모드 중 undo/redo 키보드 연결 (현재 버튼만)
- **행 다중선택 shift-클릭** 범위 선택

### P10. CHANGELOG Planned 잔여 기능
현재 Unreleased에 남은 항목 우선순위 제안:
1. **PPT 네이티브 차트 매핑 확장** (스택/보조축/캔들) — Export 완성도, PptxGenJS 기반 이미 존재
2. **Decision Tree·Naive Bayes·Cross Validation** — ML 7종과 동일 패턴으로 엔진+UI
3. **SQL JOIN/window** — 자체 파서 확장 vs **DuckDB-WASM 전환** 결정 필요 (후자면 파서 투자 중단이 합리적)
4. **공유 링크** — 배포 전제, Phase 3 인접

### P11. Playwright 스모크 E2E
이번 검증에서 수행한 시나리오(편집→undo, 피벗 드롭→Grand Total, Save&open in Chart→차트 렌더, Export 메뉴, SPC 렌더)를 스크립트화. `tests/e2e/` + `npx playwright` — no-build 구조 그대로 로컬 서버만 띄우면 됨. "브라우저 왕복은 사용자 환경 필요" 반복 문제를 영구 해소.

### P12. 캐시버스트 자동화
`?v=NNN` 수동 치환(현재 v252, 50여 태그)을 스크립트화: `scripts/bump-assets.sh` (sed 일괄) 또는 커밋 훅에서 short-hash 주입.

---

## 4. 참고 — 이번 검증에서 확인되어 **조치 불필요**한 것

- 피벗 필드 드롭 시 Import 모달 오픈 → 검증 도구의 합성 이벤트 오발이었음(실사용 무관)
- aiDrawer null 가드 → 재작성 과정에서 더 일반화되어 보존됨 (`r[dt.key] != null` + try/catch)
- clean 스텝·vizSheets·pivotSheets 프로젝트 저장 포함 여부 → `projectStore.js` STATE_KEYS에 포함 확인
- Node 217/217·tsc 구문·자산 참조·PptxGenJS SHA-256 → 전부 검증 통과
