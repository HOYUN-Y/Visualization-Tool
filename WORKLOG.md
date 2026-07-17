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
| Plan version | `core-v2-plan-v5` — Core v2 완료(`v2.0.0`), 잔여는 `IMPLEMENTATION_PLAN.md` §12 **하드닝 백로그** |
| Current milestone | **T1 하드닝 배치 완료** (A2·A4·A6·B1 + 배포 빌드 + C9·C3) + **E1 회귀 공선성 수정**(2026-07-17). 배포 대상: 우선 http → 향후 Cloudflare/AWS + HTTPS + 공개 서비스 |
| Status | **1순위 원칙: 로컬 단독 사용.** T1 잔여 = A3′(DuckDB 벤더링)·A5(CSS 하한)·B1 잠금. 로그인·회원관리는 §13에 구상만(미결정) |
| Branch | **`main`** |
| Base commit | `1231f15` — merge: 시군구 좌표 오배치 수정(C9) + 네이티브 다이얼로그 교체(C3) |
| Last checkpoint commit | `1231f15` |
| Working tree | 배치 1(F1·F2·F6) + 배치 2(E2·E3·E4·E5·E6) + 배치 3(F3·F4·F5) 완료. **실사 백로그 E·F 전부 해소**(F5의 useT는 의도적 보류) |
| Last verified | **2026-07-18 — Node 359/359 · E2E 67/67 · `verify:dist` 9개 모드 전수 통과(콘솔 에러 0)** · asset v293 |

> ⚠️ **문서 드리프트 사고 (2026-07-17)** — 이 항목을 지우지 말 것. 원인과 재발 방지책임.
> 07-10 밤 이 저장소의 로컬 클론이 `76d5333`에 멈춘 채 방치됐고, 이후 07-11~17 작업은 **다른 기기(git author `BULL3T`, 동일 계정 `hoyun0131@me.com`)에서 진행**돼 origin/main에 180커밋이 쌓였다. 낡은 클론의 세션이 그 사실을 모른 채 낡은 `WORKLOG`를 신뢰해 **이미 완료된 M1 병합과 M2(XLSX Import) 재구현을 시도**했다(실제로는 `vendor/sheetjs-0.20.3/`으로 완료된 지 6일). 병합 직전 `git log main..origin/main`으로 발견해 중단.
> **재발 방지: 세션 시작 시 `git fetch origin && git status -sb`를 먼저 실행하고, `behind`가 0이 아니면 문서를 신뢰하기 전에 동기화한다.** 문서는 클론 로컬 상태이지 프로젝트의 진실이 아니다.

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
> ✅ **P10 공유 링크 (2026-07-17, `feat/p10-share-link` 2커밋)** — FOLLOWUP §3 P10.4: 프로젝트 전체(데이터 포함)를 `#p=` URL fragment로 공유. `js/shareLink.js`(`window.ShareLink`) 신규 — 이식 번들↔JSON↔base64url↔fragment, 브라우저 `CompressionStream`(deflate-raw) 압축+무압축 폴백(1자 코덱태그 z/r), 크기 상한 `MAX_PAYLOAD_CHARS`(32k) 초과 시 JSON 파일 폴백. `projectStore.exportBundle()`(파일 저장 없이 번들 반환), `shell.jsx` Projects 메뉴에 **Share link** 버튼(클립보드 복사·tooLarge/clipboard 폴백), `app.jsx` 부팅 시 `#p=` 감지→decode→importJSON→`history.replaceState`로 fragment 정리. fragment는 서버 전송 안 됨(백엔드 불필요, no-build 유지). **보안**: A1 안전파서 전제 → 공유 번들 formula 코드실행 불가. 검증: Node **315/315**(+8 shareLink) · **E2E 25/25**(신규 shareLink 2 — 코덱 왕복 + 실브라우저 열기·fragment 정리 실증) · tsc 0. 커밋 `0cb3295`·`5b98b3a`. **함정 기록**: 같은 페이지 hash-only goto는 SPA 취급→app.jsx 미재실행, E2E는 about:blank 선경유로 해결(실사용 새 탭은 정상). 병합·push는 사용자 게이트.
| Updated at | 2026-07-17 |

## NEXT EXACT ACTION

Core v2는 `v2.0.0`으로 종료됐고 **강제되는 다음 행동은 없다.** 착수 시 `IMPLEMENTATION_PLAN.md` §12 하드닝 백로그에서 선택하고, 선택 즉시 이 절을 그 작업으로 교체한다.

배포·공유를 실제로 할 계획이면 §12의 **T1(A2 프로덕션 빌드 → A4 HTTPS 클립보드 → A6 저장 한계 고지 → B1 다중 탭)**이 선행 조건이다. 로컬 개인 사용만 유지한다면 백로그 전체가 대기 상태로 남아도 무방하다.

---

## 완료 항목 원장 — FOLLOWUP 제안 문서 흡수 (2026-07-17)

> FOLLOWUP은 **다른 모델(Fable)의 제안 문서**였다. 2026-07-17에 분해해 **완료분은 이 표로, 미완분은 `IMPLEMENTATION_PLAN.md` §12으로** 옮기고 원본은 `docs/archieve/`로 보냈다. 계획의 정본은 `IMPLEMENTATION_PLAN.md` 하나다.

