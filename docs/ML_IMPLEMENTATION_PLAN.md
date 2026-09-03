# CareerCompass AI — Comprehensive ML & Cutoff Architecture Implementation Plan

**Project:** CareerCompass AI  
**Date:** August 16, 2026  
**Document:** `docs/ML_IMPLEMENTATION_PLAN.md`  
**Status:** PROPOSED ARCHITECTURE (Pending Review — No code modified yet)

---

## 1. Executive Summary & Current State

CareerCompass AI is an entrance-exam-aware college admission and career guidance platform for Indian higher education. A comprehensive audit of `apps/ai-service`, `apps/api`, and the `files/` dataset directory confirmed:

1. **Current Intelligence Reality:** There are **zero trained machine learning (ML) models** or statistical forecasting models in the current codebase. Features currently labeled as "admission probability" or "predictor" are deterministic, rule-based piecewise linear ratio heuristics and weighted linear averages.
2. **Current Entrance Data Reality:**
   * **COMEDK:** 730 cleaned deduplicated historical rows (`comedk_cutoffs_clean.csv`) spanning 2024 (All Rounds, GM + KKR) and 2025 (Round 4, GM). Closing rank is available; opening rank is 0% available. The two years represent non-comparable counselling scopes.
   * **KCET:** 0% real historical dataset integrated. Relies on 5 mock colleges in `seed.ts` and synthetic category multiplier fallback in `cutoff.service.ts`.
   * **JEE Main & NEET:** 0% historical dataset integrated. Exam codes exist in database schema enums only.
3. **Primary Objective:** Build a production-grade entrance exam intelligence platform driven by **KCET**, **COMEDK**, **JEE Main**, and **NEET**, anchored in:
   * Common entrance data foundation
   * Historical eligibility engine (`eligibility_assessment`)
   * Mathematical SAFE / TARGET / DREAM portfolio classification
   * Multi-criteria college & branch recommendation
   * Constrained choice-filling optimizer
   * Statistical cutoff trend analysis
   * Data-justified ML cutoff forecasting (with `FORECAST_NOT_AVAILABLE` fallback)
   * Scholarship matching and career guidance

---

## 2. Target Architecture Overview

The system architecture preserves the existing monorepo structure without breaking modifications:

```
[ Frontend: apps/web (Next.js) ]
           │
           ▼
[ Core API Backend: apps/api (NestJS) ]
 ├── Historical Eligibility Engine (Cutoff Lookup & Quotas)
 ├── SAFE / TARGET / DREAM Classification Engine
 ├── Hybrid College Recommendation Engine
 ├── Choice-Filling Optimizer (Constrained Knapsack/Ranker)
 └── Scholarship & Financial Planning Modules
           │
           ▼ (HTTP Internal Service Token)
[ AI/ML Microservice: apps/ai-service (FastAPI / PyTorch / Scikit-Learn) ]
 ├── Cutoff Trend Analysis & Statistical Metrics
 ├── Machine Learning Forecasting Service (Ridge / Random Forest / XGBoost)
 └── RAG Conversational QA & Intent Service (pgvector)
```

---

## 3. Phase 1 — Common Entrance Data Foundation

### 3.1 Common Cutoff Data Model Schema

Every historical cutoff across KCET, COMEDK, JEE Main, and NEET will adhere to a unified internal representation:

```typescript
export interface CutoffRecord {
  id?: string;
  exam: 'KCET' | 'COMEDK' | 'JEE' | 'NEET';
  year: number;                           // e.g., 2024, 2025
  round: number | string;                 // 1, 2, 3, "All Rounds", "Extended Round"
  counsellingAuthority: string;          // e.g., "KEA", "COMEDK", "JoSAA", "MCC"
  collegeCode: string;                   // Canonical code, e.g., "E001", "138", "201"
  collegeName: string;                   // Display name
  courseCode: string;                    // Canonical branch code, e.g., "CSE", "ECE", "AI"
  courseName: string;                    // Display branch name
  category: string;                      // Reserved category, e.g., "GM", "2A", "SC", "OBC", "OPEN"
  quota?: string;                        // Reservation quota, e.g., "General", "KKR", "AIQ", "HS", "OS"
  openingRank?: number | null;           // Optional (Null if unavailable)
  closingRank: number;                   // Mandated closing rank
  state: string;                         // College state, e.g., "Karnataka", "All India"
  collegeType: 'Govt' | 'Private' | 'Govt-Aided' | 'Deemed' | 'IIT' | 'NIT';
  source: 'official_pdf' | 'official_api' | 'verified_bulk';
}
```

