# 후속작업 제안 (Follow-up Proposals)

> 작성: 2026-07-12 · 근거: 브라우저 실사용 클릭 검증(Data 편집·피벗→차트 연계·Export·SPC·ML 7종) + 코드/문서 대조 감사
> **갱신: 2026-07-12 (2차)** — P4·P5·P6·P8 처리분을 코드·테스트·라이브 브라우저로 재검증 완료 (§5).
> 성격: **제안 문서** — 승인 전 실행하지 않음. 승인 시 `IMPLEMENTATION_PLAN.md` Plan Revision에 반영 후 착수.
> 관련: [`WORKLOG.md`](../WORKLOG.md) · [`IMPLEMENTATION_PLAN.md`](../IMPLEMENTATION_PLAN.md) · [`CHANGELOG.md`](../CHANGELOG.md)

---

## 0. 우선순위 요약

> ✅ = 처리 + **재검증 통과** (2026-07-12 2차, §5). 남은 것: **P1·P2(즉시) → P3(단기) → P9~P12(중기)**. (P7 핵심 완료·`13092a3`)

| # | 항목 | 분류 | 노력 | 효과 | 권장 | 상태 |
|---|---|---|---|---|---|---|
| P1 | IndexedDB 리로드 왕복 검증 (release blocker 해소) | QA | 소 | ★★★ | 즉시 | 대기 — 제어 브라우저로 즉시 실행 가능 |
| P2 | `main` 병합 게이트 + 태그 (**93커밋** 스택) | 프로세스 | 소 | ★★★ | 즉시 | 대기(사용자) |
| P3 | 구현 완료 엔진 3종 UI 배선 (TSDecomp·Outliers·GeoMatch) | 기능 | 중 | ★★★ | 단기 | 대기(시각검증) |
| P4 | `getActiveData` 메모이제이션 | 성능 | 소 | ★★★ | 단기 | ✅ 완료·검증 |
| P5 | 편집 op 견고성 3종 (rename 충돌·set_cell 타입·IME Enter) | 버그예방 | 소 | ★★ | 단기 | ✅ 완료·검증 |
| P6 | `.gitignore` 추가 + 문서 드리프트 정정 | 위생 | 극소 | ★★ | 즉시 | ✅ 완료·검증 (훅 파일 삭제만 선택 잔여) |
| P7 | i18n 커버리지 완성 (영문 잔존 라벨) | UX | 중 | ★★ | 단기 | ✅ 핵심 완료 (grid·data·pivot) — stats/ml/sql/dash 내부라벨 잔여 |
| P8 | 언가드 플레이스홀더 카피 정비 | UX | 극소 | ★ | 단기 | ✅ 완료·검증 |
| P9 | Excel식 편집 확장 (다중셀 붙여넣기·방향키 이동·Cmd+Z) | 기능 | 중 | ★★ | 중기 | 대기 |
| P10 | CHANGELOG Planned 잔여 (DT/NB/CV·SQL JOIN·공유링크·PPT 매핑 확장) | 기능 | 대 | ★★ | 중기 | 대기 |
| P11 | Playwright 스모크 E2E 자동화 | QA | 중 | ★★ | 중기 | 대기 |
| P12 | 캐시버스트 `?v=` 자동화 | DX | 소 | ★ | 중기 | 대기 |

---

## 1. 즉시 (P1·P2) — 반나절 이내

### P1. IndexedDB 리로드 왕복 검증
plan v2부터 `v2.0.0` release blocker로 지정된 항목. 제어 브라우저가 로컬 서버에 접근 가능함이 확인됐으므로 자동 검증 가능:
프로젝트 편집 → `Saved` 확인 → `location.reload()` → 상태(데이터셋·clean 스텝·vizSheets·pivotSheets·dash) 복원 대조 → JSON 백업/복원 왕복까지.

### P2. main 병합 게이트
`feat/analytics`가 local `main` 대비 **93커밋**. 스택이 길어질수록 리뷰·롤백 비용 증가.
- 검토 → `--no-ff` 병합 → annotated tag (`checkpoint/core-v2-*`)
- 원격 push는 기존 방침대로 별도 외부전송 승인.

### ~~P6. 저장소 위생 + 문서 드리프트~~ ✅ 완료 (2026-07-12)
- ✅ `.gitignore` 신설(`c361cc0`) — `.DS_Store` 5건 인덱스 제거, `git status` 오염 해소 확인
- ✅ WORKLOG Quick Start 경로 정정(`b0ca001`) — `/Users/lyuhoyun/…/Visualization Tool`
- ✅ IMPLEMENTATION_PLAN 헤더 `core-v2-plan-v3`로 갱신
- ✅ `.claude` 구 자동푸시 훅 — `settings.json` `"hooks": {}`로 **무력화 확인** (등록 해제됨). 잔여(선택): 추적 중인 `auto-push.sh` 파일 자체 삭제 여부는 사용자 판단.

---

## 2. 단기 (P3·P7) — 1~2세션

### P3. 구현 완료 엔진 3종 UI 배선 (코드는 있는데 사용자가 못 씀)
Node 테스트까지 통과했지만 어떤 화면에서도 호출되지 않음 (WORKLOG 아침 게이트 2번과 동일 항목):

| 엔진 | 현재 | 제안 배선 |
|---|---|---|
| `window.TSDecomp` (계절분해, 97줄) | index.html 로드만 | Stats › Time Series에 "Seasonal Decomposition" 토글 — trend/seasonal/residual 3분할 차트 |
| `window.Outliers` (다변량 이상치, 95줄) | 로드만 | Clean 모드 이슈바 "Outliers" 카드에 다변량(마할라노비스) 옵션 추가, 또는 Stats 신규 분석 |
| `window.GeoMatch` (지역명 정규화·매칭, 113줄) | 로드만 — mapMode 미사용 확인 | Map › 내 데이터 모드에서 지역명 컬럼 자동 매칭(위경도 없이 시도/시군구명으로 choropleth) |

