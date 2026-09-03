# ML Integration Report — KCET & COMEDK Prediction Pipeline

**Project:** CareerCompass AI  
**Date:** August 20, 2026  
**Document:** `docs/ML_INTEGRATION_REPORT.md`  
**Status:** ML INTEGRATION COMPLETE

---

## Executive Summary

We have successfully integrated the pre-trained KCET and COMEDK Random Forest ML models into the CareerCompass AI application. By bridging a Python FastAPI machine learning microservice and the core NestJS backend with a clean HTTP client API, we now support robust, data-honesty-driven ML forecasting while completely complying with strict terminology constraints.

---

## 1. Architecture & Core Changes

### 1.1 FastAPI Microservice Layer (`apps/ai-service`)
- **Lazy Model Loading:** Joblib models for KCET and COMEDK are loaded lazily on-demand when requested by the `/predict` endpoint to save memory.
- **Inference Endpoint (`POST /predict`):** Implemented in `main.py` using `PredictMLRequest` and `PredictMLResponse` schemas in `schemas.py`.
- **Ordinal Preprocessing & Encoding:** The joblib files contain full preprocessing pipelines (encoders/scalers/imputers). Features such as `college_code`, `course_code`, `category`, and `college_type` are mapped dynamically from the request payloads to feed pandas DataFrames to scikit-learn.

### 1.2 NestJS HTTP Client & Schema Integration (`apps/api`)
- **Client Method:** Added `predictML` method in `AiServiceClient` to query `/predict`.
- **Mongoose Schema (`prediction.model.ts`):** Registered new fields:
  - `predictedClosingRank` (Number)
  - `forecastStatus` (String, either `AVAILABLE` or `FORECAST_NOT_AVAILABLE`)
- **Predictions Module:** Configured `AiClientModule` injection in `predictions.module.ts`.

### 1.3 Forecast Evaluation & Data Honesty (`prediction.service.ts` & `prediction-engine.service.ts`)
- **Legitimate Data Requirement:** A forecast is only attempted if there are at least **4 unique years** of trend data available.
- **Exam safety rules:**
  - Invokes the ML model only for `KCET` and `COMEDK` exams.
  - Automatically defaults to `FORECAST_NOT_AVAILABLE` with `null` predicted rank for `JEE Main` and `NEET` requests (no ML simulation).
- **Graceful Fallbacks:** If a model/file fails to load or if a microservice error occurs, the API catches the exception, logs it, and returns `FORECAST_NOT_AVAILABLE` with a `null` predicted rank.

---

## 2. Frontend & Terminology Cleanup (`apps/web`)

To enforce data honesty and avoid misleading labels, all probability/chance wording has been removed:
- **ResultCard.tsx:** Displays `ML Forecast` (predicted rank) and `Forecast Status`.
- **CompareDrawer.tsx:** Replaced the "Admission Probability" row with `Recommendation Fit Score`, `Portfolio Classification`, `ML Forecast`, and `Forecast Status` metrics.
- **FiltersPanel.tsx & PredictorForm.tsx:** Updated buttons and sort labels from "Admission Probability" to "Recommendation Fit Score" and "Recommendation Fit & Cutoff".
- **page.tsx:** Replaced page descriptions and title headers referencing "Admission Probability Predictor" with "Cutoff & Recommendation Engine".

---

## 3. Test Verification & Results

### 3.1 Python Backend Tests (`apps/ai-service/tests`)
We created `tests/test_prediction.py` to cover:
- Lazily loading KCET/COMEDK model pipelines.
- Successful prediction queries against both KCET and COMEDK pipelines.
- Error handling for unsupported exams (e.g. JEE).
- Fallbacks for missing model files.

**Pytest execution output:**
```text
tests/test_prediction.py::test_model_loading_kcet PASSED                 [ 16%]
tests/test_prediction.py::test_model_loading_comedk PASSED               [ 33%]
tests/test_prediction.py::test_predict_endpoint_kcet PASSED              [ 50%]
tests/test_prediction.py::test_predict_endpoint_comedk PASSED            [ 66%]
tests/test_prediction.py::test_unsupported_exam PASSED                   [ 83%]
tests/test_prediction.py::test_missing_model_file PASSED                 [100%]

======================= 6 passed in 4.73s ========================
```

### 3.2 NestJS Spec Tests (`apps/api/test`)
We updated `prediction-engine.service.spec.ts`, `ai-service.client.spec.ts`, `p0-historical-eligibility.spec.ts`, and `prediction.service.roi.spec.ts` to mock and inject `AiServiceClient` and test forecast conditions.

**Jest execution output:**
```text
PASS test/unit/ai-service.client.spec.ts
PASS test/unit/prediction-engine.service.spec.ts
PASS test/unit/p0-historical-eligibility.spec.ts
PASS test/unit/prediction.service.roi.spec.ts

Test Suites: 4 passed, 4 total
Tests:       44 passed, 44 total
Snapshots:   0 total
Time:        12.988 s
```
All tests compiled and passed successfully!