### 3.2 Field Optionality Matrix Across Exams

| Field | KCET | COMEDK | JEE Main | NEET |
|---|---|---|---|---|
| `exam` | **Required** ("KCET") | **Required** ("COMEDK") | **Required** ("JEE") | **Required** ("NEET") |
| `counsellingAuthority` | **Required** ("KEA") | **Required** ("COMEDK") | **Required** ("JoSAA"/"CSAB") | **Required** ("MCC"/"KEA") |
| `collegeCode` | **Required** (KEA Code) | **Required** (E-Code) | **Required** (AISHE/JoSAA) | **Required** (MCC/College ID) |
| `courseCode` | **Required** | **Required** | **Required** | Optional (default "MBBS"/"BDS") |
| `category` | **Required** (GM, 2A, 2B, 3A, 3B, Cat-1, SC, ST) | **Required** (GM, KKR) | **Required** (OPEN, EWS, OBC-NCL, SC, ST) | **Required** (UR, EWS, OBC, SC, ST) |
| `quota` | **Required** (Gen, Rural, Kannada, HYD-KAR) | Optional ("General", "KKR") | **Required** (HS, OS, AI) | **Required** (AIQ, State Quota) |
| `openingRank` | Optional (KEA publishes both) | **Optional** (0% in source CSV) | Optional (JoSAA publishes OR) | Optional |
| `closingRank` | **Required** | **Required** | **Required** | **Required** |

### 3.3 Exam-Specific Ingestion Adapters

1. **COMEDK Adapter (`comedk.adapter.ts`):** Ingests `files/comedk_cutoffs_clean.csv`. Maps `college_code` -> `collegeCode`, `course_normalized` -> `courseCode`, `seat_category` -> `category`, `closing_rank` -> `closingRank`. Sets `openingRank = null`.
2. **KCET Adapter (`kcet.adapter.ts`):** Parses official KEA PDF/CSV extracts. Maps KEA college codes, discipline/course branches, 8 vertical categories (GM, SC, ST, Cat-1, 2A, 2B, 3A, 3B) and 3 horizontal quotas (General, Rural, Kannada Medium).
3. **JEE Main Adapter (`josaa.adapter.ts`):** Ingests JoSAA multi-round cutoff datasets. Maps Institute Code, Academic Program Name, Seat Type (OPEN, EWS, OBC-NCL, SC, ST), Gender/Quota (HS, OS, AI).
4. **NEET Adapter (`neet.adapter.ts`):** Ingests MCC & KEA medical seat allotment cutoffs for MBBS/BDS programs.

---

## 4. Phase 2 — Historical Eligibility Engine

### 4.1 Scientifically Accurate Terminology

We explicitly **rename** all endpoints, interfaces, and methods from `admission_probability` to `historical_eligibility` and `eligibility_assessment`.

* **Old Misleading Signature:** `predictProbability(studentRank, closingRank): { probability_percent: 85, band: "Safe" }`
* **New Grounded Signature:** `evaluateHistoricalEligibility(query): HistoricalEligibilityResult`

### 4.2 Engine Input & Output Specification

```typescript
export interface HistoricalEligibilityQuery {
  exam: 'KCET' | 'COMEDK' | 'JEE' | 'NEET';
  rank: number;
  category: string;
  quota?: string;
  courseCode?: string;
  collegeCode?: string;
  year?: number;                           // Optional filter (defaults to latest available)
  round?: number | string;                 // Optional filter
}

export type HistoricalEligibilityStatus = 
  | 'HISTORICALLY_ELIGIBLE' 
  | 'HISTORICALLY_NOT_ELIGIBLE' 
  | 'INSUFFICIENT_DATA';

export interface HistoricalEligibilityResult {
  exam: string;
  studentRank: number;
  category: string;
  quota: string;
  collegeCode: string;
  collegeName: string;
  courseCode: string;
  courseName: string;
  historicalClosingRank: number | null;
  historicalOpeningRank: number | null;
  year: number | null;
  round: number | string | null;
  status: HistoricalEligibilityStatus;
  rankMargin: number | null;               // (historicalClosingRank - studentRank)
  dataAvailability: {
    totalHistoricalYears: number;
    yearsAvailable: number[];
    isExactCategoryMatch: boolean;
    isExactQuotaMatch: boolean;
  };
}
```