| ID | 항목 | 결과 · 근거 |
|---|---|---|
| P0 | 모드 전환 크래시 (함수호출 렌더 × i18n 훅) | ✅ `4d402b9` — `window.XMode()` 8곳 → `<window.XMode/>`. 벽돌화 해소 |
| P0.5 | 모드 전환 스모크 E2E | ✅ `659524f` — Playwright 헤드리스로 P0 클래스 영구 회귀망 |
| P1 | IndexedDB 리로드 왕복 검증 | ✅ Fable 브라우저 검증 — mode·스텝·편집값·열·`__rid` 연속성 복원 |
| P2 | main 병합 게이트 + 태그 | ✅ `checkpoint/core-v2` · `v2.0.0` |
| P3 | 엔진 3종 UI 배선 (TSDecomp·Outliers·GeoMatch) | ✅ 계절분해 4단 차트·다변량 17건 제거·Map 매칭 시각검증 |
| P4 | `getActiveData` 메모이제이션 | ✅ +HANDOFF 규약 `7f66bb3` |
| P5 | 편집 op 견고성 3종 | ✅ |
| P6 | `.gitignore`·문서 드리프트·구 훅 | ✅ `9b6820d` · `301ae06` |
| P7 | i18n 커버리지 | ✅ `13092a3` + Phase 1a~1g. `tests/i18n.test.js` 회귀 잠금 |
| P8 | 언가드 플레이스홀더 카피 | ✅ |
| P9 | Excel식 편집 (붙여넣기·셀이동·Cmd+Z·범위선택) | ✅ `2aa9faa` · `d469d78` — 상호작용 전수 통과 |
| P10 | Planned 잔여 4종 | ✅ **전부** — DT/NB/CV(`0707044`…) · SQL JOIN(DuckDB 전환으로 해소) · 공유링크(`feat/p10-share-link`) · PPT 네이티브 매핑(`feat/p10-pptx-chart-mapping`, PR #5) |
| P11 | Playwright 스모크 E2E | ✅ `tests/e2e/*` — 현재 14스펙 |
| P12 | 캐시버스트 `?v=` 자동화 | ✅ `3eb86f0` — `scripts/bump-assets.sh` + `npm run bump` |
| P13 | ML 데이터 적격성 검증 | ✅ `1b58e1f` · `b356ec6` — 태스크 게이팅·target 필터·`alert()` 제거·one-vs-rest. 관찰 ①② 폴리시까지 반영 |
| A1 | formula column `new Function` 임의 실행 | ✅ **보안 해소** `ae3dbff` · `4cfae88` — `window.FormulaEval` 재귀하강 파서, 프로토타입 체인 차단 |
| A3 | ECharts SRI 부재 | ✅ **부분** — ECharts sha384 SRI 추가(`3eb86f0`). **DuckDB 로컬 벤더링은 미해결 → §12 A3′로 이월** |
| B2 | 언로드 저장 플러시 부재 | ✅ `1d13d4b` — projectStore pagehide/beforeunload saveNow |
| B3 | 한글 컬럼명 상호운용 | ✅ **부분** — SQL 주경로 DuckDB 해소 + 폴백 파서 유니코드화(`f3ce2d7`). **formula `row["한글"]`는 미해결 → §12 B3′로 이월** |
| C2 | 싱글클릭 = 즉시 편집 | ✅ `6d59625` (PR #4) — Excel식 클릭=선택 / 더블클릭·F2·타이핑=편집 |
| C4 | `Charts.lastInst` 전역 export 대상 | ✅ `392ece0`·`1f49f82`·`8c1cf8b` (PR #1) — `onInst` 콜백 + 명시 인스턴스 |
| C5 | 함수호출 렌더 재발 위험 | ✅ P0 수정이 원천 차단 + HANDOFF "모드=엘리먼트 렌더" 명문화 |
| — | ML 관찰 3건 (다변량 카드 컬럼명·multiplicative·태스크 전환 결과 잔존) | ✅ `d2a44b1`(툴팁+multiplicative E2E) · `b356ec6`(result 초기화) |

**FOLLOWUP §4 조치 불필요 판정**(피벗 드롭 오발·aiDrawer 가드·SHA-256 이력)은 그대로 유효하며 이월하지 않았다.

## 밤샘 자율 실행 정책 (사용자 승인 2026-07-11)

- 사용자가 "내 개입 없이 진행 가능한 부분은 새벽 내내 자율 진행" 명시 승인. 계획: `~/.claude/plans/temporal-juggling-fountain.md`.
- **자율:** 순수 엔진 구현 + Node 테스트 + JSX 구문검사 + UI 배선 + 기능 브랜치 체크포인트 커밋 + 문서 동기화.
- **아침 게이트(사용자):** `main` 병합, annotated tag, 원격 push, 실브라우저 왕복 검증.
- **브랜치 스택:** `feat/xlsx-import → feat/data-combine → feat/pivot-builder → feat/dashboard-builder`. main 미병합으로 연쇄.
- 목표 종착점: Core v2(M3~M5) + Batch E(Phase 2 순수-JS 분석) + Batch F(규모제한, 경고). Phase 3 제외.
- 검증 도구: `node --test tests/*.test.js`, `tsc --noEmit --allowJs --checkJs false --jsx react … js/*.jsx` (TS1xxx 구문오류만 확인), `git diff --check`.

## 세션 기록 — 2026-07-18 (배치 3 — F3·F4·F5 구조 부채)

순수 리팩터라 "아무것도 안 바뀌었음을 증명"이 핵심. 세 항목 모두 **동작 보존을 실측으로 잠근 뒤** 진행.

### F3 — vizMode 460+170줄을 vizOptions.js로 추출 (동작 보존 이동)

사용자 승인대로 **DI/Node테스트가 아니라 동작 보존 이동**. `buildOption`(460줄)·`applyFormat`(170줄)·헬퍼를 `js/vizOptions.js`로 옮기고 `window.buildVizOption`/`applyVizFormat` 노출. **vizMode 1431→776줄.**

**함정 3개:**
- 순수 함수 블록이 연속적이지 않다 — 사이에 React 컴포넌트 `FacetGrid`가 끼어 있어 3블록으로 분할 이동.
- `rgbToHex`는 FormatPanel(vizMode 잔류)도 쓰므로 **이동 대상 아님**. `stableJitter`는 죽은 코드였다.
- `vizOptions.js`는 plain JS지만 `window.Store.derive`를 IIFE 로드시 캡처 → projectStore.js식 **deferred-babel 로더**로 store·charts 이후 실행. 처음엔 HTML 주석에 "text/babel" 문자열을 넣었다가 build.mjs의 무딘 전체문서 검사에 걸림(주석 문구 교체).

**검증**: 추출 **전** 20개 차트 타입 출력을 캡처 → 추출 후 재캡처 → **바이트 단위 동일** 확인. E2E `vizOptions` 2(20타입 전수 + 실제 Chart 렌더).

### F4 — animation:false 복붙 18곳 → EChart 단일 강제

`setOption(_, true)`가 통째 교체라 baseGrid 안 쓰는 옵션은 손수 재선언했다. 모든 차트가 지나는 **단일 병목** `EChart`의 setOption에서 `{ ...option, animation:false }`로 중앙 강제 → baseGrid 1개만 남기고 17개 제거. **새 차트가 빠뜨려도 회귀 불가**가 됨. 의도적 `animation:true` 없음 확인. 20타입 출력이 animation 키 외 완전 동일함을 실측(financial 3개는 키가 빠지고 EChart가 주입, bar 등 17개는 baseGrid 경유로 키 유지 — 렌더 동작은 셋 다 불변).

### F5 — 중복 2/3 해소

- **탭바 3벌 → `window.SheetTabs` 1개**(shell.jsx): VizTabs/PivotTabs/DashTabs가 selector·액션명·아이콘·라벨·dataset picker 유무만 달랐다. 전부 prop화하고 dataset picker는 `tail` prop(dash는 없음). ~120줄 감소. E2E `sheetTabs` 3 — 3개 모드에서 add/rename/dup/close가 **각자의 store slice**를 구동하는지(공유 컴포넌트에서 prop 오배선이 숨을 자리) 검증.
- **editHandlers 2벌 → `window.makeEditHandlers(columns)` 1개**(grid.jsx): dataMode:105 ≡ cleanMode:57 (uniqKey 헬퍼까지 13줄 동일). E2E `cellEdit` 무회귀.
- **`const T` 40+회는 의도적 보류**: 두 줄 관용구라 46곳·13파일 churn 대비 이득이 낮고, `useT` 훅은 useStore·로드순서 제약이 있다. 남기는 게 낫다고 판단(사용자에게 사전 고지).

### 검증

- 신규 E2E: `vizOptions` 2 · `sheetTabs` 3. 신규 헬퍼 `tests/e2e/_vizTypes.mjs`(spec 아님, 수집 제외).
- 전체: **Node 359/359**(변동 없음 — 순수 리팩터) · **E2E 67/67**(62→67) · `verify:dist` 9개 모드 전수·콘솔 에러 0 · asset v293.
- **실사 백로그 E·F 전부 종료**(F5 useT 보류 1건 제외).

---

## 세션 기록 — 2026-07-17 (배치 2 — E2·E3·E4·E5·E6 분석 정직성)

"사실이 아닌 걸 말하지 않기" 주제. 다섯 항목 모두 **조용히 틀린 값을 정상처럼 표시**하던 것. E2의 선행 작업(insightEngine dual-export)이 statsMath 선례를 그대로 반복했다.

### E2 — 프로파일이 컬럼을 조용히 자름 (해소)

왜도·상관 모두 `slice(0,6)`이라 7번째 이후가 미검사인데 패널은 "데이터셋 프로파일"이라 침묵을 "이상 없음"으로 읽히게 했다. **비용 실측이 결정을 갈랐다**: 이상치 스캔은 이미 캡 없이 전 컬럼을 `colStats`(정렬 O(n log n))로 도는데 왜도(O(n) 1패스)만 캡돼 있었다 — 비싼 쪽이 무제한, 싼 쪽이 제한. 그래서 **왜도는 캡 제거**(추가 비용이 기존보다 적다), **상관은 O(k²)라 캡 유지하되 truncation을 명시**("first 6 of N … Stats › Correlation for the full matrix"). `IE`에 dual-export 추가 → 이 파일 최초 테스트(순수 summarize\* 8) + E2E `profileCoverage` 2. `profileDataset`은 `window.Store`를 call-time에 읽어 browser-only라 E2E로.

### E3 — 왜도/첨도 정의 불일치 (해소)

Descriptive·Profile은 `SM.skewness`(G1), Q-Q 패널은 `jarqueBera` 내부 모집단 적률 → 같은 컬럼이 탭마다 다른 왜도. **JB 통계량은 모집단 적률이 정의상 정답**이라 수식은 건드리지 않고, Q-Q의 **표시** 왜도/첨도만 `SM`(G1/G2)로 통일. `jb.statistic`은 JB 카드에 그대로. 정규성 판정·문구도 `dispSkew` 사용.

### E4 — ACF가 결측을 압축해 lag를 밈 (해소)

`x.push(v)`가 결측을 건너뛰고 남은 값을 조밀 배열로 밀어 결측 이후 모든 관측의 lag가 밀렸다. **ACF로 찾으려던 계절성 신호가** 결측 하나당 깎였다(period-4가 0.90→0.79). 위치 보존 + lag별 **pairwise deletion**(양쪽 유한한 쌍만)으로 교체 — 결측 없을 때 기존 편향추정량과 정확히 동일(무회귀 잠금), 결측 있을 때 0.90→0.84로 안정화되고 결측 수와 무관. `pacf`가 acf 호출해 자동 혜택.

### E5 — logistic "수렴"이 사실이 아님 (해소, 최소 조치)

주석은 "converged weights"인데 종료 조건 없는 고정 200회 GD였다. 완전 분리 데이터에선 MLE가 발산해 200회 지점 값을 반환하고, 플래그가 없어 호출부가 구별 불가. **정확도·AUC(순위 기반)는 무영향**이고 계수 막대와 확률만 잠정값이라, "고장"이 아니라 "정직성" 문제 — gradient max-norm `<1e-6`면 조기 종료 + `converged`/`iterationsUsed` 반환, 미수렴 시 ML 패널 배너. 사용자 승인대로 **최소 조치**(IRLS 전환은 별도). 결과 무회귀: 수렴 후 예산 늘려도 가중치 불변(테스트 잠금). 미수렴 유도에 필요한 분리 데이터를 실제 UI로 등록·학습해 배너 출현/미출현을 E2E로 검증(mlMode 설정 400회·lr0.3 기준 분리=미수렴, 중첩=119회 수렴 실측).

### E6 — sqlFallback LIKE가 `*`를 안 이스케이프 (해소)

이스케이프 문자셋에 `*` 누락 → `LIKE 'a*'`가 `^a*$`("a 0개 이상")로 컴파일돼 조용한 오답. SQL LIKE에서 `*`는 리터럴(와일드카드는 %·_뿐). 문자셋에 `*` 추가 — %·_는 이스케이프 이후 치환이라 무영향.

### 검증

- 신규: `tests/insightEngine.test.js` 8 · `tests/statsMath`(E1서 이미) · `tests/logistic.test.js` +3 · `tests/timeSeries.test.js` +3 · `tests/sqlFallback.test.js` +1
- 신규 E2E: `profileCoverage` 2 · `logitConvergence` 2
- 각 수정이 **수정 전 실패 → 수정 후 통과**를 실증(E2·E5 E2E는 옛 코드에서 실패 확인). E5는 양쪽 케이스(분리/중첩) 모두 플래그 없이는 실패.
- 전체: **Node 359/359** · **E2E 62/62** · `verify:dist` 9개 모드 전수 통과·콘솔 에러 0 · asset v292

---

## 세션 기록 — 2026-07-17 (배치 1 — F1·F2·F6 기계적 수정)

실사 백로그를 3배치로 나누고(사용자 승인: **1 → 2 → 3 순서**) 배치 1 착수. 기준은 "① 조용한 오답 먼저 ② 그중 결정 불필요한 것부터 ③ 테스트 가능성을 여는 것 우선 ④ 조건부(규모·배포)는 트리거까지 대기".

### F1 — Map이 Clean 파이프라인을 우회하던 문제 (해소)

6곳을 `seedRows(id)` 헬퍼로 통일. **"기계적 6줄 치환"이라는 초기 판단은 틀렸고**, 두 가지가 걸렸다:

1. **부재 가드는 장식이 아니라 필수.** `getActiveData`는 없는 id에 **throw**한다(`applySteps`가 `dataset.rows`를 널 체크 없이 역참조 — 브라우저에서 직접 확인: `Cannot read properties of undefined (reading 'rows')`). 기존 코드의 `ds ? ds.rows : []` 주석("seed dataset may be absent")이 실재하는 시나리오였다. 그대로 치환했으면 **버그를 크래시로 바꿨을 것**. → 헬퍼가 `NODE.datasets`로 존재만 먼저 확인하고 derive.
2. **정렬 전 복사 유지.** `seedRows`가 반환하는 건 `getActiveData`의 **메모이즈된 공유 배열**이라 제자리 정렬 시 다른 소비자 전체의 캐시가 오염된다(HANDOFF §5 ⚠). 기존 `[...ds.rows].sort()`를 그대로 보존. 파일 전수 스캔으로 `.sort(`/`.push(` 등 제자리 변형 0건 확인.

### F2 — Clean 이슈바 죽은 버튼 (해소, 버튼 제거)

`fn: () => { }`인데 `Issue`(`:145`)가 정상 렌더·클릭 가능한 버튼을 그렸다. **조사해보니 게으름이 아니라 설계 공백**: 이웃들은 단일 동작으로 환원되지만(`drop_duplicates` 무인자 / `remove_outliers` 단일 컬럼) 결측은 **여러 컬럼 × 전략 4종**(제거/평균·중앙값·최빈값)이라 버튼 하나로 라벨("제거 / 채우기")을 이행할 수 없다. 컬럼별 선택지는 이미 우측 Add operation 패널에 있으므로 **기능 손실 없이 제거**가 정직하다(사용자 결정). 고아가 된 i18n 키 `cleanDropFill`을 한/영 동시 제거(i18n 테스트가 키 대칭을 강제).

### F6 — `Math.random` 화이트리스트 제거 (해소)

보안이 아니라 **결정성** 문제. 수식 컬럼은 cleaning **step**으로 저장돼 매 로드·undo·redo·스텝 스크럽마다 `applySteps`가 재생하므로, `Math.random()`이면 같은 저장 프로젝트와 같은 `#p=` 공유 링크가 **열 때마다 다른 값**을 보이고 그 컬럼 기반 분석은 재현 불가가 된다. 이제 파스 단계에서 `Math.random is not allowed`로 사전 거부.

### 그 외

`dashMode.jsx:76` `const cur = useStore.length; // no-op` 제거 — 콜백 안의 훅 호출처럼 보여 오독을 유발했다.

### 검증 — E2E 초안 2개를 폐기했다 (기록으로 남김)

**F1 잠금 E2E를 두 번 잘못 썼고, 양방향 검증이 아니었으면 그대로 나갔다.**

- **초안 1**(폐기): `page.evaluate`로 `getActiveData` vs `NODE.datasets`를 비교 → **store를 검사한 것이지 Map을 검사한 게 아니다.** 버그가 있으나 없으나 통과한다.
- **초안 2**(폐기): Map 모드만 열고 검사 → **기본 탭이 `mydata`**(`mapMode.jsx:953`)라 seed 조회를 하는 `MapCenter`/`MapPanel`이 **마운트조차 안 된다.** 가드를 제거해도 통과했다.
- **최종**: Seoul 탭을 실제로 열고 **구별 리더보드(`.maprank`)** 를 읽는다 — `seedRows` 데이터를 DOM에 직접 렌더하는 곳이라 ECharts 캔버스와 달리 정직하게 관측 가능하다.
- 부재 가드 테스트도 `.app` 가시성으로는 부족했다 — `app.jsx`가 모드를 `<ErrorBoundary key={mode}>`로 감싸므로 **크래시해도 `.app`은 살아있고 폴백이 안에 렌더**된다. 폴백 문구의 부재를 검증하도록 교체.

각 테스트가 **자기 실패 모드만** 잡는 것을 실증:

| | 테스트①(Clean→Map) | 테스트②(부재 가드) |
|---|---|---|
| 수정본 | ✅ | ✅ |
| F1 버그 복원 | **❌ 잡음** | ✅ |
| 가드 제거 | ✅ | **❌ 잡음** |

- `tests/e2e/mapCleanPipeline.spec.mjs` 신규 2 · `tests/formulaEval.test.js` +1(F6 거부 + 이웃 Math 함수 무회귀)
- 전체: **Node 344/344** · **E2E 58/58** · `verify:dist` 9개 모드 전수 통과·콘솔 에러 0 · asset v290

---

## 세션 기록 — 2026-07-17 (코드 실사 + 문서 일원화 + E1 회귀 공선성 수정)

전수 코드 실사(코어 상태·UI 모드·분석 엔진 3개 계층)를 돌리고, 그 결과로 문서 정리와 최상위 정확성 버그 1건을 수정했다.

### 1. 문서 일원화 — `CHANGELOG.md` → `WORKLOG.md` 통합 후 삭제

릴리스 이력과 세션 로그가 갈려 한쪽만 갱신되는 드리프트가 반복됐다(이 저장소는 07-17에 이미 한 번 드리프트 사고를 겪었다 — 상단 경고 참조). 두 문서 모두 "무엇이 언제 바뀌었나"를 기록하므로 하나로 합쳤다.
- `CHANGELOG.md` 전문(334줄, 버전 앵커 11개)을 이 파일 하단 **`# 릴리스 이력`** 절로 이동. 헤딩 레벨만 한 단계 낮추고 **내용은 무손실**(대조 검증: 누락 0줄).
- 참조 갱신: `README.md` 프로젝트 구조, `IMPLEMENTATION_PLAN.md` 문서 지도 §2·세션 시작 절차. 과거 세션 기록 안의 `CHANGELOG` 언급은 **당시 사실이므로 보존**(역사 기록이지 지시가 아님).
- **앞으로:** 릴리스 단위 = 하단 `릴리스 이력`, 세션 단위 = 이 `세션 기록`.

### 2. HANDOFF 드리프트 3건 수정 (코드가 문서를 앞서 있었음)

| 위치 | 문서 주장 | 실제 |
|---|---|---|
| §1 TL;DR | "8 workspace modes" | **9개** — Pivot 누락(`shell.jsx:6-16`·`verify-dist.mjs:62` 모두 9개). ML 설명도 3종→**9종**으로 갱신 |
| §8 StatusBar | DuckDB 라벨은 "aspirational, 런타임은 여전히 손수 만든 JS 엔진" | **이미 전환 완료** — `shell.jsx:444`가 `DuckDB.status`를 읽어 실제 엔진을 표시 |
| §9 SQL | "No JOIN/subquery/window yet" | **DuckDB-WASM이 전부 지원.** 2엔진 구조(주경로 DuckDB / 인스턴스화 실패 시에만 JS 폴백, per-query 폴백 아님)와 폴백의 실제 한계를 명기 |

### 3. E1 — 회귀분석이 완전 공선성에서 조용히 오답을 내던 문제 (정확성 P0)

**증상:** `js/statsMath.js`의 `matInverse`가 `const piv = A[c][c] || 1e-9;` — 0 피벗을 1e-9로 **몰래 대체**하고 거대한 유한 쓰레기 역행렬을 반환했다. 오류도 null도 NaN도 아니라 **호출부가 진짜 답과 구별할 수 없다.** `regression()`은 이 `(XtX)⁻¹`를 표준오차에 그대로 먹이므로 결과는:

```
se ≈ 1e7  →  t ≈ 0  →  p ≈ 1   ("이 변수는 유의하지 않습니다")
```

즉 **모형이 애초에 식별조차 못 하는 변수를 두고 "유의하지 않다"고 확신에 차서 보고**한다. 오답이 오류보다 나쁜 전형적 사례.

**도달 경로는 실재한다 (이론이 아님):** Clean의 `dummy_encode`가 기준 범주를 빼지 않고 **모든 수준**을 만들고(`store.jsx:233`), `regression()`은 절편을 앞에 붙인다(`statsMode.jsx:88`). 더미 전 수준을 예측변수로 넣으면 더미 합 = 절편 열 → `XtX`가 정확히 특이행렬. 고전적인 **더미 변수 함정**이다. 실측 재현(60행·3수준):

```
t_아파트 계수 = 6144  (실제 효과 2000) ·  Ainv[0][0] = 1.4e+14 → p ≈ 1
```

**왜 지금까지 안 걸렸나:** `statsMath.js`는 **dual-mode export가 없는 2개 파일 중 하나**였다(`window.SM =`만 있고 `module.exports` 없음). 그래서 Node에서 `require()`가 불가능 → **테스트가 0개**. 앱의 모든 p-value(t/F/χ²)를 먹여살리는 파일이 저위험이라서가 아니라 **테스트할 수 없어서** 방치됐다. 같은 저장소의 `outliers.js:40`은 같은 Gauss-Jordan에서 `return null; // singular`로 **올바르게** 처리한다 — 두 파일이 정반대였고, 틀린 쪽에만 테스트가 없었다.

**수정:**
- `matInverse`가 특이행렬에 **`null` 반환**(`outliers.js`와 동일 규약). 임계값은 **행렬 스케일 상대**(`1e-12 × max|element|`) — 이 앱의 `XtX`는 원 단위 제곱 합산으로 ~1e13까지 가므로 절대 임계값은 영영 발화하지 않고, 반대로 소규모 행렬에선 건강한 피벗을 특이로 오판한다. NaN-safe 비교(`!(|piv| > eps)`).
- `js/statsMath.js`에 **dual-mode export 추가** → 테스트 가능해짐. 이게 근본 원인이었다.
- `regression()`이 `Ainv === null`이면 `{ code: "collinear" }` 에러를 **명시적으로 throw**(`statsMode.jsx`).
- **UI 2경로 모두** 처리: ① 렌더 경로의 기존 catch에 공선성 전용 안내 분기 — 기존 범용 문구("그룹이 2개 이상인 범주 컬럼을 선택했는지 확인하세요")는 공선성에선 **오히려 오해를 부른다**(사용자 컬럼은 멀쩡하고 조합이 문제). ② Analysis Builder는 `onClick`(`runBuilder2`)에서 직접 호출되는데 **React는 이벤트 핸들러의 throw를 잡지 않으므로** 그대로 두면 `set()`이 실행되지 않아 버튼이 죽은 것처럼 보인다 → `runBuilder` 내부에서 catch해 `{type:"unavailable"}` 렌더 가능 결과로 반환(렌더러는 `data` 가드가 이미 있어 안전하게 degrade).
- i18n 한/영 키 2개 추가(`statCollinearTitle`·`statCollinearDesc`) — 원인과 조치(더미 한 수준 제외)를 사용자 언어로 안내.

**검증 (수정 전 실패 → 수정 후 통과를 양방향 실증):**
- `tests/statsMath.test.js` **신규 14개** — 이 파일 최초의 테스트. 옛 구현 대상 실행 시 **4개가 정확히 실패**(exactly singular · 더미 함정 XtX · 스케일 상대성 · 영행렬), 나머지 10개(p-value·gammln·왜도/첨도)는 양쪽 통과 = 기존 동작 무회귀.
- `tests/e2e/statsCollinear.spec.mjs` **신규 3개** — 실제 UI로 dummy_encode→regression을 몰아 **공선성 안내 표시 + 계수표 미렌더(`.coef-table` 0개)** 검증. 옛 구현 대상 실행 시 2개 실패, "정상 다변수 회귀는 계수표를 그대로 낸다"(과잉 차단 방지 가드)는 **양쪽 통과**.
- 브라우저 실증: `window.SM`이 dual-mode export 후에도 살아있고 `matInverse`가 특이행렬에 null을 내는 것을 실제 Chrome에서 확인(플레인 `<script>` 로드라 `module` 참조가 앱을 깨지 않는지가 실제 리스크였음 — `pca.js`·`spc.js`와 동일 가드).
- 전체: **Node 343/343**(329→343) · **E2E 56/56**(53→56) · `verify:dist` **9개 모드 전수 통과·콘솔 에러 0** · asset v289.

**남은 것(이번에 안 함):** `dummy_encode`의 drop-first 옵션은 넣지 않았다. 기존 프로젝트의 데이터 의미를 바꾸므로 별도 결정 사항이고, 지금은 회귀가 원인과 조치를 명확히 안내하므로 사용자가 막히지 않는다.

---

## 세션 기록 — 2026-07-17 (T1 하드닝 배치 — A2·A4·A6·B1 + 배포 빌드)

사용자가 배포(우선 http → 향후 Cloudflare/AWS + HTTPS + 공개 서비스)를 염두한다고 밝혀 §12 T1 착수. **원칙 재확인: 로컬 단독 사용이 1순위이므로 dev 경로는 건드리지 않고 전부 추가로만 구현.**

- **A4 클립보드 (해소)**: `Charts.clipboardSupport()` — secure context를 **런타임 감지**해 `ready`/`insecure`/`unsupported` 판별. HTTPS 이전 시 코드 변경 없이 자동 정상화. 차트 복사는 사유 안내 + **PNG 자동 폴백**(기존엔 "지원하지 않는 브라우저"라는 **거짓 메시지** 후 사용자 방치), 공유링크는 사유 안내 + 수동 복사. E2E `clipboardFallback` 4.
- **B1 다중 탭 (경고까지 해소)**: BroadcastChannel announce/here/close/saved. `getStatus().conflict`·`peerCount`·`peerSavedAt` 노출, 상단바 배지(피어 저장 시 stale 강조). **잠금 아님** — 무시하면 여전히 덮어씀(§12에 잔여 기록). E2E `multiTabConflict` 3(실제 2탭).
- **A6 저장 한계 (해소)**: 경고보다 **실제 완화책** 우선 — init에서 `StorageManager.persist()`로 축출 면제 요청. `getStatus().storage`(`granted`/`best-effort`/`unsupported`)로 노출하고 **granted가 아닐 때만** 1회 배너. 프로브가 throw해도 부팅 무영향. E2E `storageNotice` 5.
- **A2·D2 배포 빌드 (해소)**: `scripts/build.mjs` → `npm run build` → `dist/`. esbuild로 JSX 18개 1:1 트랜스파일(**번들 아님** — `window.*` 전역 + script 순서가 의존성 그래프라 번들링은 별개 대공사), React production **로컬 vendoring**(URL 교체 시 SRI 재계산 문제 회피 + CDN 2회 제거), Babel Standalone 제거. **개발은 no-build 그대로.**
  - **함정**: 로더가 `window.Babel`을 체크해 dist에서 영원히 실패 → 빌드가 이 게이트도 재작성.
  - `scripts/verify-dist.mjs` → `npm run verify:dist`: 빌드 산출물을 **실브라우저로 부팅 검증**(Babel 잔존·text/babel·.jsx 참조·전역 누락·모드전환·IndexedDB·콘솔에러). "빌드 성공"과 "동작"은 다르다.

**빌드가 잡아낸 잠복 버그 2건 (dev에선 보이지 않던 것):**

1. 🚨 **`grid.jsx` TDZ — dist에서 Data 모드 즉시 크래시 (수정함)**. 키보드 네비 `useEffect`가 `pageRows`(const) **선언 위**에 있어 의존성 배열이 렌더 중 TDZ를 읽음. **dev는 브라우저 Babel이 const→var로 낮춰 호이스팅 덕에 우연히 동작**하던 것. esbuild는 const 유지 → `Cannot access 'pageRows' before initialization`. effect를 선언 아래로 이동 + 재발 방지 주석. **이 앱이 Babel의 다운레벨링에 의존하고 있었다는 뜻** — 유사 패턴이 더 있을 수 있으므로 `npm run verify:dist`를 배포 전 필수로 유지할 것.
2. ✅ **`mapMode.jsx` 중복 키 `북구` — 수정 완료** (커밋 3, §12 C9 해소). esbuild `duplicate-object-key` 경고. `MUN_LATLON`이 시군구명만으로 좌표를 찾는데 `북구`가 부산·광주 두 번 → 뒤가 이김. 데이터셋에 `북구` 3개(부산/대구/광주)·`서구` 3개가 있어 **여러 도시 버블이 한 좌표에 겹쳐 찍힘**(부산 북구가 광주에, 약 200km 오차). 데이터에 `province` 필드가 있는데 미사용. 수정은 이번 배치 범위 밖 — 사용자 판단 대기.

**추가 (2026-07-17, 커밋 2)**:
- **§13 로그인·회원관리 A 확정** — "접근 제한만, 앱 코드 0줄". 데이터는 브라우저 로컬 유지(서버 보관 책임 없음). §13.3(전용페이지 vs 관리자계정)은 **보류**(C 이상 승격 시에만). **배포처는 여전히 미정** → §13.3′에 Cloudflare Access / AWS / Nginx별 실행 방법만 준비. ⚠️ Basic Auth는 http에서 평문 전송이므로 "우선 http" 구간에는 접근 제한을 적용하지 않거나 공개하지 않는다.
- **`verify:dist`를 9개 모드 전수 순회로 확장** — 기존엔 data·visualize만 봤다. grid.jsx TDZ는 **어느 모드에나** 있을 수 있는 클래스이므로 한 모드 통과는 나머지 8개를 보증하지 않는다. **ML 포함 9/9 정상 확인**(사용자 ML 검증 요청 대응).
- **`dashMode.jsx` ResizeObserver null 가드 (수정함)** — 확장된 검사가 잡음. 대시보드 이탈 시 컨테이너 리사이즈 → 큐된 RO 콜백이 언마운트 후 발화 → `ref.current.clientWidth`가 null. **WORKLOG에 "ml 진입 시 clientWidth 에러 1건, 비차단"으로 오래 방치되던 바로 그 건.** 크래시는 아니지만 프로덕션 콘솔에 uncaught TypeError가 남는다. 콜백 내부 가드 + 캡처한 엘리먼트 관찰로 해소. 동일 패턴은 charts.jsx뿐이며 이미 가드 있음.

**검증**: **Node 329/329** · **E2E 43/43**(기존 25 + 신규 18) · **`verify:dist` 9개 모드 전수 통과(콘솔 에러 0)** · asset v286.
**추가 (2026-07-17, 커밋 3 — C9 해소 + 지도 타일 후보 등재)**
- **C9 수정**: `MUN_LATLON_BY_PROV`(`시도|이름`) 우선 조회. 모호한 `북구`/`서구`는 평면 맵에서 **제거** — province 없이는 아예 해석되지 않게(틀린 도시에 조용히 찍는 것보다 안 찍는 게 낫다). 좌표 미상 시 서울 `[37.5,127.0]`에 찍던 폴백 제거 → skip + 경고. 툴팁 `dataIndex`가 어긋나지 않도록 `munPlaced` 단일 배열로 통일. 대구 북구는 애초에 항목이 없어 광주로 갔었음 — 좌표 3개 신규 추가(대구 북구·대전 서구·광주 서구). E2E `mapCoords` 3(84개 전부 고유 좌표 · 동명 3쌍 분리 · 소속 시도 근접성 검증). **esbuild 경고 0.**
- **§14 지도 타일 배경(MapTiler) 후보 등재** — 사용자 동기는 "도로·지형 위 표기", 의사는 "천천히". 착수 조건만 명시: 배포처·HTTPS 확정 → 키 도메인 제한 → 오프라인 폴백 설계 → **"내 데이터" 탭 한정**(choropleth 탭은 타일이 방해). ECharts 단독 불가(MapLibre GL 추가 필요), 무료 할당량·CDN 의존 추가가 §12 A3′와 동종 리스크임을 기록.

**추가 (2026-07-17, 커밋 4 — C3 해소)**
- **`js/ui.jsx`(`window.UI`) 신규** — 토스트 + promise 기반 `alert`/`confirm`/`prompt`. 네이티브 다이얼로그 **20곳 전부 교체**(alert 14·confirm 2·prompt 4; `combineModal.jsx:69`는 동명 로컬 함수라 오탐이었음).
- **왜 중요한가**: 네이티브 다이얼로그는 단순히 못생긴 게 아니라 **이벤트 루프를 블로킹**한다 — 임베드/iframe 호스트가 멈추고, **E2E helper가 `page.on("dialog", d=>d.dismiss())`를 미리 걸어야 스위트가 안 멎었다**(그 워크어라운드 자체가 C3의 근거였다). Chrome의 "추가 대화상자 방지"가 이후 메시지를 조용히 삼키는 문제도 있다.
- **설계**: 계약을 네이티브와 동일하게(`confirm`→bool, `prompt`→string|null) 유지해 호출부는 `await`만 붙고 로직은 그대로. 상태는 모듈 레벨 store(=`window.Store` 패턴)라 컴포넌트 밖(async 플로우·엔진)에서도 훅 없이 띄울 수 있고, 부팅 중 발생한 토스트도 `Host` 마운트 시 그대로 표시된다. Escape 취소·Enter 제출·자동 포커스.
- E2E `uiDialogs` 7 — 토스트 스택/자동소멸/클릭소멸, confirm 3분기(확인·취소·Escape), prompt 값/null, alert에 취소 없음, **실제 rename/delete 플로우에서 네이티브 다이얼로그 미발화 명시 검증**.

**미해소 T1**: A3′(DuckDB 로컬 벤더링 — 여전히 런타임 jsDelivr), A5(oklch 브라우저 하한), B1 잠금(경고까지만).

## 세션 기록 — 2026-07-17 (문서 드리프트 복구 + FOLLOWUP 분해 + 브랜치 정리)

낡은 로컬 클론(07-10 `76d5333`)에서 시작한 세션. 낡은 `WORKLOG`를 신뢰해 **이미 6일 전 완료된 작업(M1 병합·M2 XLSX Import)을 재실행하려다** `git log main..origin/main`에서 180커밋 격차를 발견하고 중단 — 상세는 상단 ⚠️ 문서 드리프트 사고 참조.

- **동기화**: 로컬 `main` 고유 커밋 0개 확인 후 `origin/main`으로 fast-forward(184커밋) → `dadf6e8`. 로컬에서 잃은 작업 없음.
- **검증**: **Node 329/329 통과** · asset v282 · 원격 브랜치 9개 전부 main 병합 확인(미병합 0).
- **문서 재편(사용자 지시)**: `IMPLEMENTATION_PLAN.md`를 계획 **정본**으로 확정. FOLLOWUP(다른 모델 제안)을 분해 — 완료분 24항목 → 본 문서 §완료 원장, 미완분 14항목 → PLAN §12 하드닝 백로그. 원본은 `docs/archieve/`로 이동.
- **잔여 항목 코드 실사**(문서 주장을 그대로 옮기지 않고 재확인): A2 React dev 빌드 ❌잔존 · DuckDB 벤더링 ❌부재(CDN 런타임 import) · A5 `oklch/color-mix` 7개 CSS ❌잔존 · B1 다중탭 방어 ❌부재(BroadcastChannel/Web Locks 없음) · C1 `useStore` selector 비교 ❌없음(전역 force render) · C3 `alert/confirm` 17곳 잔존 · C6 aria 1개. **B2·A3(ECharts)·C2·C4는 해소 확인.**
- **README** v1.9.0 → v2.0.0 최신화(DuckDB·공유링크·PPT·ML 10종·SPC/시계열/PCA 반영).
- **브랜치 정리**: 병합 완료된 로컬/원격 브랜치 제거.
- **미실행**: E2E·tsc는 이 세션에서 돌리지 않음. 브라우저 IndexedDB 왕복도 미실시(로컬 서버가 이 환경 Chrome에서 `ERR_CONNECTION_REFUSED` — 샌드박스 네트워크 격리 추정, Playwright 경로는 정상이므로 차단 아님).

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
4. **후속작업 제안 검토**: [`docs/archieve/FOLLOWUP_PROPOSALS.md`](./docs/archieve/FOLLOWUP_PROPOSALS.md) *(당시 `docs/`에 있었음 — 2026-07-17 폐기·이동)* — 실브라우저 클릭 검증(2026-07-12) 결과 기반 P1~P12 우선순위 제안 (미배선 UI·getActiveData 메모·편집 op 견고성 3종·i18n 잔존·E2E 자동화 등). 참고: 위 1번 실브라우저 왕복 중 편집/피벗→차트/Export/SPC/ML은 제어 브라우저로 검증 완료.

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

---

# 릴리스 이력 (구 `CHANGELOG.md` 통합)

> **2026-07-17 통합.** 릴리스 이력을 별도 `CHANGELOG.md`로 두면 세션 로그(위)와 갱신 시점이 갈려
> 한쪽만 업데이트되는 드리프트가 반복됐다. 두 문서 모두 "무엇이 언제 바뀌었나"를 기록하므로
> 이 파일 하나로 합치고 `CHANGELOG.md`는 삭제했다. 아래는 통합 시점까지의 이력 전문(원문 보존, 헤딩 레벨만 조정).
>
> **앞으로:** 릴리스 단위 변경은 이 절에, 세션 단위 작업은 위 `세션 기록`에 적는다.

### [Unreleased] — P10 공유 링크 + 보안·품질 (2026-07-16~17)

> FOLLOWUP §5 C4·A1 완료 후, P10 공유 링크 구현. Node 315/315 · E2E 25/25 · tsc 0.

#### Added — PPT 네이티브 차트 매핑 확장 (P10, `feat/p10-pptx-chart-mapping`)
- **PowerPoint(.pptx) 내보내기가 스택·보조축·콤보 차트를 네이티브(데이터 편집 가능)로 매핑**. 이전엔 단일 막대/라인/영역/파이만 대응 → 이제 렌더된 ECharts 옵션을 읽어 구조를 자동 판별:
  - **스택**: 시리즈 `stack` 키 → `barGrouping: "stacked"`(막대·영역 모두).
  - **보조축(secondary axis)**: `yAxisIndex===1` 시리즈 → `secondaryValAxis/secondaryCatAxis` 콤보로 우측 축 보존.
  - **콤보**: 막대+라인 혼합 → 멀티타입 `addChart([...])`.
  - **캔들스틱·분산형·박스플롯**: PPT 네이티브 대응 형식이 없어 정직하게 `unsupported` 반환 → 이미지/SVG 폴백 안내(가짜 매핑 없음).
  - `js/pptxExport.js`: 순수 `planChart(viz, option)`/`extract()`(Node 테스트 가능)로 구조 결정 + 얇은 브라우저 `exportChart()`가 PptxGenJS 구동. **출력 계약 하위호환**(기존 `exportChart` 시그니처 유지).
  - `tests/pptxExport.test.js`(14: 스택·보조축·콤보·캔들스틱 unsupported 등) + `tests/e2e/pptxExport.spec.mjs`(실 PptxGenJS로 스택·콤보 유효 blob 생성·캔들스틱 폴백).

#### Added — 공유 링크 (P10, `feat/p10-share-link`)
- **프로젝트 공유 링크**: Projects 메뉴에 **Share link** — 현재 프로젝트(데이터 포함) 전체를 `#p=…` URL fragment로 인코딩해 클립보드 복사. 링크를 열면 데이터·분석이 그대로 재현. **백엔드 불필요**(fragment는 서버로 전송 안 됨 → no-build/local-first 유지).
  - `js/shareLink.js`(`window.ShareLink`): 이식 번들 ↔ JSON ↔ base64url ↔ fragment. 브라우저 `CompressionStream`(deflate-raw) 압축 + 무압축 폴백, 1자 코덱태그(z/r). 크기 상한 `MAX_PAYLOAD_CHARS`(32k) 초과 시 JSON 파일 폴백 안내.
  - `projectStore.exportBundle()`(파일 저장 없이 번들 반환), 부팅 시 `#p=` 감지→`importJSON`→`history.replaceState`로 fragment 정리(리로드 재임포트·주소창 노출 방지).
  - **보안**: A1 안전파서 전제 — 공유 번들의 Formula Column은 `FormulaEval`로 평가되어 코드실행 불가.
  - `tests/shareLink.test.js`(8) + `tests/e2e/shareLink.spec.mjs`(코덱 왕복 + 실브라우저 열기·fragment 정리).

#### Added — C4 export 대상 명시 (`fix/c4-export-target`)
- Chart export가 전역 `Charts.lastInst` 대신 **활성 차트 인스턴스**를 명시 대상화(EChart `onInst` 콜백 + export 헬퍼 optional `inst` 인자, 폴백 하위호환). 대시보드 다중차트·차트전환 직후 엉뚱한 차트 export 방지. `tests/e2e/chartExport.spec.mjs`.

#### Security — A1 formula 안전파서 (`fix/a1-formula-safe-parser`)
- Formula Column의 `new Function("row","Math",expr)` **임의 코드실행 취약점 제거** → `js/formulaEval.js`(`window.FormulaEval`, eval/new Function 없는 재귀하강 파서). `row.*` 읽기 + `Math.*` 화이트리스트만, 프로토타입 체인 차단(`constructor.constructor` 탈출 봉쇄). `tests/formulaEval.test.js`(12) + `tests/e2e/formulaColumn.spec.mjs`.

---

### [Unreleased] — 안전 후속 배치 (2026-07-12, `feat/safe-hardening` → main `9c7c6b3`)

> FOLLOWUP §5 저위험 자율 항목 일괄. 전부 저위험(테스트/인프라·폴백·핸들러·속성). Node 295/295 · E2E 21/21 깨끗 종료 · tsc 0.

#### Added
- **SQL 폴백 유니코드 식별자** (B3): DuckDB 실패 시 폴백 `runSQL`을 `js/sqlFallback.js`(dual-mode) 로 추출, `[\w]+`→`[\p{L}\p{N}_]+`(u 플래그) — 한글 컬럼/테이블명 조회 가능. `tests/sqlFallback.test.js` +7(한글 GROUP BY·WHERE·LIKE·alias).
- **계절분해 multiplicative E2E**: `tests/e2e/statsDecomp.spec.mjs` — Stats›Decomposition›multiplicative UI 경로 무크래시 검증(엔진은 기존 Node 테스트).
- **캐시버스트 자동화** (P12): `scripts/bump-assets.sh` + `npm run bump` — `index.html`의 모든 `?v=`를 단일 번호로 원자적 통일·증가. 드리프트(275/276) → v277 통일.

#### Changed / Fixed
- **언로드 저장 플러시** (B2): `projectStore` `pagehide`/`beforeunload`에 `saveNow()` — 1초 디바운스 창에서 탭 종료 시 마지막 편집 유실 방지.
- **ECharts SRI** (A3): `echarts@5.5.1`에 `integrity`(sha384)+`crossorigin` 추가(React/Babel과 동일 보증).
- **다변량 이상치 카드 컬럼명 툴팁**: Clean 이슈바 이상치 카드에 대상 컬럼명 `title=` 노출.
- **E2E 인프라 견고화**: `tests/e2e/helpers.mjs`(hydration-safe `bootApp` + `teardownDuckDB`)로 7스펙 통일. **전체 스위트 5분 force-kill 해소** — `playwright.config` `launchOptions(--disable-gpu/--disable-dev-shm-usage/--no-sandbox)` + `workers:1` → 5.5분(kill 2~3) → 2.3분·kill 0.

#### 제외 (별도 결정 필요)
- C4 차트 export 대상 · A1 formula 안전파서(공유 기능 도입 시) · C2 클릭=선택 UX.

### [Unreleased] — v2.0.0 이후 ML 확장 (2026-07-12, `feat/ml-expansion`)

#### Added — ML 데이터 적격성 (P13) + 신규 모델 (P10)
- **데이터 적격성 검증**: `mlEligibility`가 데이터로 실행 가능한 태스크만 활성화 — 부적격 태스크 버튼 비활성+사유, target은 적격 컬럼만+클래스수 주석, `alert()` 전면 제거(인라인 안내). 기본 target `id` 회피.
- **Logistic one-vs-rest**: 다중클래스 대상 + 양성 클래스 선택으로 이진화(2클래스 없는 데이터에서도 사용 가능).
- **Decision Tree** (CART gini), **Naive Bayes** (Gaussian), **Cross Validation** (k-fold, mean±std) — 순수 엔진 + mlMode 배선. `tests/{decisionTree,naiveBayes,crossVal}.test.js` +35, ML E2E +6.

### [2.0.0] — 2026-07-12 · DuckDB-WASM SQL 엔진

#### Added / Changed
- **SQL 모드를 DuckDB-WASM으로 전환**: CDN ESM 모듈 island, 전체 데이터셋 테이블 등록(**데이터셋 간 JOIN**), 전체 SQL(subquery·**window**·**CTE**·전체 함수), 한글/특수문자 컬럼 조회. CDN 실패 시 기존 JS 엔진 폴백. Arrow→앱 타입 매핑(Decimal/BigInt/날짜).
- **Playwright E2E 회귀망**: 모드 전환·DuckDB 로드/쿼리·ML 학습 등 헤드리스 자동 검증(시스템 Chrome).
- **Fixes**: 모드 전환 크래시(app.jsx 엘리먼트 렌더) · ML 결과 렌더 크래시(§0-0b) · getActiveData 메모이제이션 · 편집 견고성.

### [Unreleased] — Phase 2 (진행 중)

#### 밤샘 자율 작업 — 견고성·테스트·분석 엔진 (2026-07-12, `feat/analytics`)
> 계획: `docs/OVERNIGHT_PLAN.md`. 매 항목 tsc(TS1xxx 0)+Node 테스트+asset bump 후 커밋. **Node 98 → 217** (+119 테스트).

##### Added — 신규 순수 분석 엔진 (브라우저 단독·결정적·Node 테스트)
- **`timeSeriesDecomp.js` (window.TSDecomp)**: 고전적 계절분해(중심이동평균 추세·짝수주기 2×period 위상정렬 → 계절지수 → 잔차, additive/multiplicative)
- **`outliers.js` (window.Outliers)**: 다변량 Mahalanobis 거리 이상치(자기완결 Gauss-Jordan 역행렬 + Wilson-Hilferty χ² 컷오프, alpha/topK, 특이공분산 degrade)
- **`geoMatch.js` (window.GeoMatch)**: 지역명 정규화·매칭(한국 행정접미사·EN/KO 별칭) — 데이터 기반 단계구분도(choropleth)용
- **분포 적합 확장(`distributionFit.js`)**: 지수·로그정규 MLE + `compareFits` AIC 랭킹(어떤 분포가 가장 잘 맞나)

##### Fixed — 엔진 엣지케이스 버그 & 모드 크래시 가드
- **pivotEngine**: null/빈 차원값 그룹의 셀·소계가 0으로 표시되던 정합 버그(버킷키 정규화 불일치) → 소계=총계 복원
- **clustering**: `hierarchical.labelsAt(k<1)` 크래시 → k 클램프
- **spc**: 빈 서브그룹 X-bar/R·S Infinity/NaN, p·u 차트 크기0, capability 역전 스펙 음수 → 가드/degrade
- **distributionFit**: `jarqueBera` n<4 거짓 "정규" → null
- **모드 견고성 가드**(ANOVA 크래시와 동일 계열): mlMode(특성 0개 회귀 백지화·k-NN 빈투표·scatter Infinity), mapMode(Seoul/World 시드 부재 ds.rows·미매칭 find), statsMode(Builder scatter Infinity), dashMode(인스펙터 measures[0]), vizMode(bubble 5000점 초과 다운샘플)

##### Refactored — 테스트 잠금 (하드코딩-치유/동적생성 로직을 dual-mode 모듈로 추출)
- `statsCfg.js`·`mlCfg.js`·`dashWidgets.js`·`aiIntent.js`·`sheets.js` — 소비 .jsx는 `window.X`에서 배선, 각각 Node 회귀 테스트 확보



#### Planned (아직 미구현)
- SQL JOIN/window 및 DuckDB-WASM 전환
- Decision Tree, Naive Bayes, Cross Validation, Seasonal Decomposition
- PPT 네이티브 차트 매핑 확장(스택/보조축/캔들 등)

#### Added — 차트 서식 & 내보내기 (Chart Format & Export, `feat/analytics`)
> Chart 모드 우측 패널을 **차트 / 서식** 서브탭으로 분리하고, 서식은 PowerPoint식 **카테고리 드롭다운**으로 정리.
- **복합 차트**: 막대/라인/영역에서 측정값별 마크(막대·라인·영역) 지정 → 자동 combo, 스케일 다른 지표는 **보조축(우측)** 분리
- **제목**: 텍스트 + 9방향(세로×가로) 위치 + 자유 드래그
- **범례**: 표시·9방향 위치 + **자유 드래그 배치**(주황 오버레이+핸들+이동완료)
- **값 레이블**: 표시·형식(Full/Compact)·위치
- **축**: X/Y min·max 스케일(극적 표현), X/Y 레이블 방향(자동/가로/45°/세로)
- **격자·보조선**: 표시(투명)·굵기·색상·빈도
- **배경색** · **텍스트**(색·크기·굵게·기울임)
- **계열(다중선택 리스트)**: 계열 선택 후 공통(색·파이 조각분리) 일괄 / 개별(이름·라인 굵기는 단일·동일타입 선택 시). 파이 조각별 색·굵기(도넛)·분리, 막대 간격, 계열별 선 굵기
- **크기 조절**: 프리셋(Auto/S/M/L/XL) + **네 모서리 드래그 리사이즈**(각 모서리는 자기 변만 이동, 반대편 고정) + **리사이즈 대상 전체/플롯만** 선택
- **내보내기 메뉴**: 클립보드 복사(PPT에 Ctrl+V) · PNG(현재/흰색/투명 배경) · **SVG 벡터** · **PowerPoint .pptx(데이터 편집 가능, PptxGenJS 벤더링)**
- **버그수정**: 차트 전체 빈화면(oklch→canvas 폴백), PNG/Save-to-dashboard 죽은 버튼 연결

#### Documentation
- 현재 코드 기준으로 기능 현황 동기화: 차트 20종, 기본 데이터셋 7종, Map 3개 탭, Import/Export 지원 범위
- 이미 구현된 Confusion Matrix, 클래스별 Precision/Recall/F1, OLS Feature Importance, Dashboard Cross Filtering을 예정 목록에서 분리
- README 브랜드 자산 및 Brand Spec 링크를 현재 파일 경로로 수정

#### Added — Core v2 Milestone 1 (기능 브랜치)
- IndexedDB `insight-workbench`에 다중 프로젝트, 데이터셋, 마지막 프로젝트 설정 저장
- Store 변경 후 1초 debounce 자동저장과 `visibilitychange` flush
- 프로젝트 생성·열기·이름 변경·복제·삭제 및 `Saved / Saving / Unsaved / Error` 상태 표시
- schema version 1 portable JSON 백업·복원, 미래 schema 명시적 거부, 동일 ID import 복제
- Store hydration과 데이터셋 등록·삭제 API 중앙화, 복원된 최대 `__rid` 이후 행 ID 연속성 보장
- Node 기본 테스트 러너 기반 persistence/schema 회귀 테스트 추가

#### Added — Core v2 Milestone 2 (기능 브랜치)
- SheetJS CE 0.20.3 standalone build를 로컬 vendoring하고 Apache-2.0 라이선스와 SHA-256 기록
- CSV/TSV/JSON/XLSX 공통 `window.ImportEngine`과 결정적 타입 추론 추가
- CSV 선행 0 코드 보존, 멀티라인/escaped quote, JSON 키 합집합, XLSX 날짜 셀 처리
- Workbook 시트 범위·행/열 수·첫 20행 Preview, 복수 시트 선택, 컬럼별 타입 override UI
- TopBar와 Data Explorer Drop 영역을 동일 Import 흐름으로 통합하고 완료 후 프로젝트 즉시 저장
- Node import 회귀 테스트와 no-build 브라우저 `tests/runner.html` 추가

#### Added — Core v2 Milestone 3 (기능 브랜치, 밤샘 자율)
- 순수 결정적 `window.DataOps` — Union/Join 엔진 (부수효과 없음, 타임스탬프는 호출부 주입)
- Union: 컬럼 key 합집합, 타입 충돌 `boolean→integer→float→string` 승격, 없는 값 null, 선택적 `__source` 컬럼
- Join: Inner/Left/Right/Full, 복수 키 복합 매칭, null 키 미매칭, 숫자·날짜·문자 정규화 비교, 우측 중복 컬럼 리네임, many-to-many 폭증 감지
- 결과는 lineage(`op/sourceIds/joinType/keyPairs/createdAt`) 포함 새 데이터셋으로 materialize
- Combine datasets 모달(Data explorer 진입), 실시간 Preview + 폭증 경고, `registerDataset`+`saveNow` 연동
- Node 9/9 회귀 테스트, `tests/runner.html` DataOps 케이스 추가

#### Added — Core v2 Milestone 4 (기능 브랜치, 밤샘 자율)
- 순수 결정적 `window.PivotEngine` — Rows × Columns 크로스탭 집계 엔진
- 복수 Values와 개별 집계(sum/avg/count/countd/min/max/median), 범주·범위 필터
- 빈 셀 안전 처리(sum/count 0, 그 외 null), Grand Total은 원본 행에서 재계산(avg/median 정확)
- `toDataset` 평탄화 → registerable 데이터셋(옵션 Grand Total 행) + lineage
- Pivot rail 모드: 필드 드래그 shelf(Rows/Columns/Values), 크로스탭 테이블, Save & open in Chart
- Node 8/8 회귀 테스트, `tests/runner.html` Pivot 케이스 추가

#### Added — Core v2 Milestone 5 (기능 브랜치, 밤샘 자율)
- 안전한 `window.KPIFormula` — eval/new Function 없는 재귀하강 파서+평가기
- 문법: `SUM/AVG/COUNT(*)/COUNTD/MIN/MAX/MEDIAN(field)` + `+ - * / ( )` + 숫자 리터럴
- 임의 코드·미지 함수·미지 필드·0 나눗셈 거부(→ `—`), `compute()`는 `{value,error}` 반환
- 위젯 Inspector(우측 패널, 선택 위젯 편집): 공통 제목·크기, KPI(라벨·집계|수식 토글·형식·단위·소수), Chart(타입·차원·측정·집계·색상·Top N), Table(차원·측정·집계·행 제한), Text(평문)
- KPI 위젯이 `spec.formula`를 Cross Filtering 이후 행 기준으로 계산
- Text 위젯 `dangerouslySetInnerHTML` 제거 → 평문 렌더, 기존 `spec.html`은 태그 제거해 `spec.text`로 마이그레이션
- Node 7/7 회귀 테스트, `tests/runner.html` KPI 케이스 추가

#### Changed
- Rail에 **Pivot** 모드 추가(Chart 다음). Dashboard 위젯의 Chart Top N·Table 행 제한을 Inspector에서 조절 가능

#### Added — 분석 엔진 UI 배선 (`feat/analytics`)
- **ML 모드 확장:** 기존 회귀/k-NN/KMeans에 **Logistic Regression + ROC/AUC**, **PCA**(Scree+로딩표), **DBSCAN**, **계층군집(Ward)** 추가. Task 선택기를 7종 그리드로 개편, task별 target/split/k/K/eps·minPts 컨트롤, 5k행 초과 O(n²) 경고.
- **Stats 모드 확장:** **Normal Q-Q**(왜도·첨도·Jarque-Bera + 정규성 판정), **Time Series**(원계열+MA+EMA 라인 + ACF 막대, datetime 자동 정렬), **SPC 관리도**(I-MR 개별값 관리도 + CL/UCL/LCL + 관리이탈점 강조) 추가.
- 언어 토글(한/영)과 Chart 모드 축 라벨(X축·차원 / Y축·측정값) 반영.

#### Added — 언어 전환
- TopBar에 한국어/English 토글(테마 토글 옆). Rail 모드명·Import/Export·Ask Insight 등 UI 라벨 전환, `<html lang>` 반영.

#### Added — 분석 심화 & Show Me (Batch G)
- **Auto Chart Recommendation** (`window.ChartAdvisor`) — Tableau "Show Me"식 규칙 기반 추천(날짜→line, 2측정→scatter, 3→bubble, 범주→bar, 저카디널리티→pie, 2차원→heatmap, OHLC→candlestick). Chart 모드에 원클릭 추천 배너. (Node 8)
- **Time Series**: PACF 막대 추가(ACF와 나란히).
- **SPC**: 선택적 LSL/USL 입력 → 공정능력 **Cp/Cpk/Pp/Ppk** 카드(1.33/1.0 임계 색상).
- **Logistic**: ROC 외 **Precision-Recall 곡선 + AP** 추가.

#### Added — 복합 차트(측정값별 마크) & 보조축
- **막대/라인/영역 차트에서 측정값마다 표시 형태를 개별 지정** — Rows의 측정값 칩을 클릭해 **마크(막대/라인/영역)** 와 **축(좌 주축 / 우 보조축)** 선택. 예: `open`은 막대, `close`는 선 → 자동으로 복합(combo) 차트가 됨(엑셀 "차트 종류 변경" 방식). 스케일이 크게 다른 지표는 **보조축(우측)** 으로 분리.
- 별도 "Combo" 타입 대신, 일반 차트에서 마크를 섞으면 복합차트가 되도록 통합. 색상 차원이 있을 땐 마크 컨트롤 숨김.
- (되돌림) 캔들차트의 임의 MA5/MA20 오버레이 제거 — 데이터에 없는 값을 임의로 표시하지 않음. 이동평균이 필요하면 파생 컬럼으로 생성 예정.

#### Changed
- StatusBar·SQL 배지의 가짜 "DuckDB" 표기를 실제 "in-browser JS/SQL"로 정정 (IMPLEMENTATION_PLAN §9).
- Chart 헤더 **PNG / Save to dashboard** 버튼 동작 연결(기존 무동작).
- **Tweaks 패널 → 설정/Setting** 이름 변경, **Accent 색상 선택 제거**(브랜드 오렌지 고정).

#### Fixed
- **차트 전체가 빈 화면으로 렌더되던 문제 수정** — `charts.jsx`의 `resolveVar`가 `oklch()` 색을 canvas로만 변환하던 탓에, canvas가 oklch를 지원하지 않는 브라우저에서 모든 색이 검정(rgb(0,0,0))으로 폴백 → 다크 배경에서 차트가 보이지 않음. oklch→sRGB 변환을 JS(Ottosson 행렬)로 직접 수행하도록 개선하여 canvas 색공간 지원과 무관하게 정상 색 반환. Chart/Dashboard/Map/Stats 등 ECharts 전반에 적용.

#### Security
- Dashboard Text 위젯의 임의 HTML 주입 경로(`dangerouslySetInnerHTML`) 제거

#### Added — Phase 2 분석 엔진 (기능 브랜치 `feat/analytics`, 밤샘 자율)
> 모두 순수·결정적 window.* 라이브러리로 로드됨. Stats/ML 모드 UI 배선은 후속.
- `window.PCA` — 표준화 공분산 + Jacobi 고유분해, Scree/Biplot (Node 11)
- `window.Logistic` — 경사하강 로지스틱 회귀, ROC/AUC·PR 곡선·지표 (Node 7)
- `window.TimeSeries` — MA/WMA/EMA, Holt 이중지수, diff, ACF/PACF, rolling std (Node 17)
- `window.DistFit` — normInv/normCdf, QQ-정규, 정규 적합, Jarque-Bera, 히스토그램 (Node 10)
- `window.SPC` — I-MR·X-bar/R·X-bar/S·p·c·u 관리도, Cp/Cpk/Pp/Ppk, Pareto (Node 7)
- `window.Clustering` — DBSCAN + 병합형 계층군집(single/complete/average/ward), O(n²) ~5k행 (Node 4)
- 전체 Node 테스트 90/90 통과, `tests/runner.html` 8개 분석 케이스 추가

---

### [1.9.0] — 2026-06-19 — 데이터 직접 편집 (JMP/Excel 스타일)

> Data 모드 그리드에서 임포트한 데이터를 직접 편집. 모든 편집은 기존 **비파괴 스텝 파이프라인**에 기록되어 undo/redo·스텝 로그·원본 보존이 그대로 적용된다.

#### Added

##### 데이터 편집 엔진 (`js/store.jsx`)
- **숨김 행 ID `__rid`**: 모든 원본 행에 단조 증가 정수 ID를 지연 태깅(`getDataset` 길목 — 빌드인/CSV/SQL 전부 커버). `columns`에 미포함되어 그리드에 표시되지 않으며, 정렬·필터·페이징·파이프라인 재배열과 무관하게 행을 안정적으로 지목.
- `applySteps` 신규 op 5종:
  - `set_cell` — 셀 값 변경 (`__rid` 지목, 열 타입에 맞춰 형변환)
  - `drop_rows` — 행 삭제 (단일/다중, `__rid` 배열)
  - `add_row` — 새 행 추가 (새 `__rid` 부여)
  - `add_col` — 빈/기본값 열 추가 (삽입 위치 `at` 지원)
  - `reorder_cols` — 열 순서 재배치 (key 순서 배열)
- store 액션 `editCell·deleteRows·addRow·addColumn·reorderCols` (전부 `addStep` 래퍼 → undo/redo 자동)

##### 편집 가능 그리드 (`js/grid.jsx` · `js/dataMode.jsx` · `css/grid.css`)
- **Edit 토글** (Data 툴바): 평소 읽기전용, 토글 시 편집 모드 + Undo/Redo 버튼·편집 카운터
- **셀 인라인 편집**: 더블클릭 → 입력 → Enter/blur 커밋, Esc 취소
- **헤더**: 더블클릭 rename, 컨텍스트 메뉴 확장(Rename / Change type / Insert left·right / Delete column), **드래그앤드롭 열 순서 변경**
- **행 거터**: 클릭 다중선택, hover × 삭제, Del 키 일괄 삭제
- **하단 바**: Add row · Add column · 선택 행 Delete/Clear
- `DataGrid`는 `editable` prop으로 게이팅 — Clean/SQL 사용처는 영향 없음(읽기전용 유지)
- `edit`/`trash` 아이콘 추가 (`js/icons.jsx`)

##### Clean 모드 통합 (`js/cleanMode.jsx`)
- Data 모드 편집 이력이 Clean 모드 **PIPELINE 로그**에 라벨·아이콘으로 표시 (`stepLabel`/`OP_ICON`에 5종 추가)

#### Fixed
- **`__rid` 누출 방지**: 전체 행 `JSON.stringify` 기반 중복 제거/카운트(`store.jsx` drop_duplicates, `cleanMode.jsx` dup 카드)에서 `__rid` 제외 — 미수정 시 모든 행이 고유로 판정되어 중복 탐지가 무력화되는 문제 해결
- **AIDrawer 견고성**: 편집으로 생긴 `null` `txn_date`·빈 행에 `buildInsights`가 크래시하던 버그 수정 (null 가드 + try/catch + null district 그룹 제외). AIDrawer는 항상 마운트되어 seoul 데이터 인사이트를 계산하므로, 빈 행 추가 시 앱 전체가 다운되던 문제
- CSV export 시 `__rid` 누출 방어 (`js/charts.jsx`)

#### Technical Notes
- 모든 편집은 `state.clean[id].steps`에 기록 → 단일 비파괴 파이프라인으로 정리/편집 일원화
- `index.html` 캐시 버전 `?v=170` → `?v=175` (CSS 링크에도 버전 쿼리 추가)

---

### [1.8.0] — 2026-06-07 — 브랜드 아이덴티티 정립 (Brand Spec v1.0)

#### Changed

##### 워드마크 소문자화 (전 파일)
- `INSIGHT Analytics` → `insight Analytics` — 소문자 워드마크로 전환
  - `in` (tx-hi) + `sight` (Heritage Orange `#E8611A`) + ` Analytics` (tx-faint `#6E6E86`, 0.62em)
  - 로딩 화면(`index.html` `.nl-name`), TopBar(`js/shell.jsx`), 문서 topbar-brand 모두 반영

##### 로고 시스템 (`docs/logo.svg` · `css/app.css`)
- `docs/logo.svg`: 폰트 → IBM Plex Sans, Analytics 크기 16px → 20px(0.62em), 색상 → `#6E6E86`
- `css/app.css`: `.logo-an` — `font-size: 0.62em` (비율 기준), `color: var(--tx-faint)` (스펙 정정)
- `css/tokens.css`: 헤더 주석 `NØDE` → `insight Analytics`, Heritage Orange oklch 값 명시

##### 로고 마크업 분리 (`js/shell.jsx`)
- TopBar 로고: `.logo-in` / `.logo-sight { color:var(--accent) }` / `.logo-an` 세 span 구조
- `text-transform: uppercase` 제거

#### Added

##### Brand Spec 문서 (`docs/insight_Analytics_Brand_Spec_standalone.html`)
- 브랜드 스펙 단독 실행 HTML 파일 추가 (외부 의존 없음, v1.0 · 2026-06)
- 워드마크 3종(표준/컴팩트/단색), 로고마크, 브랜드 컬러, 타이포그래피, 제품군 관계, 복사용 CSS 토큰 포함

##### 브랜드 섹션 전면 갱신 (README · docs)
- `README.md`: 워드마크 HTML 스니펫, Heritage Orange 컬러표, 타이포그래피표, 제품군표 추가
- `docs/index.html`: 워드마크 4열 표(토큰/실제값), 컬러표(Heritage Orange/Hi/Soft/Hub Blue), 제품군표, HTML 코드 예시 추가
- `docs/user-guide.html`: 동일 구조로 사용자 관점 재작성, Analytics 색상 `tx-lo` → `tx-faint` 정정

#### Technical Notes
- **Heritage Orange**: `#E8611A` / `oklch(0.70 0.17 47)` — 기본 accent · `sight` 강조색
- **형제 제품**: insight Data hub — Hub Blue `#3F74E8` / `oklch(0.62 0.15 250)` (참조용)
- **Analytics 크기**: 워드마크 기준 0.62em — 이전 구현(0.5em) 대비 스펙 준수
- `index.html` 스크립트 태그 전체에 `?v=170` 캐시 버스팅 쿼리 추가 (v1.7.0 포함 사항)

---

### [1.7.0] — 2026-06-07 — Clean 모드 전처리 강화 (Phase 2 첫 번째 배치)

#### Added

##### Clean 모드 — 인코딩 (store.jsx · cleanMode.jsx)
- **Label Encode** (`label_encode`): 문자열 컬럼 → 정수(0,1,2…) 새 컬럼(`_enc`) 추가. 고유값 알파벳 정렬 후 인덱스 부여.
- **Dummy Encode** (`dummy_encode`): One-Hot 인코딩 — 고유값마다 `col_값` 0/1 정수 컬럼 추가. 고유값 20개 초과 시 사전 경고.
- **Drop Column** (`drop_col`): columns 배열 + 모든 row에서 컬럼 완전 삭제.

##### Clean 모드 — 수치 변환 (store.jsx · cleanMode.jsx)
- **Standardize** (`standardize`): Z-Score 표준화 — (x−μ)/σ, 4자리 반올림, 제자리 변환.
- **Normalize** (`normalize`): Min-Max 정규화 — (x−min)/(max−min), 0~1 범위, 제자리 변환.
- **Log Transform** (`log_transform`): log1p(x), x > −1 조건 검사 후 적용.
- **Rank Transform** (`rank_transform`): 오름차순 순위값(1..n) 제자리 변환, 정수 타입으로 변경.
- **Winsorize** (`winsorize`): 상하 p% 분위수 클리핑 (기본 p=5, UI에서 1–49 조정 가능).
- **Binning** (`binning`): 등폭 N구간 → `col_bin` 범주 컬럼 추가 (기본 5개, UI에서 2–50 조정).

##### Clean 모드 — Formula Column (store.jsx · cleanMode.jsx)
- **Formula** (`formula`): JS 수식으로 파생 컬럼 생성.
  - **안전 평가기** `window.FormulaEval.compile(expr)` — eval/new Function 없는 재귀하강 파서. `row` 객체로 컬럼 값 접근, `Math.*`(화이트리스트) 함수 사용 가능. 프로토타입 체인·전역 접근 차단(A1 보안). *(구: `new Function("row","Math",expr)` — 코드실행 취약점으로 제거됨)*
  - 수식 오류 시 해당 셀 `null` 처리 (전체 파이프라인 중단 없음).
  - 결과 타입 자동 감지 → integer / float / string 컬럼 메타 생성.

##### index.html
- 전체 JS/JSX 스크립트 태그에 `?v=170` 캐시 버스팅 쿼리 추가 (개발 환경 브라우저 캐시 문제 해결).

#### Changed
- `stepLabel()` / `OP_ICON`: 신규 10개 op 모두 한국어 레이블 + 아이콘 등록.
- `CleanPanel` destructure: `rows` 추가 (Dummy Encode 고카디널리티 경고에 현재 정제 행 기준 사용).

---

### [1.6.0] — 2026-06-07 — Map 강화 + Export/Import

#### Added

##### Export / Import
- **Export 드롭다운** (`js/shell.jsx`): 차트 PNG (`echarts.getDataURL`, pixelRatio:2) + 현재 데이터 CSV 내보내기
- **Import 모달** (`js/shell.jsx`): CSV / TSV / JSON 파일 드래그앤드롭 또는 클릭 업로드. 헤더 자동 파싱, 숫자 컬럼 자동 감지, `window.NODE.datasets`에 주입.

##### Map 모드 — World · GDP 탭
- ECharts v4 CDN (`echarts@4.9.0/map/json/world.json`)으로 world GeoJSON 로드
- 30개국 choropleth: GDP(명목) / Per Capita / Population / Growth 4개 메트릭
- 우측 패널: 국가별 순위 바차트

##### Map 모드 — Korea · 행정구역 탭
- Highcharts map-collection CDN (`@highcharts/map-collection@2.0.1`) 한국 GeoJSON 로드
  - properties.name 영문 → 한국어 리맵 후 `echarts.registerMap("korea_prov")`
- **시도 뷰**: 17개 시도 choropleth (인구/인구밀도/면적/GRDP), 시도 클릭 → 시군구 드릴다운
- **시군구 뷰**: 84개 주요 시군구 버블 오버레이. 시도 필터 드롭다운.
  - `wgs84ToHCKorea(lon, lat)` 함수: WGS84 → UTM Zone 52N → Highcharts 투영좌표 변환 (Highcharts GeoJSON이 UTM52N 좌표계 사용 — WGS84 아님)
- 우측 패널: 시도/시군구 인구 순위 바차트 + 권역별 인구 집계

##### Map 모드 — 내 데이터 모드 (Korea 탭)
- `detectGeoColumns()`: 활성 데이터셋 컬럼명 패턴 매칭으로 위도/경도 컬럼 자동 감지
  - 위도 패턴: `lat / latitude / 위도 / y / y_coord`
  - 경도 패턴: `lon / lng / longitude / 경도 / x / x_coord`
- 감지 시 탭에 **✦** 배지 표시, 드롭다운에 자동 입력
- 위도·경도·값·라벨 4개 컬럼 선택 드롭다운
- 한국 영역(위도 33–39°, 경도 124–132°) 외 좌표 자동 필터링
- 50개 이하 포인트 시 라벨 자동 표시

#### Fixed
- Map 탭 전환 시 "Rendered more hooks than during previous render" 오류 → `<Workspace key={tab}>` 강제 리마운트로 해결
- World GeoJSON 404 (ECharts v5에 map 번들 없음) → `echarts@4.9.0` CDN으로 교체

#### Technical Notes
- 한국 시도 GeoJSON CDN 조사 결과: `southkorea-maps` (GitHub raw → 404, jsDelivr → 403), `echarts@4` south-korea → 404. **Highcharts map-collection npm CDN만 정상 동작**.
- Highcharts GeoJSON 좌표계: UTM Zone 52N 투영좌표 (`hc-transform`: scale=0.001170, jsonres=15.5, xoffset=114507.65, yoffset=4275280.76)

---

### [1.5.0] — 2026-06-06 — JMP Statistical Enhancement

#### Added
- **`js/insightEngine.js`** (신규 모듈): 규칙 기반 자동 해석 엔진
  - `window.IE.profileDataset(id)` — 데이터셋 형상, 결측, IQR 이상치, 왜도 플래그, 최강 상관계수 자동 탐지 (string[] 반환)
  - `window.IE.summarizeCorrelation({ cols, matrix })` — 최강 상관쌍 및 |r|>0.5 쌍 수 요약
  - `window.IE.summarizeRegression({ r2, adj, terms, target, pF })` — R² 품질 등급 + 유의 예측변수 목록
  - `window.IE.summarizeClustering({ K, sizes, inertia })` — 군집 균형도 평가
  - `window.IE.summarizeClassification({ acc, classes, cm, k })` — 정확도 + 클래스별 P/R 요약
  - `window.IE.recommendNextStep({ lastTest, lastResult })` — 현재 분석 맥락 기반 다음 분석 제안 (`{ icon, text }`)

- **`js/statsMath.js`**: 왜도(skewness) / 초과 첨도(excess kurtosis) 함수
  - `window.SM.skewness(a)` — 표본 왜도 (n/((n-1)(n-2)) 보정, n<3이면 null)
  - `window.SM.kurtosis(a)` — Fisher 초과 첨도 (n<4이면 null)

- **Stats 모드 — Distribution 탭** (`js/statsMode.jsx`):
  - 컬럼 선택 → ECharts 히스토그램 (카테고리 축, 구간 레이블)
  - 수평 박스플롯 (`layout: "horizontal"`) + IQR 이상치 scatter overlay
  - n, Missing, Mean, Median, Std, Min, Max, Q1/Q3, IQR, Skewness, Kurtosis, Outliers 8카드
  - IE Interpretation 패널 + Next Step 패널

- **Stats 모드 — Analysis Builder 탭** (`js/statsMode.jsx`):
  - Target 컬럼 + Input 컬럼 다중 선택 UI
  - 컬럼 타입 자동 감지 → 회귀(OLS) / 일원 ANOVA / 카이제곱 중 자동 선택
  - Summary / Visual / Statistical Results / Next Step 4개 섹션으로 결과 표시

- **Stats 모드 — 모든 탭**: `InterpretationPanel` + `NextStepPanel` 컴포넌트 추가 (분석 완료 후 자동 표시)
- **Stats 모드 — Descriptive 탭**: 기술통계 테이블에 Skewness / Kurtosis 컬럼 추가 (|sk|>1.5 경고 색상)

- **ML 모드 — 분류(Classification)** (`js/mlMode.jsx`):
  - `perClass` 배열: 클래스별 `{ tp, fp, fn, prec, rec, f1 }` 계산
  - `macroF1` 산출
  - 클래스별 Precision / Recall / F1 / TP / FP / FN 테이블 (F1 컬러 코딩)

- **ML 모드 — 군집(KMeans)** (`js/mlMode.jsx`):
  - `clusterMeans` 산출: 군집별 특성 평균 (원본 스케일 역정규화)
  - Feature × Cluster 특성 표 표시

- **ML 모드 — Model Comparison History** (`js/mlMode.jsx`):
  - `window.NODE.mlHistory` — 렌더 간 영속 배열 (Store 외부)
  - 최근 10개 실행 비교 테이블 (#/Task/Target/Metric/Score)
  - Train 시 `window.NODE.lastAnalysisResult` 갱신

- **Ask Insight 드로어** (`js/aiDrawer.jsx`):
  - `IE.profileDataset(activeId)` 렌더마다 자동 실행 → "Dataset Profile" 섹션 표시
  - `window.NODE.lastAnalysisResult` 존재 시 "Last Analysis Result" 섹션 표시
  - 6번째 Suggest 칩: "Summarize last analysis"
  - NL 키워드 확장: `corr/regress/distribut/ml/machine/learn` 등 Stats/ML 탐색 인텐트

- **CSS — `css/stats.css`** (추가):
  - `.interpretation-panel`, `.ip-head`, `.ip-body` — 파란색 해석 패널
  - `.nextstep-panel`, `.ns-head`, `.ns-body` — 초록색 다음 단계 패널
  - `.result-section`, `.rs-label` — 섹션 레이블
  - `.analysis-builder`, `.ab-section`, `.ab-summary` — Analysis Builder 레이아웃

- **CSS — `css/ml.css`** (추가):
  - `.clf-metrics` — 클래스별 메트릭 + 군집 표 래퍼
  - `.model-comparison-table` — 밀집 비교 테이블 (우정렬 숫자 셀, hover 배경)

- **`index.html`**: `<script src="js/insightEngine.js"></script>` 추가 (statsMath.js 이후, icons.jsx 이전)

#### Changed
- `window.SM` exports 확장: 기존 `{ gammp, gammq, betai, tP, fP, chiP, matInverse, gammln }` → `skewness, kurtosis` 추가
- Stats 모드 TESTS 배열: 6개 → 8개 (`distribution`, `builder` 탭 추가)
- ML 모드 Train 버튼: 훈련 완료 후 자동으로 `window.NODE.mlHistory` 및 `lastAnalysisResult` 갱신

---

### [1.0.0] — 2026-06-06 — Phase 1 Initial Release

#### Added
- 전체 8개 모드 UI 프레임워크 (Data / Clean / SQL / Chart / Map / Board / Stats / ML)
- 서울 아파트 실거래가 시뮬레이션 데이터셋 3종 (`seoul_txns` 503행, `monthly_index` 42행, `district_stats` 12행)
- KOSPI 금융 데이터셋 (`KOSPI_Stock` 320행 OHLCV)
- 20종 ECharts 차트 타입 (Basic 8 / Advanced 8 / Financial 3 / Special 1)
- 다크/라이트 테마 + Tweaks 패널 (layout/tone/density/accent/sidebar)
- DataGrid: 검색, 정렬, 필터, 컬럼 고정, 페이지네이션
- Cleaning Studio: Missing/Duplicate/Outlier 원클릭 처리 + Undo/Redo 파이프라인
- Local SQL Engine: SELECT/WHERE/GROUP BY/집계/ORDER/LIMIT
- Correlation / T-Test / ANOVA / Chi-Square / Regression 통계 검정
- In-browser AutoML: OLS 회귀, k-NN 분류, KMeans 군집
- Seoul 25구 Choropleth (GeoJSON) + Bubble Map 폴백
- Drag/Resize 위젯 대시보드 + Cross Filtering
- Ask Insight AI 드로어 (규칙 기반 인사이트 + NL→차트 라우팅)
- 로딩 화면 (의존성 상태 체크 + 애니메이션 링)
- 개발자 매뉴얼 (`docs/index.html`, 자기 완결형 HTML)
