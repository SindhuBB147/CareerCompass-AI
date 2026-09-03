# KCET Data Acquisition Specification

**Project:** CareerCompass AI  
**Document:** `docs/KCET_DATA_ACQUISITION_SPEC.md`  
**Status:** Canonical Ingestion Contract

This specification defines the raw data requirements, schema constraints, validation rules, and terminology mappings required by the KCET ingestion pipeline (`apps/api/src/database/ingest-kcet.ts`).

---

## 1. Required Files

To trigger ingestion, official KEA cutoff datasets must be placed in:

`files/kcet/raw/`

### Supported Formats
* **CSV:** Comma-separated values (RFC 4180 compliant).
* **TXT:** Delimiter-separated plain text files.

### Naming Conventions
Files must be named using the pattern: `kcet_<year>_<round>.csv` or `kcet_<year>_<round>.txt`.
* *Examples:* `kcet_2024_r1.csv`, `kcet_2025_r2.csv`, `kcet_2025_extended.txt`.

Any file starting with `.` or named `placeholder.txt` is automatically ignored by the ingestion pipeline and the `KcetCutoffAdapter`.

---

## 2. Required Fields & Schema Contract

The ingestion pipeline maps raw data columns to the canonical cutoff schema. The following table defines the expected fields:

| Field Name | Type | Mandatory? | Notes / Allowed Values |
|---|---|---|---|
| `exam` | String | Optional | Defaults to `"KCET"` if not supplied in file. |
| `year` | Number | **YES** | Must be a 4-digit integer (e.g. `2024`, `2025`). |
| `round` | String/Number | **YES** | Counselling round (e.g. `1`, `2`, `"Extended"`). |
| `counsellingAuthority` | String | Optional | Defaults to `"KEA"`. |
| `collegeCode` | String | **YES** | Official KEA college code (e.g. `"E001"`). |
| `collegeName` | String | Optional | Normalized official college title (e.g. `"R. V. College of Engineering"`). |
| `courseCode` | String | **YES** | Official KEA course code (e.g. `"CS"`, `"EC"`). |
| `courseName` | String | Optional | Official raw course title (e.g. `"Computer Science and Engineering"`). |
| `category` | String | **YES** | Reservation category code (e.g. `"GM"`, `"2AG"`, `"3BG"`). |
| `quota` | String | Optional | Quota designation (e.g. `"Rural"`, `"Kannada Medium"`). Maps to `null` for general quota. |
| `openingRank` | Number | Optional | KEA opening rank. Set to `null` if empty or missing. |
| `closingRank` | Number | **YES** | Must be a positive integer > 0. |
| `state` | String | Optional | Defaults to `"Karnataka"`. |
| `collegeType` | String | Optional | Defaults to `"Government"`. (e.g. `"Government"`, `"Private"`, `"Aided"`). |
| `source` | String | Optional | Defaults to the raw file name. |

---

## 3. KEA Terminology Mapping

KEA publishes allotment cutoffs using shorthand codes for colleges, courses, categories, and quotas. The ingestion pipeline expects these to be mapped as follows:

### Categories
KEA reservation categories represent a combination of caste group (General/OBC/SC/ST) and sub-quota designations (General/Rural/Kannada Medium).
* **GM:** General Merit General
* **GMR:** General Merit Rural
* **GMK:** General Merit Kannada Medium
* **1G / 1R / 1K:** Category-1 General / Rural / Kannada Medium
* **2AG / 2AR / 2AK:** Category-2A General / Rural / Kannada Medium
* **2BG / 2BR / 2BK:** Category-2B General / Rural / Kannada Medium
* **3AG / 3AR / 3AK:** Category-3A General / Rural / Kannada Medium
* **3BG / 3BR / 3BK:** Category-3B General / Rural / Kannada Medium
* **SCG / SCR / SCK:** Scheduled Caste General / Rural / Kannada Medium
* **STG / STR / STK:** Scheduled Tribe General / Rural / Kannada Medium

*Rule:* The raw string must be normalized to uppercase. If any unrecognized category code is encountered in the file, it must be flagged for **manual verification** and logged in the data quality report.

### Quotas
Quotas represent distinct seat allocation frameworks.
* **General Quota:** Triggered when the category does not end in `R` or `K` (e.g. `GM`, `2AG`). Maps to `null` in the canonical database schema.
* **Rural Quota:** Triggered when the category ends in `R` (e.g. `GMR`, `2AR`).
* **Kannada Medium Quota:** Triggered when the category ends in `K` (e.g. `GMK`, `2AK`).
* **Hyd-Kar (HK) Quota:** Captured when a separate HK reservation code is present in the raw data.
* **Special Quotas:** Defence, Sports, NCC, Jammu & Kashmir (J&K) migrants, or physically disabled quotas must be mapped strictly to their raw names. If terminology is unknown, it must be marked as requiring **manual verification**.