---

## 5. Phase 3 — SAFE / TARGET / DREAM Classification Engine

### 5.1 Mathematical Classification Formula

The classification evaluates the relative distance between the student's rank ($R_{student}$) and the historical/forecast closing rank ($C_{ref}$).

Let the **Rank Ratio** $r$ be defined as:
$$r = \frac{R_{student}}{C_{ref}}$$

Where:
* $R_{student}$ is the student's verified exam rank (lower is better).
* $C_{ref}$ is the reference cutoff rank (historical or statistical baseline).

### 5.2 Configurable Threshold Definitions

Rather than hardcoding magic numbers, thresholds are defined as configurable environment parameters:

| Classification | Mathematical Condition | Conceptual Meaning | Default Ratio Boundary |
|---|---|---|---|
| **SAFE** | $r \le T_{safe}$ | Student rank is significantly better than the cutoff rank. | $r \le 0.80$ (Rank is at least 20% better) |
| **TARGET** | $T_{safe} < r \le T_{target}$ | Student rank is close to the cutoff rank. High competition zone. | $0.80 < r \le 1.05$ (Within 5% above cutoff) |
| **DREAM** | $T_{target} < r \le T_{dream}$ | Student rank is worse than the cutoff rank, but within reach. | $1.05 < r \le 1.30$ (Within 30% stretch limit) |
| **UNLIKELY** | $r > T_{dream}$ | Student rank exceeds realistic reach bounds. | $r > 1.30$ |
| **INSUFFICIENT_DATA** | $C_{ref} \text{ missing or } N_{obs} = 0$ | No trustworthy historical cutoff exists for category/quota. | N/A |

### 5.3 Edge Cases & Boundary Handling

1. **$C_{ref} \le 0$ or Missing:** Returns `INSUFFICIENT_DATA` immediately.
2. **Top-Rank Compressibility ($R_{student} \le 100$):** Fixed percentage ratios break at ultra-high ranks. If $C_{ref} \le 500$, absolute rank margin checks apply:
   * Safe: $C_{ref} - R_{student} \ge 100$
   * Target: $-50 \le C_{ref} - R_{student} < 100$
   * Dream: $-150 \le C_{ref} - R_{student} < -50$
3. **Category Mismatch Fallback:** If requested category $Cat_i$ has no historical row, the engine NEVER silently uses General (`GM`) cutoffs without explicit warning; it returns status `INSUFFICIENT_DATA` with a flag `exact_category_missing = true`.

---

## 6. Phase 4 — Hybrid College & Branch Recommendation Engine

### 6.1 Multi-Criteria Recommendation Architecture

The recommendation engine ranks eligible colleges/courses for a student profile using a composite multi-criteria utility score $S(c, p)$, where $c$ represents a college-course pair and $p$ represents the student profile.

### 6.2 Mathematical Scoring Architecture

$$S(c, p) = w_e \cdot S_{eligibility}(c, p) + w_b \cdot S_{branch}(c, p) + w_l \cdot S_{location}(c, p) + w_f \cdot S_{financial}(c, p) + w_q \cdot S_{quality}(c, p)$$

Where weights sum to 1.0 ($\sum w_i = 1.0$) with default values:
* $w_e = 0.35$ (Cutoff Eligibility & Portfolio Balance)
* $w_b = 0.25$ (Branch / Course Preference Alignment)
* $w_l = 0.15$ (Location & City Preference Alignment)
* $w_f = 0.15$ (Fees, Budget & ROI Score)
* $w_q = 0.10$ (Institutional Quality: NIRF Rank, Placement LPA)

#### Sub-Score Formulations:
1. **Eligibility Score ($S_{eligibility}$):** Peak score awarded to Target & Safe choices ($r \in [0.6, 1.05] \implies 1.0$), decaying smoothly for distant Dream choices or extreme Safe choices.
2. **Branch Match Score ($S_{branch}$):** Exact match to top priority branch = 1.0; related branch in same discipline = 0.7; unrelated discipline = 0.1.
3. **Location Score ($S_{location}$):** Preferred home state/district = 1.0; tier-1 education hub = 0.8; other = 0.5.
4. **Financial/ROI Score ($S_{financial}$):** Derived from $\text{Placement Average LPA} / (\text{Annual Fee} / 100,000)$.
5. **Quality Score ($S_{quality}$):** Scaled inverse of NIRF rank: $S_{quality} = \max(0, 1 - \frac{\text{NIRF}}{200})$.

