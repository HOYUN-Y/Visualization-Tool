<img src="docs/logo.svg" alt="INSIGHT Analytics" height="48" />

# INSIGHT Analytics Workbench

**Local-First Business Intelligence & Data Analytics Platform**

> Tableau의 시각화 + Power BI의 대시보드 + JMP의 통계 + Orange의 분석 흐름 + ChatGPT의 자연어 인터페이스를  
> 하나의 로컬 웹 애플리케이션으로 통합한 개인용 데이터 분석 플랫폼

![Status](https://img.shields.io/badge/Phase-2%20JMP%20Complete-brightgreen)
![Stack](https://img.shields.io/badge/Stack-React%2018%20%2B%20ECharts%205-blue)
![No Build](https://img.shields.io/badge/Build-None%20(Browser--only)-lightgrey)

---

## 🚀 빠른 시작

```bash
# 저장소 클론
git clone https://github.com/HOYUN-Y/Visualization-Tool.git
cd Visualization-Tool

# 로컬 서버 실행
python3 -m http.server 8742

# 브라우저에서 열기
open http://localhost:8742
```

> **빌드 단계 없음** — 순수 HTML + in-browser Babel 구성입니다.  
> Node.js / npm 설치 불필요.

---

## 🎯 주요 기능

| 모드 | 기능 |
|---|---|
| **Data** | 데이터셋 탐색기 + 고밀도 데이터 그리드 + 자동 프로파일링 |
| **Clean** | 결측치/중복/이상치 처리, 컬럼 변환, Undo/Redo 파이프라인 |
| **SQL** | 로컬 SQL 엔진 (SELECT/WHERE/GROUP BY/집계/ORDER/LIMIT) |
| **Chart** | Tableau 스타일 Dimension/Measure 셸프 → ECharts (8종 차트) |
| **Map** | 서울 25구 단계구분도(Choropleth) + 버블맵 |
| **Board** | 드래그/리사이즈 위젯 대시보드 + Cross Filtering |
| **Stats** | 상관분석, T-Test, ANOVA, Chi-Square, 회귀분석 + **Distribution 탭** (히스토그램+박스플롯+왜도/첨도) + **Analysis Builder** (자동 분석 유형 선택) + 자동 해석 패널 |
| **ML** | 브라우저 내 AutoML: OLS 회귀, k-NN 분류, KMeans 군집 + **클래스별 Precision/Recall/F1** + **군집 특성표** + **모델 비교 이력** |
| **Ask Insight** | 데이터셋 자동 프로파일 (IE.profileDataset) + 마지막 분석 결과 요약 + NL→차트/모드 전환 |

---

## 🛠 기술 스택

### 현재 (Phase 1 — 브라우저 전용 프로토타입)
- **React 18.3.1** (UMD, no bundler)
- **Apache ECharts 5.5.1** (차트)
- **Babel Standalone 7.29.0** (in-browser 트랜스파일)
- **IBM Plex Sans / Mono** (타이포그래피)
- **CSS Custom Properties** (디자인 토큰 기반 다크/라이트 테마)

### 목표 (Phase 3 — 프로덕션 스택)
- **Frontend**: Next.js + TypeScript + TailwindCSS + shadcn/ui + Zustand + TanStack Table + dnd-kit
- **Backend**: FastAPI + DuckDB + Polars + Pandas
- **ML**: scikit-learn + statsmodels
- **AI**: OpenAI API / Ollama / LM Studio

---

## 📊 샘플 데이터

서울 아파트 실거래가 데이터 (시뮬레이션):

| 데이터셋 | 행 수 | 설명 |
|---|---|---|
| `Seoul_Apartment_Txns` | 503 | 거래 상세 (구, 건물유형, 면적, 층, 준공연도, 가격) |
| `Monthly_Price_Index` | 42 | 월별 평균 ㎡당 가격 + 거래량 추이 |
| `District_Summary` | 12 | 구별 통계 + 위경도 (지도용) |

---

## 📁 프로젝트 구조

```
.
├── index.html          # 메인 진입점 (스크립트 로드 순서 중요)
├── HANDOFF.md          # 개발 인수인계 문서 (전체 아키텍처 설명)
├── CHANGELOG.md        # 버전별 변경사항 기록
├── WORKLOG.md          # 세션별 작업 로그
├── css/                # 13개 CSS 파일 (토큰 → 기능별 분리)
├── js/                 # 20개 JS/JSX 모듈 (window.* 전역 공유)
└── docs/               # 개발자 매뉴얼 (자기 완결형 HTML)
```

---

## ⚙️ 개발 규칙

1. **`window.*`로 내보내기** — 모든 모듈은 `window.X = ...`로 전역 노출
2. **데이터 접근** — 반드시 `Store.derive.getActiveData(id)` 사용 (직접 접근 금지)
3. **ECharts `animation: false`** — iframe/Preview 환경에서 빈 차트 방지를 위해 유지
4. **CSS 변수만 사용** — `css/tokens.css`의 커스텀 프로퍼티로만 색상 정의
5. **스크립트 로드 순서 유지** — `index.html` 내 `<script>` 순서 = 의존성 순서

---

## 🗺️ 개발 로드맵

### ✅ Phase 1 (완료)
- 전체 UI 프레임워크 (8개 모드)
- 샘플 데이터셋 + Data/Clean/Chart/Dashboard/Stats/ML/Map/SQL 모드
- 다크/라이트 테마, Tweaks 패널, Ask Insight AI 드로어

### ✅ Phase 1.5 — JMP 통계 강화 (완료)
- `js/insightEngine.js` 신규: 규칙 기반 자동 해석 엔진 (`window.IE`)
- Stats 모드 **Distribution 탭**: 히스토그램 + 수평 박스플롯 + 8개 통계 카드 (왜도/첨도 포함)
- Stats 모드 **Analysis Builder 탭**: 컬럼 타입 자동 감지 → 회귀/ANOVA/카이제곱 중 적합한 분석 자동 선택
- 모든 Stats 탭: **Interpretation 패널** (파란색, IE 생성 해석 문구) + **Next Step 패널** (초록색, 다음 분석 제안)
- `statsMath.js` 왜도(skewness) / 첨도(excess kurtosis) 함수 추가
- ML 분류 결과: **클래스별 Precision / Recall / F1** 테이블
- ML 군집 결과: **군집별 특성 평균** 테이블 (원본 스케일)
- ML: **Model Comparison History** 테이블 (최근 10개 실행 비교)
- Ask Insight 드로어: `IE.profileDataset()` 자동 실행 + 마지막 분석 결과 연동

### 🔲 Phase 2 (예정)
- 실제 파일 업로드 (CSV/XLSX 파싱)
- localStorage 영속성
- Chart Recommendation Engine
- Export (PNG/PDF/CSV)

### 🔲 Phase 3 (예정)
- FastAPI + DuckDB 백엔드 연동
- Next.js TypeScript 포팅
- Analysis Pipeline Builder (노드 기반 워크플로우)
- AI Analytics Assistant (실제 LLM 연동)

---

## 📝 세션 간 작업 기록

자세한 작업 이력은 [`WORKLOG.md`](./WORKLOG.md)를 참고하세요.

---

## 📄 라이선스

Private project — HOYUN-Y
