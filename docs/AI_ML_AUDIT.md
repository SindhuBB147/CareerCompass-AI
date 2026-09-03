# AI/ML & Intelligence Components Audit

**Project:** CareerCompass AI  
**Date:** August 16, 2026  
**Scope:** `apps/ai-service`, `apps/api`

---

## Executive Summary

An exhaustive audit of the CareerCompass AI repository was conducted to inspect all intelligence, prediction, recommendation, cutoff forecasting, choice-filling, and classification logic.

### Key Finding
**There are currently NO trained machine learning (ML) models or statistical forecasting model artifacts in the codebase.**  
All current prediction features labeled as "admission probability" or "predictor" are **deterministic, rule-based heuristics** relying on rank-to-cutoff linear piecewise formulas and weighted historical averages.

---

## Detailed Component Audit

### 1. `apps/ai-service/ml/predictor.py` (`AdmissionPredictor`)
* **File Path:** `apps/ai-service/ml/predictor.py`
* **Class / Function:** `AdmissionPredictor.predict(student_rank: int, closing_rank: int)`
* **API Endpoint:** `POST /predict-probability` in `apps/ai-service/main.py`
* **Input:** `student_rank` (integer), `closing_rank` (integer)
* **Output:** `{"probability_percent": float, "band": str, "confidence": str}`
* **Algorithm:** Heuristic ratio calculation (`ratio = student_rank / closing_rank`).
  * `ratio <= 0.7`: Safe (85% – 98%)
  * `ratio <= 0.95`: Moderate (50% – 85%)
  * `ratio <= 1.15`: Ambitious (15% – 50%)
  * `ratio > 1.15`: Reach (2% – 15%)
* **Dataset:** None (accepts raw rank integers).
* **Trained Model Artifact:** None.
* **Type:** **Rule-based Heuristic** (linear piecewise interpolation on rank ratio).
* **Validation / Evaluation:** None.
* **Limitations:**
  * Uses hardcoded static ratio thresholds.
  * Completely ignores exam type, year, round, category, quota, course, college, or trend variance.
  * Misleadingly situated under `ml/` and labeled as an ML predictor.

---

### 2. `apps/api/src/modules/predictions/services/prediction.service.ts` (`PredictionService`)
* **File Path:** `apps/api/src/modules/predictions/services/prediction.service.ts`
* **Class / Function:** `PredictionService`
  * `getPrediction(userId, collegeId, courseId, examCode)`
  * `getShortlistPredictions(userId)`
  * `optimizeChoiceFilling(userId, examCode, riskAppetite)`
  * `getRoi(userId, collegeId, courseId)`
  * `getPlacementEstimate(collegeId, courseId)`
* **Input:** User IDs, College IDs, Course IDs, Exam Codes, Risk Appetite strings.
* **Output:** `PredictionResult` (4 probability bands: `Safe`, `Moderate`, `Ambitious`, `Reach`), ordered `ChoiceFillingEntry[]`, `RoiResult`, `PlacementResult`.
* **Algorithm:**
  * **Single Prediction:** Fetches category cutoff trend array, calculates weighted trending closing rank via `computeTrendingClosingRank` (weights: most recent year = 3, previous = 2, older = 1), calculates rank ratio (`studentRank / trendingClosingRank`), maps to probability % and 4 bands. Caches results in MongoDB `Prediction` collection with a 14-day TTL.
  * **Choice-Filling Optimizer:** Fetches saved predictions for user & exam, scales `probabilityPercent` by risk multiplier (`aggressive`: 0.6, `conservative`: 1.4, `neutral`: 1.0), and sorts descending.
  * **ROI & Placement:** Calculates 10-year geometric series earnings (8% CAGR assumption) against net tuition and living cost.
* **Dataset:** MongoDB `cutoffs` collection (auto-seeded or uploaded).
* **Trained Model Artifact:** None.
* **Type:** **Rule-based Heuristic & Financial Modeling**.
* **Validation / Evaluation:** None.
* **Limitations:**
  * Conflates cutoff rank ratio with true statistical "admission probability".
  * Choice optimizer merely re-sorts saved shortlist items with a global multiplier without modeling seat allocation logic, quotas, or choice rules.

---

### 3. `apps/api/src/modules/predictions/services/prediction-engine.service.ts` (`PredictionEngineService`)
* **File Path:** `apps/api/src/modules/predictions/services/prediction-engine.service.ts`
* **Class / Function:** `PredictionEngineService.predictColleges(dto: PredictCollegesDto)`
* **Input:** `examCode`, `rank`, `category`, `discipline`, `courseSelections`, `filters`, `sortBy`.
* **Output:** Paginated `RankedCollegeResult[]` (5 probability levels: `Very High`, `High`, `Medium`, `Low`, `Very Low`), `insights` array.
* **Algorithm:** Multi-college filter & scoring engine.
  * Filters active colleges/courses accepting `examCode` matching discipline/course selection.
  * Retrieves cutoff trend, calculates `trendingClosingRank`, computes rank ratio.
  * Maps ratio to probability curve (`probabilityPercentFromRatio`), applies horizontal reservation bonus (+2% per reservation, cap +8%).
  * Maps final percent to 5 probability bands (`bandFromPercent`).
  * Generates rule-based natural language insights (e.g. top safe choices, close cutoff matches, ROI callouts).