### 6.3 Explainable Recommendation Reasons

Every item returned by the recommendation engine includes deterministic data-backed reason codes:
* `HISTORICAL_FIT`: "Your KCET rank of 5,200 is 14% better than the 2024 closing rank of 6,050 for CSE at BMSCE."
* `STRONG_ROI`: "Median placement package of ₹8.5 LPA against annual fee of ₹1.95 Lakhs."
* `TOP_BRANCH_MATCH`: "Matches your 1st preferred branch choice (Computer Science Engineering)."

---

## 7. Phase 5 — Constrained Choice-Filling Optimizer

### 7.1 Objective & Mathematical Formulation

The choice-filling optimizer formats a candidate seat preference list for official counselling portals (KEA / COMEDK / JoSAA). It solves a **Constrained Choice Optimization Problem**:

$$\max_{\vec{x}} \sum_{i=1}^{K} \left( P(c_i) \cdot W_{pref}(c_i) \cdot \lambda^{\text{priority}(i)} \right)$$

Subject to constraints:
1. **Portfolio Distribution Constraint:** The ordered list must maintain a balanced risk portfolio:
   * **Dream Choices (Top):** 20% – 30% of list
   * **Target Choices (Middle):** 40% – 50% of list
   * **Safe Choices (Bottom Anchor):** 20% – 30% of list
2. **Hard Budget Constraint:** $\text{AnnualFee}(c_i) \le \text{UserMaxBudget}$.
3. **Strict Category/Quota Adherence:** Only options where category/quota eligibility is verified are included.
4. **Monotonic Risk Order:** Options are arranged strictly in descending order of desirability and cutoff strictness (stricter cutoffs listed higher to prevent getting locked out of a better college).

---

## 8. Phase 6 — Non-ML Cutoff Trend Analysis

### 8.1 Non-ML Trend Metrics

For any college-course-category tuple with $\ge 2$ historical observations, the system calculates statistical trend indicators:

```typescript
export interface CutoffTrendAnalysis {
  latestClosingRank: number;
  previousClosingRank: number | null;
  medianClosingRank: number;
  minClosingRank: number;
  maxClosingRank: number;
  yoyMovementRank: number | null;          // (latestClosingRank - previousClosingRank)
  yoyMovementPercent: number | null;       // ((latest - previous) / previous) * 100
  volatilityStdDev: number | null;
  trendDirection: 'STRENGTHENING' | 'RELAXING' | 'STABLE' | 'INSUFFICIENT_DATA';
}
```

* **STRENGTHENING:** Cutoff rank is numerically decreasing over time (college becoming more competitive / harder to get in).
* **RELAXING:** Cutoff rank is numerically increasing over time (easier to get in).
* **STABLE:** YoY variation is within $\pm 3\%$.

### 8.2 Insufficient Data Rules

If historical observation count $N_{obs} < 2$ (e.g. current COMEDK dataset across non-comparable rounds), `trendDirection` evaluates strictly to `INSUFFICIENT_DATA`, preventing misleading trend charts.

---

## 9. Phase 7 — Data-Justified ML Cutoff Forecasting

### 9.1 Data Feasibility & Minimum Threshold Criteria

ML models predicting `future_closing_rank` will **ONLY** be trained and executed if datasets satisfy strict empirical feasibility criteria:

```
ML_TRAINING_FEASIBILITY_CRITERIA:
1. Minimum Comparable Years (N_years) >= 4 continuous years.
2. Consistent Round Scope (Round 1 vs Round 1 across all years).
3. Minimum Combination Sample Size >= 500 distinct (college, course, category) series.
4. Missingness Rate <= 15%.
```

### 9.2 Audit Evaluation Against Current Datasets

| Exam | Current Comparable Years | Round Consistency | Minimum Sample Met? | ML Training Feasible? |
|---|---|---|---|---|
| **COMEDK** | **2 years** (2024, 2025) | **NO** (All Rounds vs R4) | NO | **NO -> Return `FORECAST_NOT_AVAILABLE`** |
| **KCET** | **0 years** (Mock only) | NO | NO | **NO -> Return `FORECAST_NOT_AVAILABLE`** |
| **JEE Main** | **0 years** | NO | NO | **NO -> Return `FORECAST_NOT_AVAILABLE`** |
| **NEET** | **0 years** | NO | NO | **NO -> Return `FORECAST_NOT_AVAILABLE`** |

