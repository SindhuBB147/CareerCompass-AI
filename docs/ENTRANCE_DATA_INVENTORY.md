# Real Entrance-Exam Data Inventory & Readiness Audit

**Project:** CareerCompass AI  
**Date:** August 16, 2026  
**Document:** `docs/ENTRANCE_DATA_INVENTORY.md`  
**Status:** COMPLETE AUDIT REPORT

---

## 1. Entrance Data Inventory

An audit of `files/`, `apps/`, database seeding scripts (`seed.ts`), MongoDB models (`cutoff.model.ts`), and cutoff adapters (`ComedkCutoffAdapter`, `KcetCutoffAdapter`, etc.) was conducted to determine the exact status of historical cutoff and counselling datasets.

### KCET (Karnataka Common Entrance Test)

* **data files found:** None (0 files found in `files/`).
* **source:** Mock demonstration rows only in `apps/api/src/database/seed.ts`. No real KEA (Karnataka Examinations Authority) dataset exists in the workspace.
* **years available:** 0 real historical years. (Mock 2023, 2024, 2025 rows for 3 colleges in the seed script).
* **rounds:** Mock Round 1.
* **categories:** GM (mock). Real KEA category codes (e.g., `1G`, `2AG`, `2BG`, `3AG`, `3BG`, `SCG`, `STG`, `1R`, `1K`, `2AR`, `2AK`, etc.) are completely missing.
* **quotas:** Mock State Quota only.
* **colleges:** 3 mock colleges in the seed script (RVCE, BMSCE, PESU).
* **courses:** 1 course (CSE).
* **opening rank available?:** Mock opening ranks present in seed script; **unavailable** for real KEA data.
* **closing rank available?:** Mock closing ranks present in seed script.
* **college code available?:** Mock internal IDs (e.g., `RVCE-CSE`).
* **course code available?:** Mock course IDs.
* **data format:** Hardcoded TypeScript array in `seed.ts`.
* **quality:** Non-production demo mock data.
* **current readiness:** **UNREADY** (`isReadyForEligibility = false`). Real KEA dataset must be acquired.

---

### COMEDK (Undergraduate Entrance Test)

* **data files found:** `files/comedk_cutoffs_clean.csv` (237 KB, 730 clean, deduplicated rows).
* **source:** Official COMEDK PDFs (`comedk_2024_all_rounds.pdf`, `comedk_2025_r4.pdf`).
* **years available:** 2024 and 2025 (2 years total).
* **rounds:** 
  * 2024: Scope represents `"All Rounds"` consolidated closing ranks.
  * 2025: Scope represents `"Round 4"` closing ranks.
* **categories:** `GM` (General Merit) and `KKR` (Kalyana Karnataka Region).
* **quotas:** All-India Merit & Regional Quota.
* **colleges:** 180+ engineering institutions in Karnataka.
* **courses:** 40+ normalized engineering branches (e.g., `CS`, `AI`, `EC`, `EE`, `ME`, `CE`, `IS`, `AD`).
* **opening rank available?:** **NO** (0% presence in source OCR PDFs; preserved as `null`).
* **closing rank available?:** **YES** (100% presence).
* **college code available?:** **YES** (`college_code`, e.g., `E001`, `E002`, `E005`).
* **course code available?:** **YES** (`course_normalized`, e.g., `CS`, `AI`, `EC`).
* **data format:** Cleaned RFC 4180 CSV (`files/comedk_cutoffs_clean.csv`).
* **quality:** High (deduplicated, normalized, schema-validated).
* **current readiness:** **HISTORICAL ELIGIBILITY READY** (`isReadyForEligibility = true`). **FORECAST UNREADY** (`FORECAST_NOT_AVAILABLE` due to $< 4$ continuous comparable years).

---

### JEE Main (Joint Entrance Examination Main / JoSAA / CSAB)

* **data files found:** None (0 files found in `files/` or `apps/`).
* **source:** Missing.
* **years available:** 0.
* **rounds:** None.
* **categories:** Missing (no categories like `OPEN`, `EWS`, `OBC-NCL`, `SC`, `ST`, `OPEN-PwD`).
* **quotas:** Missing (no quotas like `HS` - Home State, `OS` - Other State, `AI` - All India).
* **colleges:** 0.
* **courses:** 0.
* **opening rank available?:** Missing.
* **closing rank available?:** Missing.
* **college code available?:** Missing.
* **course code available?:** Missing.
* **data format:** None.
* **quality:** N/A.
* **current readiness:** **UNREADY** (`isReadyForEligibility = false`). Official JoSAA/CSAB datasets required.

---

### NEET (National Eligibility cum Entrance Test — Medical / Dental)