> 참고 1: `DistFit`의 지수·로그정규 MLE+AIC 확장(Batch C3)도 Stats Distribution UI 노출 여부 점검 필요.
> 참고 2: `sheets.js` → store 실배선(A5)도 아침 게이트 보류 항목 — 단, `vizSheets/pivotSheets` 멀티시트가 이미 동작 중이므로 현황 재확인 후 판단.

### ~~P7. i18n 커버리지 완성~~ ✅ 핵심 완료 (`13092a3`)
플래그된 항목 전량 처리: `Data Preview`·`Profiling`·`Edit/Editing/Undo/Redo`·`Add row/column`·`Search all columns…`·DataGrid 컬럼 메뉴(정렬/필터/고정/숨김/이름변경/타입 6종/삽입/삭제)·컬럼 토글·필터 팝오버(min/max/All/None/Clear/Apply)·좌측 Explorer(검색/Datasets/Combine/Union·Join/Connect/Drop)·Pivot `Rows/Columns/Values`+힌트+note+제목+Save&open+빈상태. `js/i18n.js` ko/en 대칭 80키, `tests/i18n.test.js`로 사전 대칭·폴백 회귀 잠금.
- **잔여(별도·큰 스윕)**: stats/ml/sql/dashboard 모드의 **내부 분석 라벨**(테스트명·지표명·차트 옵션 등)은 영문 다수 — 도메인 용어 성격이라 우선순위·번역 방침 별도 판단 권장.

### ~~P4. getActiveData 메모이제이션~~ ✅ 완료 (`7814f8e`)
`(ds 참조, steps 배열 참조, cursor)` 키로 캐시, 스텝 불변성 기반 참조 비교. `tests/storeMemo.test.js`(+4)가 **실제 store.jsx를 스텁 window/React로 로드**해 회귀 잠금 — 이 테스트 방식은 P3 배선 시에도 재사용 가치 있음.
- ✅ **유지 규약 문서화 완료**: 캐시가 result 객체를 재사용하므로 소비자는 반환된 `rows`/`columns`를 제자리 변형하면 안 됨(현 코드베이스는 전부 복사 후 정렬/변형). HANDOFF §Derived helpers + §개발 규칙 2곳에 read-only 경고 1줄씩 추가함.

### ~~P5. 편집 op 견고성 3종~~ ✅ 완료 (`41d24bd`)
1. ✅ rename 충돌 — op 레벨 가드(기존 키면 no-op) + UI 레벨 alert·에디터 유지 (이중 방어)
2. ✅ set_cell 타입 오염 — invalid 숫자 → `null` 저장(오염 원천 차단) + `.cell-input.invalid` 빨간 테두리
3. ✅ IME Enter — `!e.nativeEvent.isComposing` 가드 (셀 입력 + 헤더 rename 2곳)

### ~~P8. 언가드 플레이스홀더 카피~~ ✅ 완료 (`41d24bd`)
"Module — In this build iteration" 전량 제거 → 모드별 한국어 로딩 카피 + "잠시 후에도 이 화면이 보이면 데이터 화면으로 이동해 주세요" 안내.

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
`?v=NNN` 수동 치환(현재 **v254**, 50여 태그)을 스크립트화: `scripts/bump-assets.sh` (sed 일괄) 또는 커밋 훅에서 short-hash 주입.

---

## 4. 참고 — 검증에서 확인되어 **조치 불필요**한 것

- 피벗 필드 드롭 시 Import 모달 오픈 → 검증 도구의 합성 이벤트 오발이었음(실사용 무관)
- aiDrawer null 가드 → 재작성 과정에서 더 일반화되어 보존됨 (`r[dt.key] != null` + try/catch)
- clean 스텝·vizSheets·pivotSheets 프로젝트 저장 포함 여부 → `projectStore.js` STATE_KEYS에 포함 확인
- Node 테스트·tsc 구문·자산 참조·PptxGenJS SHA-256 → 전부 검증 통과

---

## 5. 재검증 기록 — 2026-07-12 (2차)

대상 커밋: `41d24bd`(P5·P8) → `c361cc0`·`b0ca001`(P6) → `7814f8e`·`a419e08`(P4). 방법: 코드 diff 확인 + 정적 검증 + **라이브 브라우저 실측**.

| 검증 | 결과 |
|---|---|
| Node 테스트 | **221/221 pass** (storeMemo +4 포함) |
| tsc 구문(TS1xxx) / 자산 참조 / `git status` | 0 오류 / 누락 0 (v254) / clean (`.DS_Store` 소멸) |
| P4 실측 | 동일 입력 → **동일 참조** 반환, editCell 후 즉시 무효화·신값 반영 |
| P5-1 실측 | `rename floor→district`(기존 키) → **no-op** (floor 보존, district 중복 없음) |
| P5-2 실측 | numeric 열에 `'abc'` 커밋 → **null 저장** (문자열 오염 없음) |
| P5-3 코드 | `isComposing` 가드 셀·헤더 2곳 확인 |
| P6 실측 | `.DS_Store` 추적 0건, WORKLOG 경로·플랜 헤더 v3 정정, 훅 `"hooks": {}` 무력화 |
| P8 코드 | 구 카피 grep 0건, 한국어 카피+복구 안내로 교체 |
| 콘솔 | 앱 에러 0 |