### 9.3 Machine Learning Pipeline Design (When Data Criteria are Met)

When 4+ years of consistent data are ingested:
* **Feature Engineering:** `lag_closing_rank_t1`, `lag_closing_rank_t2`, `category_encoding`, `college_tier`, `total_intake_seats`, `state_board_pass_pct`.
* **Models Evaluated:**
  1. Ridge Regression (Baseline regularized linear model)
  2. Random Forest Regressor (Non-linear interactions)
  3. XGBoost Regressor (Gradient boosted trees)
* **Time-Aware Validation:** Split by Year (e.g., Train on Years 2021–2024, Validate on Year 2025). **Never use random k-fold cross-validation on time-series cutoff data!**

---

## 10. Phase 8 — Feasibility of True Admission Probability

### 10.1 Ground Truth Data Requirements

A true, statistically sound **Admission Probability Model** ($P(\text{Admitted} = 1 \mid \text{Rank}, \text{Category}, \text{Preferences})$) requires individual student applicant-level outcome data containing:
1. Student Rank
2. Category & Quota
3. Complete Choice Option List Submitted
4. Final Seat Allotment Result (Admitted / Not Admitted)

### 10.2 Feasibility Conclusion

Because **NO student allotment outcome dataset exists** in the repository (and public counselling authorities do not release student-level application logs), **it is scientifically impossible to train a valid classification model for admission probability.**

### 10.3 Mandated Action
1. **DO NOT** manufacture synthetic student application logs or fake outcome labels.
2. **DO NOT** claim a rank-to-cutoff ratio curve is a statistical ML probability.
3. Replace all user-facing labels with **`historical_eligibility`** and **`rank_cutoff_position`**.

---

## 11. Phase 9 — Exam-by-Exam Readiness Matrix

| Entrance Exam | Current Historical Data | Missing Required Data | Ready for Eligibility Engine | Ready for ML Forecasting |
|---|---|---|---|---|
| **COMEDK** | 730 cleaned rows (2024 All Rounds, 2025 R4, GM/KKR) | 2021–2023 historical PDFs, Round 1/2 consistency, Opening Ranks | **YES** (2024/2025 GM closing ranks) | **NO** (`FORECAST_NOT_AVAILABLE`) |
| **KCET** | 0% real CSV (5 mock colleges in seed script) | Real KEA 2021–2025 allotment data CSVs/PDFs across 8 categories & 3 quotas | **NO** (Requires real KEA dataset ingestion) | **NO** (`FORECAST_NOT_AVAILABLE`) |
| **JEE Main** | 0% cutoff records (Enum code in schema only) | JoSAA/CSAB 2021–2025 opening/closing ranks across OPEN/OBC/SC/ST & HS/OS | **NO** (Requires JoSAA dataset ingestion) | **NO** (`FORECAST_NOT_AVAILABLE`) |
| **NEET** | 0% cutoff records (Enum code in schema only) | MCC & KEA Medical 2021–2025 MBBS/BDS cutoff ranks | **NO** (Requires NEET dataset ingestion) | **NO** (`FORECAST_NOT_AVAILABLE`) |

---

## 12. Phase 10 — Detailed Code Modification Blueprint

The plan specifies exact modifications across existing repository files:

### 12.1 `apps/api/src/modules/cutoffs/models/cutoff.model.ts`
* **Current Behavior:** Contains basic `collegeId`, `courseId`, `examCode`, `year`, `round`, `category`, `openingRank`, `closingRank`.
* **Desired Behavior:** Extend schema to implement the Common Cutoff Data Model (`collegeCode`, `courseCode`, `counsellingAuthority`, `quota`, `state`, `collegeType`, `source`). Add compound indexes on `{ examCode: 1, year: 1, collegeCode: 1, courseCode: 1, category: 1, quota: 1 }`.
* **API/DB Impact:** Database migration script required to backfill indexes. Fully backwards compatible.

### 12.2 `apps/api/src/modules/cutoffs/cutoff.service.ts`
* **Current Behavior:** Generates synthetic multiplier cutoffs (`SEED_CATEGORY_MULTIPLIER`) when DB is empty.
* **Desired Behavior:** Replace synthetic multiplier generator with official CSV ingestors (`comedk_cutoffs_clean.csv`). Add `getHistoricalEligibility()` query method.
* **API/DB Impact:** Seed process loads verified historical CSVs.