* **data files found:** None (0 files found in `files/` or `apps/`).
* **source:** Missing.
* **years available:** 0.
* **rounds:** None.
* **categories:** Missing (no categories like `UR`, `OBC`, `SC`, `ST`, `EWS`).
* **quotas:** Missing (no quotas like `AIQ` - All India Quota, State Quota, Management, NRI).
* **colleges:** 0.
* **courses:** 0 (no courses like `MBBS`, `BDS`, `BAMS`, `BHMS`).
* **opening rank available?:** Missing.
* **closing rank available?:** Missing.
* **college code available?:** Missing.
* **course code available?:** Missing.
* **data format:** None.
* **quality:** N/A.
* **current readiness:** **UNREADY** (`isReadyForEligibility = false`). Official MCC/relevant state counselling authority datasets required.

---

## 2. Current COMEDK Data Limitations

The existing processed file `files/comedk_cutoffs_clean.csv` has the following explicit limitations:

* **2024 All Rounds:** The 2024 data represents a consolidated summary of all rounds.
* **2025 Round 4:** The 2025 data represents Round 4 cutoffs only.
* **closing rank available:** Closing ranks are 100% available.
* **opening rank unavailable:** Opening ranks are completely unavailable (0% presence, preserved as `null`).
* **partial category coverage:** The dataset covers General Merit (`GM`) and Kalyana Karnataka Region (`KKR`) categories only.
* **two non-comparable scopes:** Due to the scope difference (2024 All Rounds vs 2025 Round 4), comparing these two years directly to compute cutoff trends or train forecasting models will lead to erroneous results.

---

## 3. Common Cutoff Schema Audit

A comparison was conducted between the requested common schema properties and the NestJS Mongoose model (`Cutoff` in `apps/api/src/modules/cutoffs/models/cutoff.model.ts`) and adapters.

### Mongoose Model Fields Support

| Requested Field | Model Property | Supported? | Data Type | Notes |
|---|---|---|---|---|
| `exam` | `examCode` | **YES** | String | Mapped to `examCode` for consistency with database indexing. |
| `year` | `year` | **YES** | Number | |
| `round` | `round` | **YES** | Mixed | Supports numbers or strings (e.g., `4`, `"All Rounds"`). |
| `counsellingAuthority` | `counsellingAuthority` | **YES** | String | Optional. |
| `collegeCode` | `collegeCode` | **YES** | String | Optional. |
| `collegeName` | `collegeName` | **YES** | String | Optional. |
| `courseCode` | `courseCode` | **YES** | String | Optional. |
| `courseName` | `courseName` | **YES** | String | Optional. |
| `category` | `category` | **YES** | String | |
| `quota` | `quota` | **YES** | String | Optional. |
| `openingRank` | `openingRank` | **YES** | Number | Optional (can be `null` or `undefined`). |
| `closingRank` | `closingRank` | **YES** | Number | |
| `state` | `state` | **YES** | String | Optional. |
| `collegeType` | `collegeType` | **YES** | String | Optional. |
| `source` | `source` | **YES** | String | Has enum checking `['official', 'manual_admin_entry']`. |

### Key Schema and Adapter Limitations (What is Missing)

While the MongoDB schema itself is structurally complete, the **query interface and adapter implementations are incomplete**:

1. **`exam` Named Field:** The schema and adapters exclusively use `examCode`. There is no `exam` field mapping inside the schema.
2. **Quota Ingestion/Filtering Ignored:** Although `quota` is present in the `Cutoff` schema and defined in `ExamCutoffQuery` (as an optional field), **none of the four adapters actually use `query.quota` to filter queries**.
3. **Year Filtering Missing in KCET/JEE/NEET Adapters:** The `ComedkCutoffAdapter` correctly appends `filter.year = query.year;` if provided. However, the other three adapters (`KcetCutoffAdapter`, `JosaaCutoffAdapter`, `NeetCutoffAdapter`) **do not support or filter by `year`**, even if provided in `query`.
4. **Missing Adapter Query Parameters:** The NestJS `ExamCutoffQuery` interface lacks query parameters for other schema elements such as `round`, `counsellingAuthority`, `state`, `collegeType`, and `source`. Thus, query filtering by these criteria cannot be handled natively through the adapter interface.

---

## 4. Data Quality Audit Findings

### KCET

* **duplicate rows:** 0 in processed files (none exist).
* **missing values:** 100% missing (no real data files found).
* **OCR issues:** N/A.
* **inconsistent college names:** N/A.
* **inconsistent course names:** N/A.
* **inconsistent categories:** N/A. Real KEA categories are entirely absent.
* **inconsistent rounds:** N/A.
* **inconsistent quotas:** N/A. Real KEA quotas are entirely absent.
* **source provenance:** N/A.

