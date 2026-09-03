# Entrance Exam Data Readiness Report

**Project:** CareerCompass AI  
**Date:** August 16, 2026  
**Scope:** Dataset readiness evaluation across KCET, COMEDK, JEE Main, and NEET entrance exams.

---

## Executive Summary

This report evaluates all datasets currently available in the repository (`files/` directory and API seed databases). Data readiness is audited separately for each of the four primary entrance exams.

The common cutoff database schema and adapters have been updated to support strict, exact query filtering on:
* `examCode`
* `year`
* `round`
* `category`
* `quota`
* `collegeCode`
* `courseCode`

In addition, an automated readiness report endpoint (`GET /cutoffs/readiness`) has been implemented to dynamically read row counts, years, rounds, categories, quotas, and rank coverages directly from the dataset.

---

## Exam-by-Exam Data Readiness Audit

### 1. COMEDK (Consortium of Medical, Engineering and Dental Colleges of Karnataka)

* **Status:** **PARTIALLY READY (Historical Lookup Ready / ML Forecast Unready)**
* **Years Available:** 2024 and 2025 (2 years total).
* **Rounds Available:** 
  * 2024: "All Rounds" (combined summary).
  * 2025: "Round 4" only.
  * *Critical Limitation:* The 2024 and 2025 rounds represent completely different counselling scope and cannot be compared as a time series.
* **Categories Available:**
  * General Merit (GM): Present in both 2024 and 2025.
  * Kalyana Karnataka Region (KKR): Present ONLY in 2024 (0 rows in 2025).
* **Quotas Available:** KKR is recorded as a seat category; quota is not separated.
* **Colleges Covered:** 180+ engineering institutions in Karnataka, canonicalized by `collegeCode` / `collegeId`.
* **Courses Covered:** 10 canonical normalized courses (`AE`, `AI`, `CB`, `CD`, `CE`, `CS`, `EC`, `EE`, `IS`, `ME`), mapped from 14 raw OCR strings.
* **Opening Rank:** **NOT AVAILABLE** (0% coverage; only closing rank was extracted from source PDFs).
* **Closing Rank:** **AVAILABLE** across all 730 clean deduplicated rows.
* **Source:** OCR-derived from scanned PDF official allotment documents (`comedk_2024_all_rounds.pdf`, `comedk_2025_round4.pdf`).
* **Readiness Evaluation:**
  * **Deterministic Eligibility Engine:** READY (using 2024/2025 GM closing ranks).
  * **ML Cutoff Forecasting:** UNREADY (insufficient comparable years, round mismatch).

---

### 2. KCET (Karnataka Common Entrance Test)

* **Status:** **UNREADY (0% Real Historical Dataset)**
* **Years Available:** None in processed CSV files.
* **Rounds Available:** None (no real data).
* **Categories Available:** None (no real data).
* **Quotas Available:** None (no real data).
* **Colleges Covered:** None.
* **Courses Covered:** None.
* **Opening Rank:** N/A.
* **Closing Rank:** N/A.
* **Source:** N/A.
* **Adapter Lock behavior:** When the `files/kcet/raw/` directory is empty or missing, the KCET adapter returns `[]` from `fetchHistoricalCutoffs()` and `false` from `isReadyForEligibility()`. The system does **NOT** fall back to mock colleges or synthetic generated cutoffs, guaranteeing a clean `INSUFFICIENT_DATA` response.
* **Ingestion Script:** A reproducible ingestion script `apps/api/src/database/ingest-kcet.ts` has been created to process raw KEA files, validate columns, normalize course/college codes, resolve duplicates, and output `files/kcet_cutoffs_clean.csv` along with quality reports.
* **Readiness Evaluation:**
  * **Deterministic Eligibility Engine:** REQUIRES REAL KEA DATA INGESTION under `files/kcet/raw/`.
  * **ML Cutoff Forecasting:** UNREADY.

---

### 3. JEE Main (Joint Entrance Examination - Main)

* **Status:** **UNREADY (0% Dataset)**
* **Years Available:** None (0 years).
* **Rounds Available:** None.
* **Categories Available:** None.
* **Quotas Available:** None.
* **Colleges Covered:** None.
* **Courses Covered:** None.
* **Source:** None.
* **Readiness Evaluation:**
  * **Deterministic Eligibility Engine:** UNREADY.
  * **ML Cutoff Forecasting:** UNREADY.

---

### 4. NEET (National Eligibility cum Entrance Test)

* **Status:** **UNREADY (0% Dataset)**
* **Years Available:** None (0 years).
* **Rounds Available:** None.
* **Categories Available:** None.
* **Quotas Available:** None.
* **Colleges Covered:** None.
* **Courses Covered:** None.
* **Source:** None.
* **Readiness Evaluation:**
  * **Deterministic Eligibility Engine:** UNREADY.
  * **ML Cutoff Forecasting:** UNREADY.

---

## Detailed Data Readiness Matrix

| Entrance Exam | Real Dataset Available | Historical Years | Rounds Scope | Category Coverage | Opening Rank Coverage | Closing Rank Coverage | Overall Readiness |
|---|---|---|---|---|---|---|---|
| **COMEDK** | Yes (`comedk_cutoffs_clean.csv`) | 2024, 2025 | 2024 All Rounds / 2025 R4 | GM, KKR | 0% | 100% | **Partial (Lookup Ready)** |
| **KCET** | No | 0 | None | None | 0% | 0% | **Unready** |
| **JEE Main** | No | 0 | None | None | 0% | 0% | **Unready** |
| **NEET** | No | 0 | None | None | 0% | 0% | **Unready** |
