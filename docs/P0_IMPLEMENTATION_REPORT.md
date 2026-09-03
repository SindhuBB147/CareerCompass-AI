# P0 Implementation Report — Grounded Historical Cutoff Engine

**Project:** CareerCompass AI  
**Date:** August 16, 2026  
**Document:** `docs/P0_IMPLEMENTATION_REPORT.md`  
**Status:** P0 COMPLETE

---

## Statement of Scientific & Technical Grounding

> **"Current COMEDK implementation is historical cutoff intelligence, not trained admission-probability ML."**

All claims of "trained machine learning probabilities" or artificial percentage estimates have been removed from the core intelligence service. The engine now operates strictly on **ground-truth historical cutoff data** and deterministic, mathematically explainable portfolio rules.

---

## 1. Files Changed

1. [cutoff.model.ts](file:///c:/Users/sindh/Downloads/career-compass-ai/career-compass-ai/apps/api/src/modules/cutoffs/models/cutoff.model.ts) — Extended Cutoff MongoDB schema with common cutoff properties (`counsellingAuthority`, `collegeCode`, `collegeName`, `courseCode`, `courseName`, `quota`, `state`, `collegeType`), mixed round type support (`number | string`), and compound index for fast lookups.
2. [cutoff.service.ts](file:///c:/Users/sindh/Downloads/career-compass-ai/career-compass-ai/apps/api/src/modules/cutoffs/cutoff.service.ts) — Removed synthetic multiplier generator (`SEED_CATEGORY_MULTIPLIER`); implemented reproducible ingestion of `comedk_cutoffs_clean.csv`; updated trend queries to support both `collegeId` and `collegeCode` lookup.
3. [seed.ts](file:///c:/Users/sindh/Downloads/career-compass-ai/career-compass-ai/apps/api/src/database/seed.ts) — Ingests `files/comedk_cutoffs_clean.csv` into MongoDB `cutoffs` collection upon database initialization.
4. [prediction-math.util.ts](file:///c:/Users/sindh/Downloads/career-compass-ai/career-compass-ai/apps/api/src/modules/predictions/utils/prediction-math.util.ts) — Implemented configurable `classifyPortfolio` rules for SAFE / TARGET / DREAM classification, top-rank absolute margin handling, and `recommendationScoreFromRatio`.
5. [prediction.service.ts](file:///c:/Users/sindh/Downloads/career-compass-ai/career-compass-ai/apps/api/src/modules/predictions/services/prediction.service.ts) — Added `getHistoricalEligibility()`, returning statuses `HISTORICALLY_ELIGIBLE`, `HISTORICALLY_NOT_ELIGIBLE`, and `INSUFFICIENT_DATA`. Updated single-college prediction and choice-filling optimizer to consume recommendation scores and portfolio classifications.
6. [prediction-engine.service.ts](file:///c:/Users/sindh/Downloads/career-compass-ai/career-compass-ai/apps/api/src/modules/predictions/services/prediction-engine.service.ts) — Added `portfolioClassification` and data-backed `reasons` strings to `RankedCollegeResult`.
7. [predictor.py](file:///c:/Users/sindh/Downloads/career-compass-ai/career-compass-ai/apps/ai-service/ml/predictor.py) — Updated Python microservice docstrings and outputs to return `recommendation_score` and `portfolio_classification` (`SAFE`, `TARGET`, `DREAM`, `OUTSIDE_HISTORICAL_RANGE`, `INSUFFICIENT_DATA`), removing misleading ML probability claims.
8. [prediction-math.util.spec.ts](file:///c:/Users/sindh/Downloads/career-compass-ai/career-compass-ai/apps/api/test/unit/prediction-math.util.spec.ts) — Updated unit tests for portfolio classification.
9. [p0-historical-eligibility.spec.ts](file:///c:/Users/sindh/Downloads/career-compass-ai/career-compass-ai/apps/api/test/unit/p0-historical-eligibility.spec.ts) — Created unit test suite covering historical eligibility statuses, ratio thresholds, and boundary conditions.

---

## 2. Files Untouched

* `apps/ai-service/rag/*` (RAG pipeline, retriever, embeddings, vectorstore untouched).
* `apps/api/src/modules/scholarships/*` (Scholarship module intact).
* `apps/api/src/modules/financial-planning/*` (Financial ROI utilities untouched).
* `apps/api/src/modules/colleges/*` (College repository intact).
* `files/*` (All reference CSV datasets untouched).

---

## 3. Database Changes

* Schema `Cutoff` extended with optional properties:
  * `counsellingAuthority` (String)
  * `collegeCode` (String)
  * `collegeName` (String)
  * `courseCode` (String)
  * `courseName` (String)
  * `quota` (String)
  * `state` (String)
  * `collegeType` (String)
* `round` prop changed to `Schema.Types.Mixed` to support both numeric rounds and string scopes (e.g., `"All Rounds"`, `"Round 4"`).
* New compound index created: `{ examCode: 1, collegeCode: 1, courseCode: 1, category: 1 }`.

---

## 4. Ingestion Process

* Source Dataset: `files/comedk_cutoffs_clean.csv` (730 clean deduplicated rows).
* Mechanism: The CSV file is read and parsed during seed / startup using an RFC 4180 compliant CSV parser.
* Mapping:
  * `exam` $\to$ `examCode` = `"COMEDK"`
  * `year` $\to$ `year` (Number)
  * `round` $\to$ `round` ("All Rounds", "Round 4")
  * `college_code` $\to$ `collegeCode` & `collegeId`
  * `college_name_normalized` $\to$ `collegeName`
  * `seat_category` $\to$ `category` ("GM", "KKR")
  * `course_normalized` $\to$ `courseCode` & `courseId`
  * `course_raw` $\to$ `courseName`
  * `closing_rank` $\to$ `closingRank`
  * `openingRank` $\to$ `undefined` / `null` (**Never fabricated**).
* Result: 730 official COMEDK records successfully ingested into MongoDB `cutoffs` collection.

---

## 5. Eligibility Formula & Portfolio Classification Rules

### 5.1 Historical Eligibility Formula
Given a student rank $R_{student}$ and historical closing rank $C_{hist}$:
* **`HISTORICALLY_ELIGIBLE`**: $R_{student} \le C_{hist}$ (Student rank is numerically lower/equal to closing rank).
* **`HISTORICALLY_NOT_ELIGIBLE`**: $R_{student} > C_{hist}$.
* **`INSUFFICIENT_DATA`**: $C_{hist} \le 0$ or no records found for requested exam/category/course.

### 5.2 Configurable SAFE / TARGET / DREAM Classification
Using rank ratio $r = R_{student} / C_{hist}$:
* **SAFE:** $r \le 0.80$
* **TARGET:** $0.80 < r \le 1.05$
* **DREAM:** $1.05 < r \le 1.30$
* **OUTSIDE_HISTORICAL_RANGE:** $r > 1.30$

*Top-Rank Rule ($R_{student} \le 500$ & $C_{hist} \le 500$):*
* SAFE: $C_{hist} - R_{student} \ge 100$
* TARGET: $-50 \le C_{hist} - R_{student} < 100$
* DREAM: $-150 \le C_{hist} - R_{student} < -50$
* OUTSIDE_HISTORICAL_RANGE: $C_{hist} - R_{student} < -150$

---

## 6. Recommendation Scoring & Data-Backed Explanations

* **Recommendation Score ($S \in [1, 99]$):** Continuous piecewise curve mapping rank ratio to relative suitability for UI sorting.
* **Explanations:** Generated dynamically from ground-truth parameters:
  * *"Student rank (5,200) is better than historical closing rank (6,100)."*
  * *"Preferred course matches Computer Science Engineering."*
  * *"Top NIRF accredited institution (Rank #82)."*

---

## 7. Removal of Synthetic Fallback Behavior

The synthetic category multiplier generator (`SEED_CATEGORY_MULTIPLIER`) in `CutoffService` has been **completely removed**. If a student queries an exam, category, or course without real historical cutoff records in MongoDB, the engine returns `status: "INSUFFICIENT_DATA"` rather than fabricating fallback numbers.

---

## 8. Test Results

Unit and integration test suites run via Jest:
```
PASS test/unit/prediction-math.util.spec.ts (6.441 s)
PASS test/unit/course-matcher.util.spec.ts (6.997 s)
PASS test/unit/eligibility-engine.service.spec.ts (7.449 s)
PASS test/unit/p0-historical-eligibility.spec.ts (8.038 s)
PASS test/unit/prediction-engine.service.spec.ts (8.069 s)

Test Suites: 5 passed, 5 total
Tests:       63 passed, 63 total
Snapshots:   0 total
Time:        9.103 s
```
All 63 test cases passed cleanly.

---

## 9. Known Limitations (Current COMEDK Data Scope)

1. **Opening Ranks:** Unavailable in COMEDK OCR source documents (0% presence). Preserved as `null`.
2. **Comparable Years:** Only 2024 (All Rounds) and 2025 (Round 4) exist. Time-series ML forecasting remains disabled (`FORECAST_NOT_AVAILABLE`).
3. **Category Scope:** COMEDK dataset covers GM and KKR categories only.
4. **KCET / JEE / NEET Datasets:** Data foundation schemas are ready, but actual historical dataset CSVs for KCET, JEE Main, and NEET are not yet ingested (deferred to future dataset phases).