---

## 4. Historical Coverage Requirements

To enable predictive time-series models for KCET cutoffs, a minimum of **4 comparable historical years** is required.
* **Minimum Target Years:** 2022, 2023, 2024, and 2025.
* **2026 Data:** Include 2026 cutoffs only when official rounds are complete and are structurally comparable (i.e. same round allocations, same seat categories) to the 2022–2025 dataset.

---

## 5. Validation Rules (ingest-kcet.ts)

The ingestion pipeline executes the following checks. Any row failing a validation rule is logged and discarded:

1. **Invalid Ranks:** `closingRank` must be a positive integer greater than 0. If `openingRank` is present, it must also be a positive integer, otherwise it is set to `null`.
2. **Missing College Code:** Rows with empty or missing `collegeCode` are discarded.
3. **Missing Course:** Rows with empty or missing `courseCode` are discarded.
4. **Invalid Year:** `year` must be a valid 4-digit number between 2000 and 2100.
5. **Invalid Round:** `round` must be a non-empty string or positive integer.
6. **Unknown Category/Quota:** Any code not matching KEA standard lists is recorded in the logs as requiring manual verification.
7. **Duplicate Keys & Conflicting Cutoffs:**
   * A duplicate key exists if more than one row has the same combination of `(year, round, collegeCode, courseCode, category, quota)`.
   * **Resolution Rule:** Keep the row with the **lowest closing rank** (conservative approach, ensuring the system does not overstate a student's admission probability). Flag and log the resolution in `kcet_data_quality_report.md`.

---

## 6. Example Raw-to-Clean Mapping

The following shows how raw rows map to the canonical schema (using placeholder values only):

### Raw Row Placeholder
```csv
exam,year,round,counsellingAuthority,collegeCode,collegeName,courseCode,courseName,category,quota,openingRank,closingRank,state,collegeType,source
KCET,YYYY,R_NUM,KEA,CODE_1,COLLEGE_A,CRS_1,COURSE_A,GM,null,1000,5000,Karnataka,Government,kcet_raw.csv
KCET,YYYY,R_NUM,KEA,CODE_1,COLLEGE_A,CRS_1,COURSE_A,GMR,Rural,null,6000,Karnataka,Government,kcet_raw.csv
```

### Clean Ingested Schema Output (MongoDB Document)
```json
[
  {
    "examCode": "KCET",
    "year": YYYY,
    "round": "R_NUM",
    "counsellingAuthority": "KEA",
    "collegeCode": "CODE_1",
    "collegeName": "COLLEGE_A",
    "courseCode": "CRS_1",
    "courseName": "COURSE_A",
    "category": "GM",
    "quota": null,
    "openingRank": 1000,
    "closingRank": 5000,
    "state": "Karnataka",
    "collegeType": "Government",
    "source": "kcet_raw.csv"
  },
  {
    "examCode": "KCET",
    "year": YYYY,
    "round": "R_NUM",
    "counsellingAuthority": "KEA",
    "collegeCode": "CODE_1",
    "collegeName": "COLLEGE_A",
    "courseCode": "CRS_1",
    "courseName": "COURSE_A",
    "category": "GMR",
    "quota": "Rural",
    "openingRank": null,
    "closingRank": 6000,
    "state": "Karnataka",
    "collegeType": "Government",
    "source": "kcet_raw.csv"
  }
]
```

---

## 7. Data Readiness

The KCET adapter's state is dynamically governed by the raw files located under `files/kcet/raw/`:

### READY_FOR_ELIGIBILITY
* **Condition:** At least one non-placeholder file (CSV or TXT) is placed in `files/kcet/raw/` and has been successfully run through `ingest-kcet.ts` to populate the MongoDB database.
* **Adapter State:** `isReadyForEligibility()` resolves to `true`. Ranks can be deterministic-matched.

### INSUFFICIENT_DATA
* **Condition:** The `files/kcet/raw/` directory is empty or contains only `placeholder.txt`.
* **Adapter State:** `isReadyForEligibility()` resolves to `false`, and `fetchHistoricalCutoffs()` immediately returns `[]` without querying the database, causing predictions and eligibility lookups to fall back to `INSUFFICIENT_DATA` status.

---

## 8. Forecast Readiness

To train ML forecasting models (predicting future closing ranks):
* **Required Condition:** At least **4 continuous, comparable historical years** (e.g. 2022, 2023, 2024, and 2025) must be present in the clean dataset for the exact same `(exam, round, collegeCode, courseCode, category, quota)` structure.
* **Current Status:** `FORECAST_NOT_AVAILABLE` (as 0 real historical years are currently populated in `files/kcet/raw/`).
