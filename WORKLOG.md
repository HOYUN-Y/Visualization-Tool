# NØDE Analytics Workbench — Work Log

> 이 파일은 세션 간 작업 연속성을 위한 로그입니다.  
> 변경사항 발생 시 자동으로 업데이트 & git push 됩니다.

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
