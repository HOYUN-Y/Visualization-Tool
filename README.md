<img src="docs/brand-assets/logos/analytics/logo.svg" alt="insight Analytics" height="48" />

# insight Analytics Workbench

> 현재 구현 계획: [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md) · 현재 작업 상태: [`WORKLOG.md`](./WORKLOG.md#current-state)

**Local-First Business Intelligence & Data Analytics Platform**

> Tableau의 시각화 + Power BI의 대시보드 + JMP의 통계 + Orange의 분석 흐름 + ChatGPT의 자연어 인터페이스를  
> 하나의 로컬 웹 애플리케이션으로 통합한 개인용 데이터 분석 플랫폼

![Status](https://img.shields.io/badge/v1.9.0-Direct%20Editing%20Complete-brightgreen)
![Stack](https://img.shields.io/badge/Stack-React%2018%20%2B%20ECharts%205-blue)
![No Build](https://img.shields.io/badge/Build-None%20(Browser--only)-lightgrey)

---

## 브랜드 아이덴티티

> 상세 브랜드 스펙: [`docs/insight Analytics Brand Spec (standalone) ver2.html`](<docs/insight Analytics Brand Spec (standalone) ver2.html>)

### 워드마크

로고는 **`in`** + **`sight`** + ` Analytics` 세 요소로 구성됩니다.

| 구성 | 색상 | 역할 |
|---|---|---|
| `in` | `tx-hi` (흰/다크, `#E9EAEC`) | 조용히 시작하는 전치사 — 소문자로 겸손하게 |
| `sight` | **Heritage Orange** `#E8611A` | 브랜드 핵심 — 시각·통찰·발견 |
| ` Analytics` | `tx-faint` `#6E6E86` · `0.62em` | 기능 설명 — 배경으로 물러남 |

**워드마크 HTML (표준 표기):**
```html
<span style="color:#E9EAEC">in</span><span style="color:#E8611A">sight</span><span style="color:#6E6E86;font-size:.62em"> Analytics</span>
```

**컴팩트 (좁은 공간):** `insight` — Analytics 생략  
**단색/워터마크:** `insight Analytics` — 단일 색상

### 브랜드 컬러

| 이름 | 값 | 용도 |
|---|---|---|
| **Heritage Orange** | `#E8611A` / `oklch(0.70 0.17 47)` | 기본 accent · `sight` · 집중/발견 |
| Orange Hi | `oklch(0.80 0.14 55)` | hover · 강조 텍스트 |
| Orange Soft | `oklch(0.72 0.17 48 / .16)` | 선택 배경 · 뱃지 · 액티브 칩 |

### 타이포그래피

| 역할 | 폰트 | 굵기 |
|---|---|---|
| UI 전반 · 워드마크 · 본문 | IBM Plex Sans / IBM Plex Sans KR | 400 / 500 / 600 / 700 |
| 수치 · 코드 · 토큰 · 필드 키 | IBM Plex Mono | tabular-nums |

### 제품군

| 제품 | 색상 | 역할 |
|---|---|---|
| **insight Analytics** Workbench | 🟠 주황 (sight) | 분석 · 시각화 |
| insight **Data** hub | 🔵 블루 `#3F74E8` | 데이터 수집 · 공급 |

> **컨셉:** "보다(See)"의 핵심 단어 **sight**를 주황으로 강조해 *데이터를 꿰뚫어 보는 시각*이라는 의미를 직관적으로 전달합니다. 소문자 워드마크는 부드럽고 현대적인 인상을 주며, `sight`의 주황만이 시선을 사로잡습니다.

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
| **Data** | 데이터셋 탐색기 + 고밀도 데이터 그리드 + 자동 프로파일링 + **직접 편집** (JMP/Excel 스타일 — 셀 편집 · 행/열 추가·삭제 · 피처명 변경 · 타입 변경 · 헤더 드래그 열 순서 변경, 모두 비파괴 Undo/Redo) |
| **Clean** | 결측치/중복/이상치 처리 · 컬럼 변환 · **Encoding** (Label/Dummy) · **수치 변환** (Z-Score/Min-Max/Log/Rank/Winsorize/Binning) · **Formula Column** (JS 수식 파생 컬럼) · Undo/Redo 파이프라인 (Data 모드 편집 이력도 여기에 통합 표시) |
| **SQL** | 로컬 SQL 엔진 (SELECT/WHERE/GROUP BY/집계/ORDER/LIMIT) |
| **Chart** | Tableau 스타일 Dimension/Measure 셸프 → ECharts (Basic 8 + Advanced 8 + Financial 3 + Special 1, 총 20종) |
| **Map** | 3개 탭 — **Seoul · 구** (서울 25구 Choropleth + 버블맵) · **Korea · 행정구역** (17 시도 choropleth + 84 시군구 버블맵 + 내 데이터 모드) · **World · GDP** (30개국 choropleth) |
| **Board** | 드래그/리사이즈 위젯 대시보드 + Cross Filtering |
| **Stats** | 상관분석, T-Test, ANOVA, Chi-Square, 회귀분석 + **Distribution 탭** (히스토그램+박스플롯+왜도/첨도) + **Analysis Builder** (자동 분석 유형 선택) + 자동 해석 패널 |
| **ML** | 브라우저 내 AutoML: OLS 회귀, k-NN 분류, KMeans 군집 + **클래스별 Precision/Recall/F1** + **군집 특성표** + **모델 비교 이력** |
| **Ask Insight** | 데이터셋 자동 프로파일 (IE.profileDataset) + 마지막 분석 결과 요약 + NL→차트/모드 전환 |

---

## 🛠 기술 스택

### 현재 (v1.9.0 — 브라우저 전용 프로토타입)
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

서울 부동산·금융·지도 데모 데이터 (시뮬레이션/정적 참조 데이터):

| 데이터셋 | 행 수 | 설명 |
|---|---|---|
| `Seoul_Apartment_Txns` | 503 | 거래 상세 (구, 건물유형, 면적, 층, 준공연도, 가격) |
| `Monthly_Price_Index` | 42 | 월별 평균 ㎡당 가격 + 거래량 추이 |
| `KOSPI_Stock_2024` | 320 | OHLCV 금융 차트용 데이터 |
| `District_Summary` | 12 | 서울 구별 통계 + 위경도 |
| `World_GDP_2023` | 30 | 세계 GDP·인구·성장률 지도 데이터 |
| `Korea_Provinces_2023` | 17 | 시도별 인구·면적·GRDP |
| `Korea_시군구_2023` | 84 | 시군구별 인구·면적·위경도 |

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
- Export (PNG/CSV), CSV/TSV/JSON 파일 임포트 (드래그앤드롭)
- Map 모드 — World · GDP choropleth 탭 추가
- Map 모드 — Korea · 행정구역 탭 (시도 choropleth + 시군구 버블맵, WGS84→UTM52N 좌표 변환)
- Map 모드 — 내 데이터 모드 (위경도 컬럼 자동 감지, 임포트 데이터를 지도에 직접 표시)

### ✅ Phase 2 (1차) — Clean 모드 전처리 강화 (완료)
- **Encoding**: Label Encode (문자→정수), Dummy Encode (One-Hot 0/1 컬럼)
- **수치 변환**: Z-Score 표준화, Min-Max 정규화, Log(1+x), 순위(Rank)
- **Outlier 처리**: Winsorize (상하 p% 클리핑), Binning (등폭 구간 범주화)
- **Formula Column**: JS 수식으로 파생 컬럼 생성 (`row` 객체 + `Math.*` 접근)
- 모든 op 파이프라인 Undo/Redo 지원

### ✅ Phase 2 (1.5차) — 데이터 직접 편집 (완료, v1.9.0)
- **셀 편집**: 더블클릭 인라인 편집, 열 타입 자동 형변환
- **행 편집**: 행 추가 / 다중선택 삭제(Del 키)
- **열 편집**: 열 추가 · 삭제 · 피처명 변경 · 타입 변경 · **헤더 드래그 순서 변경**
- 숨김 행 ID(`__rid`)로 정렬·필터·페이징과 무관하게 안정적 행 지목
- 모든 편집을 비파괴 스텝으로 기록 → Undo/Redo + Clean 모드 PIPELINE 통합 표시

### 🔲 Phase 2 (2차) — 브라우저 단독 구현 가능 (예정)

> 순수 JS로 구현 가능. 백엔드 불필요. 데이터 규모 ~10k 행까지 실용적.

**[최우선] ML 모델 확장 및 고급 전처리**
- Box-Cox Transformation (lambda 최적화)
- ~~Formula Column~~ ✅ ~~Dummy / Label Encoding~~ ✅ ~~Standardization / Normalization~~ ✅ ~~Log / Rank / Binning / Winsorizing~~ ✅

**[최우선] ML 모델 확장**
- Logistic Regression, Decision Tree, Naive Bayes
- ~~Confusion Matrix~~ ✅ · ROC/AUC, Precision-Recall Curve, Lift/Gain/KS Chart
- ~~OLS 표준화 계수 기반 Feature Importance~~ ✅ · 트리/분류 모델 Feature Importance, Cross Validation (소규모)

**[최우선] PCA**
- PCA + Biplot + Scree Plot (순수 JS SVD, <10k 행)

**[중요] 차트 확장 (Chart 모드)**
- Auto Chart Recommendation, Parallel Coordinates (ECharts 내장)
- Mosaic Plot, Pair Plot, Contour Plot, Bubble Matrix

**[중요] 분포 플랫폼 (Stats 모드)**
- QQ Plot, Normal Fit, Multi Variable Distribution
- ~~IQR 이상치 탐지 + 박스플롯 표시~~ ✅ · 다변량 이상치 시각화는 예정

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