### 12.3 `apps/api/src/modules/predictions/services/prediction.service.ts`
* **Current Behavior:** Exposes `getPrediction` returning `probabilityPercent` and 4 probability bands via heuristic ratio formulas.
* **Desired Behavior:** Refactor method to `evaluateEligibility()`. Return `HistoricalEligibilityResult` containing historical cutoff, rank margin, and SAFE/TARGET/DREAM status. Remove misleading probability percent claims.
* **API Impact:** Update response interfaces.

### 12.4 `apps/api/src/modules/predictions/services/prediction-engine.service.ts`
* **Current Behavior:** `predictColleges()` computes multi-college ranked list with 5-band probability scores.
* **Desired Behavior:** Refactor to multi-college eligibility and recommendation engine. Compute composite score $S(c, p)$, return SAFE/TARGET/DREAM portfolio tags, NIRF/ROI indicators, and data-backed explanation strings.

### 12.5 `apps/api/src/modules/predictions/utils/prediction-math.util.ts`
* **Current Behavior:** `probabilityPercentFromRatio()`, `bandFromPercent()`.
* **Desired Behavior:** Extract mathematical SAFE/TARGET/DREAM classification logic (`classifyRankPortfolio()`), top-rank absolute rank bounds, and statistical trend metrics.

### 12.6 `apps/ai-service/ml/predictor.py`
* **Current Behavior:** `AdmissionPredictor` class with hardcoded piecewise ratio curve returning `probability_percent`.
* **Desired Behavior:** Deprecate or repurpose into a deterministic rank-ratio index utility. Document clearly that it is a heuristic ratio metric, not a trained ML estimator.

### 12.7 `apps/api/src/database/seed.ts`
* **Current Behavior:** Hardcodes 5 sample KCET/COMEDK cutoffs manually.
* **Desired Behavior:** Read `files/comedk_cutoffs_clean.csv` and `files/india_colleges_clean.csv` during initial boot to seed real historical cutoffs and college metadata.

---

## 13. Phase 11 — ML Service Architecture in `apps/ai-service`

Future ML model development will follow a clean directory hierarchy within `apps/ai-service`:

```
apps/ai-service/
├── ml/
│   ├── datasets/               # Ingested & cleaned training Parquet/CSV files
│   ├── preprocessing/          # Scalers, category encoders, feature pipelines
│   ├── training/               # Training scripts (train_cutoff_forecaster.py)
│   ├── models/                 # Serialized model artifacts (.joblib / .onnx)
│   ├── prediction/             # Inference service handlers
│   └── evaluation/             # Time-series backtesting scripts & metrics
```

### Reproducibility & Governance Rules:
1. **Artifact Metadata:** Every serialized model in `ml/models/` must be paired with a `metadata.json` specifying training date, git commit hash, dataset version, features used, and validation MAE/RMSE metrics.
2. **Preprocessing Persistence:** Category encoders and numerical scalers must be saved alongside model binaries to prevent training-serving skew.
3. **Inference Fallback:** If `ml/models/` contains no valid model for an exam, the FastAPI endpoint must gracefully return `{"status": "FORECAST_NOT_AVAILABLE"}`.

---

## 14. Phase 12 — Comprehensive Testing Strategy

### 14.1 Unit & Integration Test Plan

| Target Module | Test Coverage | Key Scenarios Tested |
|---|---|---|
| **Common Data Model** | `apps/api/test/cutoff-model.spec.ts` | Schema validation, compound index performance, missing optional fields |
| **Historical Eligibility** | `apps/api/test/eligibility-engine.spec.ts` | `HISTORICALLY_ELIGIBLE` when rank <= cutoff; `HISTORICALLY_NOT_ELIGIBLE` when rank > cutoff; exact category matching |
| **SAFE / TARGET / DREAM** | `apps/api/test/portfolio-classifier.spec.ts` | Ratio boundaries ($r=0.75 \to$ SAFE, $r=0.95 \to$ TARGET, $r=1.15 \to$ DREAM); top-rank absolute rank fallback ($R \le 500$) |
| **Missing Data & Fallbacks** | `apps/api/test/missing-data.spec.ts` | Invalid exam code, unknown course, unrepresented category $\to$ returns `INSUFFICIENT_DATA` without crashing |
| **Choice Optimizer** | `apps/api/test/choice-optimizer.spec.ts` | Preference ranking, portfolio distribution constraints (Safe/Target/Dream mix), budget enforcement |
| **ML Inference Endpoint** | `apps/ai-service/tests/test_forecaster.py` | Graceful `FORECAST_NOT_AVAILABLE` return when minimum threshold criteria are unfulfilled |