### COMEDK

* **duplicate rows:** 215 duplicate combinations (year, round, college_code, seat_category, course) were found in the raw OCR output. These were resolved by selecting the lowest closing rank (conservative choice) and logging the discarded rows in `comedk_duplicate_resolution.csv`.
* **missing values:** 0% missing in raw rows, but `openingRank` is entirely missing and recorded as `null`/`undefined`.
* **OCR issues:** Source PDFs (`comedk_2024_all_rounds.pdf`, `comedk_2025_round4.pdf`) are scanned page images. OCR errors caused table cell offsets, line breaks, and duplicate rows.
* **inconsistent college names:** 14 college codes had multiple spelling/spacing variants in the raw OCR output. Standardized names were written to `college_name_normalized`, using `college_code` as the single source of truth.
* **inconsistent course names:** 14 raw OCR course strings existed. These were normalized to 10 canonical values (e.g. `AE`, `AI`, `CS`, `EC`, etc.) mapped via `course_mapping_PROPOSED.csv`.
* **inconsistent categories:** Covered `GM` and `KKR` only. Other categories are missing.
* **inconsistent rounds:** 2024 has "All Rounds" consolidated ranks, while 2025 has "Round 4" ranks.
* **inconsistent quotas:** Quota was not parsed; `KKR` was recorded as a seat category instead of a regional quota.
* **source provenance:** Official PDFs downloaded from COMEDK portal (`comedk.org`).

### JEE Main

* **duplicate rows:** 0 (no files).
* **missing values:** 100% missing.
* **OCR issues:** N/A.
* **inconsistent college names:** N/A.
* **inconsistent course names:** N/A.
* **inconsistent categories:** N/A. Missing all standard JoSAA categories (`OPEN`, `EWS`, `OBC-NCL`, `SC`, `ST`, etc.).
* **inconsistent rounds:** N/A. Missing all standard rounds (Rounds 1–6).
* **inconsistent quotas:** N/A. Missing quotas (`HS`, `OS`, `AI`).
* **source provenance:** N/A.

### NEET

* **duplicate rows:** 0 (no files).
* **missing values:** 100% missing.
* **OCR issues:** N/A.
* **inconsistent college names:** N/A.
* **inconsistent course names:** N/A.
* **inconsistent categories:** N/A. Missing categories (`UR`, `OBC`, `SC`, `ST`, `EWS`, etc.).
* **inconsistent rounds:** N/A. Missing categories / rounds.
* **inconsistent quotas:** N/A. Missing quotas (`AIQ`, State Quota, etc.).
* **source provenance:** N/A.

---

## 5. ML Readiness Assessment

### 5.1 Historical Eligibility Readiness

Can we reliably compare a student's rank against historical cutoffs?

* **COMEDK:** **YES.** Student ranks can be evaluated against the 2024 and 2025 closing ranks from `comedk_cutoffs_clean.csv` (using GM/KKR categories), but with the documented warning that 2024 represents "All Rounds" and 2025 represents "Round 4".
* **KCET:** **NO.** Requires real KEA historical allotment data.
* **JEE Main:** **NO.** Requires JoSAA/CSAB historical allotment data.
* **NEET:** **NO.** Requires MCC/relevant state authority medical allotment data.

### 5.2 Cutoff Forecasting Readiness

Can we train a future closing-rank model?

* **Minimum Condition:** At least 4 continuous, comparable historical years (same exam, same round, same category, same course structure).
* **Readiness Status Across ALL Exams:** **`FORECAST_NOT_AVAILABLE`**
  * **COMEDK:** Only 2024 and 2025 are available, and their rounds/scopes are non-comparable.
  * **KCET, JEE Main, NEET:** 0 historical years of real data exist.
  * **Policy:** CareerCompass AI strictly blocks and returns `FORECAST_NOT_AVAILABLE` until $\ge 4$ years of official historical data are acquired. Under no circumstances will synthetic years or data be generated to bypass this rule.

---

## 6. Data Acquisition Plan

To resolve the missing datasets, the following official data acquisition tasks must be performed:

### KCET Data Acquisition Plan

* **what files are required:** KEA Engineering Allotment Cutoff Sheets / PDFs.
* **which years are required:** 2022, 2023, 2024, 2025.
* **which rounds are required:** Round 1, Round 2, and Second Extended Round.
* **which categories/quotas are required:** `1G`, `2AG`, `2BG`, `3AG`, `3BG`, `SCG`, `STG`, `1R`, `1K`, `2AR`, `2AK`, etc., for General, Rural, and Kannada Medium quotas.
* **preferred authoritative source:** KEA Official Portal (`cetonline.karnataka.gov.in`).
* **expected schema:** Standard 15-field Common Cutoff schema.
* **whether source is downloadable as CSV, Excel, PDF, or API:** PDF files / HTML tables.
* **conversion required:** Text extraction/OCR parsing $\rightarrow$ Column normalization $\rightarrow$ Cleaned CSV (`kcet_cutoffs_clean.csv`).

