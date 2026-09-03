# Probability Terminology Cleanup Report

**Project:** CareerCompass AI  
**Date:** August 16, 2026  
**Document:** `docs/PROBABILITY_TERMINOLOGY_CLEANUP.md`  
**Status:** COMPLETE

---

## Executive Summary

To eliminate misleading language and maintain strict scientific integrity, all numerical output fields and UI labels representing deterministic rank-cutoff assessments have been updated.

The system no longer presents rank-ratio scores as "admission probabilities" or "% admission chance".

---

## 1. Primary Semantic Concept & Field Mapping

| Old / Deprecated Field | New Primary Field | Semantic Meaning |
|---|---|---|
| `probabilityPercent` | `recommendationFitScore` | Multi-criteria recommendation & suitability fit score ($1 \text{ to } 99$). |
| `probabilityLevel` | `portfolioClassification` | Portfolio category (`SAFE`, `TARGET`, `DREAM`, `OUTSIDE_HISTORICAL_RANGE`, `INSUFFICIENT_DATA`). |
| `probability_percent` | `recommendation_score` | Python microservice fit score. |

---

## 2. Backward Compatibility Strategy

To avoid breaking existing frontend API consumers during migration:
* `probabilityPercent` is retained on TypeScript interfaces and MongoDB models, explicitly annotated as `@deprecated`.
* `probabilityPercent` returns the exact numeric value of `recommendationFitScore`.
* Documentation and UI components no longer display `"% admission chance"`; they display `"${fitScore}/100"` and `"${classification} Portfolio Fit"`.

---

## 3. Files Updated

1. [types.ts](file:///c:/Users/sindh/Downloads/career-compass-ai/career-compass-ai/apps/web/src/app/predictions/types.ts) — Added `recommendationFitScore` and `portfolioClassification`; marked `probabilityPercent` and `probabilityLevel` as `@deprecated`.
2. [ResultCard.tsx](file:///c:/Users/sindh/Downloads/career-compass-ai/career-compass-ai/apps/web/src/app/predictions/components/ResultCard.tsx) — Updated UI to render `${fitScore}/100` and `${classification} Portfolio Fit`, removing `% admission chance` labels.
3. [page.tsx (Compare)](file:///c:/Users/sindh/Downloads/career-compass-ai/career-compass-ai/apps/web/src/app/wishlist/compare/page.tsx) — Updated table label from `Admission Probability` to `Recommendation Fit Score`.
4. [context-aggregator.service.ts](file:///c:/Users/sindh/Downloads/career-compass-ai/career-compass-ai/apps/api/src/modules/counsellor/services/context-aggregator.service.ts) — Updated AI Counsellor structured prompt context to state `Recommendation Fit Score: X/100 (Classification: SAFE)`.
5. [admission-prediction.section.ts](file:///c:/Users/sindh/Downloads/career-compass-ai/career-compass-ai/apps/api/src/modules/student-reports/templates/sections/admission-prediction.section.ts) — Updated student report table headers to `Recommendation Fit Score` and `Portfolio Band`.
6. [prediction.model.ts](file:///c:/Users/sindh/Downloads/career-compass-ai/career-compass-ai/apps/api/src/modules/predictions/models/prediction.model.ts) — Added `recommendationFitScore` and `portfolioClassification` to MongoDB schema.

---

## 4. Valid Conceptual Output Schema

```json
{
  "collegeId": "E001",
  "collegeName": "Acharya Institute of Technology",
  "courseName": "Computer Science & Engineering",
  "recommendationFitScore": 88,
  "portfolioClassification": "SAFE",
  "scoreBreakdown": {
    "eligibility": 95,
    "branchMatch": 100,
    "location": 85,
    "budget": 100,
    "placement": 70,
    "collegeQuality": 70,
    "roi": 85
  },
  "reasons": [
    "Student rank (5,000) is better than historical closing rank (29,367).",
    "Preferred course matches Computer Science & Engineering.",
    "Located in target city (Bengaluru)."
  ],
  "provenance": {
    "exam": "COMEDK",
    "year": 2024,
    "round": "All Rounds",
    "category": "GM",
    "source": "comedk_cutoffs_clean.csv"
  }
}
```

---

## 5. Verification & Test Suite Execution

Executed full unit test suite across NestJS services and math utilities:

```text
PASS test/unit/course-matcher.util.spec.ts (7.273 s)
PASS test/unit/prediction-math.util.spec.ts (8.194 s)
PASS test/unit/eligibility-engine.service.spec.ts (8.377 s)
PASS test/unit/p1-recommendation-and-optimizer.spec.ts (8.916 s)
PASS test/unit/p0-historical-eligibility.spec.ts (11.464 s)
PASS test/unit/prediction-engine.service.spec.ts (11.49 s)

Test Suites: 6 passed, 6 total
Tests:       69 passed, 69 total
Snapshots:   0 total
Time:        12.751 s
```
All 69 test cases passed.
