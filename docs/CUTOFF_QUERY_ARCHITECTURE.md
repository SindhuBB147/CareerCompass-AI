# Cutoff Query & Filtering Architecture

This document describes the unified data access, adapter pattern, and filtering architecture for entrance-exam historical cutoffs in CareerCompass AI.

---

## 1. Common Schema

The database representation of cutoffs is stored in MongoDB using the `Cutoff` schema (`apps/api/src/modules/cutoffs/models/cutoff.model.ts`). It handles the common cutoff data contract across all supported exams (COMEDK, KCET, JEE, NEET).

### Fields Specification

* **`collegeId` / `collegeCode`:** The canonical code or database reference identifying the institution (e.g. `E001`).
* **`courseId` / `courseCode`:** The canonical normalized code identifying the course branch (e.g. `CS`, `AI`, `EC`).
* **`examCode`:** The entrance exam associated with the cutoff (e.g. `COMEDK`, `KCET`, `JEE`, `NEET`).
* **`year`:** The admission cycle year (e.g. `2024`, `2025`).
* **`round`:** The counselling round (e.g. `1`, `2`, `"Extended Round"`, `"All Rounds"`).
* **`counsellingAuthority`:** Conducting organization (e.g. `"KEA"`, `"COMEDK"`, `"JoSAA"`, `"MCC"`).
* **`category`:** Category-specific seat reservation code normalized to uppercase (e.g., `GM`, `KKR`, `OBC`, `SC`, `ST`, `OPEN`).
* **`quota`:** Optional seat quota (e.g., `State Quota`, `All India Quota`, `General Quota`, `Kannada Medium`, `Rural`).
* **`openingRank`:** The opening rank for the given category/round combination (can be `null` if unavailable).
* **`closingRank`:** The closing rank for the given category/round combination.
* **`state`:** State abbreviation/name (e.g. `"Karnataka"`).
* **`collegeType`:** Institution management status (e.g. `"Private"`, `"Government"`, `"Aided"`).
* **`source`:** File or portal provenance indicating the official source.

---

## 2. Adapter Interface (`IExamCutoffAdapter`)

To maintain clean separation between platform core logic and exam-specific details, every entrance exam implements the `IExamCutoffAdapter` interface.

```typescript
export interface ExamCutoffQuery {
  collegeId?: string; 
  courseId?: string;  
  collegeCode?: string | null;
  courseCode?: string | null;
  examCode: string;
  category: string;
  quota?: string | null;
  year?: number | null;
  round?: number | string | null;
}

export interface ExamReadinessReport {
  examCode: string;
  realRows: number;
  years: number[];
  rounds: (string | number)[];
  categories: string[];
  quotas: string[];
  openingRankCoverage: number; // percentage (0-100)
  closingRankCoverage: number; // percentage (0-100)
}

export interface IExamCutoffAdapter {
  readonly examCode: string;
  isReadyForEligibility(): boolean;
  isReadyForML(): boolean;
  fetchHistoricalCutoffs(query: ExamCutoffQuery, cutoffModel: any): Promise<CutoffDocument[]>;
  getReadinessReport(cutoffModel: any): Promise<ExamReadinessReport>;
}
```

---

## 3. Strict Filtering Rules

To prevent broadening queries or returning incorrect historical years/rounds:
1. **Supplied Fields Only:** Filters must **only** be added to the Mongoose query if they are explicitly provided in the request query.
2. **Category Normalization:** Categories are always converted to uppercase (e.g., `gm` $\rightarrow$ `GM`) to ensure uniform match behavior.
3. **No Mismatch:** If a query specifies `year = 2024`, `round = 2`, and `quota = 'KKR'`, the adapter must **never** return other rounds, other years, or other quotas. If no match is found under those strict criteria, an empty array `[]` is returned.

---

## 4. Exam-Specific Adapter Behaviors

### COMEDK Adapter
* **Readiness:** Eligibility is active (`isReadyForEligibility() === true`). ML forecasting is disabled (`isReadyForML() === false`) due to insufficient comparable years (2024 represents "All Rounds" consolidated summary, while 2025 represents "Round 4").
* **Opening Ranks:** Always returns `null` because COMEDK official scans do not contain opening ranks.

### KCET Adapter
* **Readiness Lock:** Bypasses any database seeding fallback. It checks for the existence of official raw files in the `files/kcet/raw/` directory.
* **Empty Data / Insufficient Data:** If the `files/kcet/raw/` directory is empty or does not exist, `isReadyForEligibility()` returns `false`, and `fetchHistoricalCutoffs()` immediately returns `[]` without querying the database. This triggers a clean `INSUFFICIENT_DATA` response from the eligibility service.
* **Real Data Active:** Once a real KEA file is placed in the folder and ingested, the adapter switches to `isReadyForEligibility() === true` and processes queries normally.

### JEE Main (JoSAA) & NEET Adapters
* **Readiness:** Currently unready (`isReadyForEligibility() === false`).
* **Reporting:** Returns `realRows: 0` and empty metadata reports unless official datasets are ingested.

---

## 5. Data Provenance & Missing Fields

* **Opening Ranks:** Opening ranks are optional. If they are missing in the official scans/counselling records (e.g. COMEDK), they are stored and returned as `null`/`undefined`. They are **never** synthetically generated or fabricated.
* **Provenances:** Ingested documents preserve `source` fields identifying the raw scanned file name or registry entry (e.g. `"comedk_2025_r4.pdf"`) to allow auditability.