### COMEDK Data Acquisition Plan (Expansion)

* **what files are required:** COMEDK Round 1, Round 2, and Round 3 allotment lists.
* **which years are required:** 2022, 2023, 2024 (Rounds 1–3 breakdowns), 2025 (Rounds 1–3 breakdowns).
* **which rounds are required:** Round 1, Round 2, Round 3.
* **which categories/quotas are required:** `GM` and `KKR`.
* **preferred authoritative source:** COMEDK Portal (`comedk.org`).
* **expected schema:** Standard 15-field Common Cutoff schema.
* **whether source is downloadable as CSV, Excel, PDF, or API:** PDF tables.
* **conversion required:** PDF extraction $\rightarrow$ De-duplication and normalization $\rightarrow$ Append to `comedk_cutoffs_clean.csv`.

### JEE Main Data Acquisition Plan

* **what files are required:** JoSAA and CSAB Opening and Closing Ranks Excel Sheets / Archives.
* **which years are required:** 2022, 2023, 2024, 2025.
* **which rounds are required:** Round 1 to Round 6.
* **which categories/quotas are required:** `OPEN`, `EWS`, `OBC-NCL`, `SC`, `ST` (for Home State `HS`, Other State `OS`, and All India `AI` quotas).
* **preferred authoritative source:** JoSAA Archives (`josaa.admissions.nic.in`) and CSAB Portal.
* **expected schema:** Standard 15-field Common Cutoff schema.
* **whether source is downloadable as CSV, Excel, PDF, or API:** Excel downloads / HTML tables.
* **conversion required:** Spreadsheet parsing $\rightarrow$ Column mapping & normalization $\rightarrow$ Cleaned CSV (`josaa_cutoffs_clean.csv`).

### NEET Data Acquisition Plan

* **what files are required:** MCC Medical Counseling Cutoffs & relevant State Counselling Cutoff tables.
* **which years are required:** 2022, 2023, 2024, 2025.
* **which rounds are required:** Round 1, Round 2, Round 3 (Mop-Up), and Stray Vacancy Round.
* **which categories/quotas are required:** `UR`, `OBC`, `SC`, `ST`, `EWS` (for All India Quota `AIQ` and State Quotas).
* **preferred authoritative source:** MCC Portal (`mcc.nic.in`) and State Counselling Portals (e.g. KEA for Karnataka state quota MBBS).
* **expected schema:** Standard 15-field Common Cutoff schema.
* **whether source is downloadable as CSV, Excel, PDF, or API:** PDF files / MCC online archives.
* **conversion required:** PDF OCR / HTML scraping $\rightarrow$ Column normalization $\rightarrow$ Cleaned CSV (`neet_cutoffs_clean.csv`).

---

## 7. Summary Matrix & Priorities

| Exam     | Data Available | Years | Eligibility Ready | Forecast Ready | Missing |
| -------- | -------------- | ----- | ----------------- | -------------- | ------- |
| KCET     | NO (Mock seed only) | Mock | NO | FORECAST_NOT_AVAILABLE | Real KEA allotment datasets, categories, and rounds. |
| COMEDK   | YES (730 clean rows) | 2024, 2025 | YES | FORECAST_NOT_AVAILABLE | Opening ranks, 2022-2023 history, Rounds 1-3 breakdowns. |
| JEE Main | NO | 0 | NO | FORECAST_NOT_AVAILABLE | JoSAA/CSAB opening & closing rank datasets. |
| NEET     | NO | 0 | NO | FORECAST_NOT_AVAILABLE | MCC & State Counselling allotment datasets. |

### Recommended Implementation Priorities

* **P0 — Already Available:**
  * **COMEDK:** Deterministic eligibility engine is ready based on the 2024/2025 closing ranks in `comedk_cutoffs_clean.csv`.
* **P1 — Most Important Missing Dataset:**
  * **KCET:** As CareerCompass AI focuses heavily on Karnataka engineering counselling, obtaining official KEA KCET datasets (2022–2025) is the highest priority missing task.
* **P2 — Later Expansion:**
  * **JEE Main & NEET:** joSAA and MCC medical counselling datasets represent the national and medical expansion tiers.
  * **COMEDK (Historical Expansion):** Acquiring 2022–2023 COMEDK data to reach $\ge 4$ comparable years for forecasting.
