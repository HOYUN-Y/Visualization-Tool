<img src="docs/logo.svg" alt="INSIGHT Analytics" height="48" />

# INSIGHT Analytics Workbench

**Local-First Business Intelligence & Data Analytics Platform**

> Tableau의 시각화 + Power BI의 대시보드 + JMP의 통계 + Orange의 분석 흐름 + ChatGPT의 자연어 인터페이스를  
> 하나의 로컬 웹 애플리케이션으로 통합한 개인용 데이터 분석 플랫폼

![Status](https://img.shields.io/badge/Phase-2%20JMP%20Complete-brightgreen)
![Stack](https://img.shields.io/badge/Stack-React%2018%20%2B%20ECharts%205-blue)
![No Build](https://img.shields.io/badge/Build-None%20(Browser--only)-lightgrey)

---

## 브랜드 아이덴티티

로고는 **`IN`** + **`SIGHT`** + `Analytics` 세 요소로 구성됩니다.

| 구성 | 색상 | 역할 |
|---|---|---|
| `IN` | 기본 텍스트 (흰/다크) | 조용히 시작하는 전치사 |
| `SIGHT` | `#e8611a` 주황 | 브랜드 핵심 — 시각·통찰·발견 |
| `Analytics` | 흐린 회색 (소문자 크기) | 기능 설명, 배경으로 물러남 |

> **컨셉:** "보다(See)"의 핵심 단어 **SIGHT**를 주황으로 강조해 *데이터를 꿰뚫어 보는 시각*이라는 의미를 직관적으로 전달합니다.  
> 주황(`#e8611a`)은 UI 전체의 accent 색이기도 하며, 경고·오류가 아닌 **집중·인사이트·발견**의 색으로 사용됩니다.

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

### ✅ Phase 1.6 — Map 강화 (완료)
- Export (PNG/CSV), CSV/JSON 파일 임포트 (드래그앤드롭)
- Map 모드 — World · GDP choropleth 탭 추가
- Map 모드 — Korea · 행정구역 탭 (시도 choropleth + 시군구 버블맵, WGS84→UTM52N 좌표 변환)
- Map 모드 — 내 데이터 모드 (위경도 컬럼 자동 감지, 임포트 데이터를 지도에 직접 표시)

### 🔲 Phase 2 — 브라우저 단독 구현 가능 (예정)

> 순수 JS로 구현 가능. 백엔드 불필요. 데이터 규모 ~10k 행까지 실용적.

**[최우선] 데이터 전처리 강화 (Clean 모드)**
- Formula Column (JS 수식으로 파생 컬럼 생성)
- Dummy / Label Encoding, Standardization, Normalization
- Log / Box-Cox / Rank / Binning / Winsorizing Transformation

**[최우선] ML 모델 확장**
- Logistic Regression, Decision Tree, Naive Bayes
- Confusion Matrix, ROC/AUC, Precision-Recall, Lift/Gain/KS Chart
- Feature Importance, Cross Validation (소규모)

**[최우선] PCA**
- PCA + Biplot + Scree Plot (순수 JS SVD, <10k 행)

**[중요] 차트 확장 (Chart 모드)**
- Auto Chart Recommendation, Parallel Coordinates (ECharts 내장)
- Mosaic Plot, Pair Plot, Contour Plot, Bubble Matrix

**[중요] 분포 플랫폼 (Stats 모드)**
- QQ Plot, Normal Fit, Multi Variable Distribution, Outlier Visualization

**[중요] 시계열 기초 (Stats 모드)**
- Moving Average, Exponential Smoothing, Seasonal Decomposition, ACF/PACF

**[중요] 품질관리 SPC (신규 탭)**
- Control Charts (X-Bar, R, S, P, C, U), Pareto Chart, Cp/Cpk/Pp/Ppk

**[JMP 차별화] 고급 기능**
- Hierarchical Clustering + Dendrogram (<5k 행)
- DBSCAN (<5k 행)
- Stepwise Regression, ANCOVA, Bootstrap
- DOE 기초 (Full/Fractional Factorial, CCD, Taguchi, Prediction Profiler)

### ⚠️ Phase 2 데이터 규모 제한 항목

> 브라우저에서 구현은 가능하나 **5k 행 초과 시 실용성 저하**. 경고 메시지와 함께 제한적 지원.

| 기능 | 제한 이유 | 실용 상한 |
|---|---|---|
| Random Forest | 다수 트리 = O(n·d·T) CPU | ~5k 행, ~10 트리 |
| DBSCAN | O(n²) naive 구현 | ~5k 행 |
| t-SNE | 반복 최적화 매우 느림 | ~3k 행 |
| Gaussian Mixture Model | EM 수렴 느림 | ~5k 행 |
| Factor Analysis | SVD 반복 계산 | ~10k 행 |
| Neural Network | TF.js CDN (~1.5MB) 필요 | 소규모 아키텍처 |

### ❌ Phase 3 이후 — 브라우저 단독 불가

> 백엔드(Python/WASM) 또는 네이티브 라이브러리가 필요한 항목.

| 기능 | 불가 이유 |
|---|---|
| XGBoost / LightGBM | C++ 네이티브, 순수 JS 구현 없음 |
| SVM | Quadratic Programming solver 필요 |
| UMAP | 신뢰할 CDN 없음, 계산 비용 과대 |
| SOM | 복잡한 구현, CDN 없음 |
| ARIMA / SARIMA | MLE 최적화 수치 불안정, JS 라이브러리 미성숙 |
| Prophet | Facebook Python/Stan 전용 |
| Bayesian Analysis (MCMC) | 샘플링 비용 — 브라우저에서 수분~수십분 |
| DOE Custom Design (D-optimal) | Exchange 알고리즘 = 복잡 수치 최적화 |
| Survival Analysis (Cox) | Partial likelihood 최적화 복잡 |
| Gradient Boosting | 대용량 데이터 시 너무 느림 |

### 🔲 Phase 3 — 프로덕션 스택 전환
- FastAPI + DuckDB 백엔드 → 위 ❌ 항목 모두 구현 가능
- Next.js TypeScript 포팅
- Analysis Pipeline Builder (노드 기반 워크플로우)
- AI Analytics Assistant (실제 LLM 연동)

---

## 📝 세션 간 작업 기록

자세한 작업 이력은 [`WORKLOG.md`](./WORKLOG.md)를 참고하세요.

---

## 📄 라이선스

Private project — HOYUN-Y
