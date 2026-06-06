# INSIGHT Analytics Workbench — Work Log

> 이 파일은 세션 간 작업 연속성을 위한 로그입니다.  
> 변경사항 발생 시 자동으로 업데이트 & git push 됩니다.  
> **자동 푸시 훅 활성화 완료** (PostToolUse → Edit|Write → auto-push.sh)

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
> - 오프라인 시 지도(Map 모드)는 버블맵 폴백으로 동작 (GeoJSON CDN 미접근)
> - 파일 로드 순서가 중요 (`index.html` 내 `<script>` 순서 변경 금지)
> - 크로스파일 공유는 `window.*` 전역 변수로만 가능 (`import/export` 없음)

---

## 📁 프로젝트 구조

```
Visualization Tool/
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
- `js/vizMode.jsx` — 전체 재작성, 차트 타입 8→21종으로 확장
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

**현재 총 차트 수: 21종**

---

---

### Session 3 — 2026-06-06

**작업 내용: 개발 도큐먼트 생성**

**신규 파일:**
- `docs/index.html` — 자기 완결형 HTML 개발 도큐먼트 (오프라인 동작, 외부 의존성 없음)

**문서 포함 내용:**
- 프로젝트 개요, 설계 철학, 기술 스택
- 전체 아키텍처 & 스크립트 로드 순서
- `data.js` — Dataset/Column 스키마, PRNG, 4개 데이터셋 설명
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
- 차트 타입 레지스트리 21종 (그룹별, need 코드 포함)

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

## 🔧 다음 세션 작업 계획 (Phase 2)

> `HANDOFF.md` §12 "Suggested next steps" 참고

- [ ] **파일 업로드**: CSV/XLSX 파일 드래그앤드롭 파싱 → `NODE.datasets` 추가
- [ ] **데이터 영속성**: `localStorage`에 Store 상태 직렬화/복원
- [ ] **Export**: ECharts `getDataURL` → PNG, CSV/XLSX 내보내기
- [ ] **SQL JOIN**: `sqlMode.jsx` 내 `runSQL` 엔진에 JOIN 지원 추가
- [ ] **지도 오프라인**: GeoJSON 로컬 번들링 (Map 모드)
- [ ] **Chart Recommendation Engine**: 선택한 컬럼 타입 조합 → 최적 차트 자동 추천
- [ ] **Cross Filtering 강화**: Dashboard 내 차트 간 실시간 필터 연동
- [ ] **FastAPI 백엔드**: DuckDB/Polars 엔진 연동 (Phase 3)

---

## ⚙️ 자동 로그 업데이트 훅

`WORKLOG.md` 수정 후 항상 git commit & push 수행.  
훅 위치: `.claude/hooks/post-tool-use/auto-push.sh`

---

## 📌 핵심 개발 규칙 (다른 세션 필독)

1. **`window.*`로 내보내기**: 모든 컴포넌트는 `window.X = ...` 또는 `Object.assign(window, {...})`로 끝나야 함
2. **데이터는 항상 `Store.derive.getActiveData(id)`로 읽기**: 직접 `NODE.datasets[i].rows` 접근 금지
3. **`animation: false` 유지**: ECharts 애니메이션 비활성화 — Preview/iframe에서 빈 차트 방지
4. **`.fade` CSS는 opacity 애니메이션 금지**: transform만 허용
5. **하드코딩 컬러 금지**: 반드시 `css/tokens.css` CSS 변수 사용
6. **`<script>` 순서 변경 금지**: `index.html` 로드 순서가 의존성 순서