* **Dataset:** MongoDB `colleges`, `cutoffs`, `scholarships` collections.
* **Trained Model Artifact:** None.
* **Type:** **Rule-based Scoring & Ranking Engine**.
* **Validation / Evaluation:** None.
* **Limitations:**
  * Relies on synthetic multiplier-seeded cutoffs when real historical data is missing.
  * Does not perform statistical regression or time-series prediction.

---

### 4. `apps/api/src/modules/predictions/utils/prediction-math.util.ts`
* **File Path:** `apps/api/src/modules/predictions/utils/prediction-math.util.ts`
* **Functions:**
  * `computeTrendingClosingRank(data: YearlyClosingRank[]): number`
  * `probabilityPercentFromRatio(ratio: number): number`
  * `bandFromPercent(percent: number): ProbabilityBand5`
  * `confidenceFromDataPoints(dataPoints: number): 'high' | 'medium' | 'low'`
* **Algorithm:** Pure math helpers.
  * Weighted linear average: `(year_t * 3 + year_{t-1} * 2 + year_{t-2} * 1) / total_weights`.
  * Piecewise linear probability curve mapping ratio to percent.
* **Type:** **Deterministic Math Utility**.

---

### 5. `apps/api/src/modules/cutoffs/cutoff.service.ts` (`CutoffService`)
* **File Path:** `apps/api/src/modules/cutoffs/cutoff.service.ts`
* **Class / Function:** `CutoffService` (`getTrend`, `bulkUpload`, `resolveConflict`, `seedCutoffsIfEmpty`)
* **Input:** Cutoff key objects, bulk CSV upload rows.
* **Output:** Cutoff trend records, conflict reports, seed documents.
* **Algorithm:**
  * If MongoDB `cutoffs` collection is empty on startup, auto-generates multi-category/multi-year cutoff rows using synthetic multipliers (`GM`: 1.0, `EWS`: 1.1, `2A`: 1.3, `2B`: 1.4, `3A`: 1.5, `3B`: 1.6, `Cat-1`: 1.8, `SC`: 2.5, `ST`: 3.2; `2024`: 1.0, `2025`: 0.95) applied to baseline course ranks.
* **Dataset:** Baseline course rank metadata in MongoDB `colleges`.
* **Trained Model Artifact:** None.
* **Type:** **Rule-based Seed Generator & CRUD Service**.
* **Limitations:** Synthetic multipliers do not reflect real official KEA/NTA reservation category deltas.

---

### 6. `apps/ai-service/rag/` (RAG & Conversational Service)
* **File Paths:**
  * `apps/ai-service/rag/retriever.py`
  * `apps/ai-service/rag/search_intent.py`
  * `apps/ai-service/rag/search_entities.py`
  * `apps/ai-service/rag/prompt_builder.py`
  * `apps/ai-service/rag/response_validator.py`
* **Input:** Natural language query, student profile context.
* **Output:** Grounded LLM response text, citations, search intent classification, extracted entities (exam, rank, course, college).
* **Algorithm:** PostgreSQL `pgvector` semantic embedding search + rule-based entity/intent extraction + LLM context injection & numeric claim validation.
* **Dataset:** Vector embeddings of processed documents and structured DB records.
* **Trained Model Artifact:** External embedding models (e.g. OpenAI / HuggingFace text-embedding).
* **Type:** **Hybrid RAG + Rule-based Entity Extractor**.
* **Limitations:** Generative chat component only; does not handle deterministic cutoff lookup or admission classification.

---

## Summary Matrix of Intelligence Components

| Component File Path | Component Name | Primary Function | Input -> Output | Algorithm Type | Model Artifact | Validation |
|---|---|---|---|---|---|---|
| `apps/ai-service/ml/predictor.py` | `AdmissionPredictor` | Single rank/cutoff ratio band | `student_rank`, `closing_rank` -> `probability_percent`, `band` | Heuristic Ratio Rules | None | None |
| `apps/api/.../prediction.service.ts` | `PredictionService` | Single prediction & choice optimizer | `userId`, `collegeId`, `courseId`, `examCode` -> `PredictionResult`, `ChoiceFillingEntry[]` | Weighted Average + Piecewise Ratio | None | None |
| `apps/api/.../prediction-engine.service.ts` | `PredictionEngineService` | Multi-college search & ranking | `PredictCollegesDto` -> `RankedCollegeResult[]`, `insights` | Filter + Ratio Score + Bonus | None | None |
| `apps/api/.../prediction-math.util.ts` | Pure Math Utils | Weighted cutoff trend math | `YearlyClosingRank[]` -> `trendingClosingRank` | Weighted Linear Average | None | Unit tests |
| `apps/api/.../cutoff.service.ts` | `CutoffService` | Cutoff storage & synthetic seed | Bulk rows / DB -> `CutoffDocument[]` | Multiplier-based Synthetic Seed | None | Conflict check |
| `apps/ai-service/rag/*` | RAG Pipeline | Conversational QA & Intent | Query string -> LLM Answer + Citations | Pgvector RAG + Entity Rules | Embedding Model | Numeric validation |