---

## 15. Phase 13 — Model Evaluation Framework

For future statistical forecasting and recommendation engines, evaluation will utilize standardized metrics:

### 15.1 Cutoff Regression Metrics (Future ML Forecasting)
* **Mean Absolute Error (MAE):** Average error in rank units ($\text{MAE} = \frac{1}{n} \sum |y_i - \hat{y}_i|$).
* **Root Mean Squared Error (RMSE):** Penalizes large rank prediction errors.
* **Coefficient of Determination ($R^2$):** Measures variance explained by the trend model.

### 15.2 Recommendation Ranking Metrics
* **Precision@K (P@K):** Proportion of top-$K$ recommended colleges that are historically eligible.
* **Recall@K (R@K):** Proportion of all eligible target colleges captured in top-$K$.
* **Normalized Discounted Cumulative Gain (NDCG@K):** Evaluates whether the best-fitting colleges appear at the top of the preference list.

---

## 16. Phase 14 — Explainability & Transparency Standard

Every recommendation and eligibility assessment **MUST** present human-readable explainability strings directly in the API response:

```json
{
  "collegeName": "BMS College of Engineering",
  "courseName": "Computer Science Engineering",
  "classification": "TARGET",
  "explanation": {
    "summary": "Your KCET rank of 5,200 is close to the 2024 closing rank of 6,200 (GM category).",
    "historicalCutoff2024": 6200,
    "studentRank": 5200,
    "rankMargin": 1000,
    "confidence": "HIGH_HISTORICAL_DATA"
  }
}
```

---

## 17. Phase 15 — Data Quality & Safety Rules

1. **No Fake Probabilities:** Never present a rule-based ratio curve as a "92% Admission Probability". Present it as "Historically Eligible (Rank is 15% better than 2024 Cutoff)".
2. **Explicit Data Provenance:** Every response displays the exact data source, year, round, and category used (`source: "comedk_cutoffs_clean.csv", year: 2024, round: "All Rounds"`).
3. **Graceful Degraded States:** When historical data for a specific category is missing, explicitly inform the user rather than defaulting to General category without consent.

---

## 18. Prioritized Implementation Sequence

### P0 — Must Do First (Foundation & Correctness)
1. **Common Cutoff Data Model:** Update `cutoff.model.ts` with common data schema and indexes.
2. **Real Dataset Ingestion:** Ingest `comedk_cutoffs_clean.csv` and `india_colleges_clean.csv` in `seed.ts` and `cutoff.service.ts`.
3. **Historical Eligibility Engine:** Replace "probability" naming with `HistoricalEligibilityResult` across `prediction.service.ts`.
4. **SAFE / TARGET / DREAM Classifier:** Implement configurable ratio & top-rank classification math in `prediction-math.util.ts`.
5. **Unit Tests:** Add automated test suite for eligibility lookup and SAFE/TARGET/DREAM classification.

### P1 — Do After P0 (Recommendation & Choice Optimization)
1. **Multi-Criteria College Recommender:** Refactor `PredictionEngineService` to compute composite multi-criteria scores with explainability strings.
2. **Constrained Choice Optimizer:** Update choice-filling optimizer to enforce portfolio balance and preference ordering.
3. **Non-ML Trend Metrics:** Add YoY movement and volatility indicators for multi-year cutoffs.
4. **Real KCET Ingestion:** Process and ingest official KEA historical cutoff datasets as they become available.

### P2 — Future Enhancements (ML & Multi-Exam Expansion)
1. **JoSAA (JEE Main) & MCC (NEET) Dataset Ingestion:** Ingest official JoSAA and NEET medical seat cutoff archives.
2. **Data-Justified ML Forecasting:** Train Ridge / XGBoost forecast models **ONLY** when 4+ continuous, consistent years of historical cutoff data are collected.
3. **Inference Pipeline:** Wire `apps/ai-service/ml/` FastAPI endpoints for automated time-series forecasting when datasets meet feasibility criteria.

---

*End of Implementation Plan.*
