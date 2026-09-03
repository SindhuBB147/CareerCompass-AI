# CareerCompass AI — Multi-Criteria College Recommendation Model

**Project:** CareerCompass AI  
**Date:** August 16, 2026  
**Document:** `docs/RECOMMENDATION_MODEL.md`  
**Status:** PRODUCTION SPECIFICATION

---

## 1. Mathematical Formulation

The recommendation engine ranks eligible colleges and courses for a student profile $P$ using a composite multi-criteria utility score $S_{\text{total}}(c, P) \in [1, 99]$, where $c$ represents a college-course candidate pair.

$$S_{\text{total}}(c, P) = \sum_{i \in K} w_i \cdot S_i(c, P)$$

Where $K = \{\text{eligibility}, \text{branchMatch}, \text{location}, \text{budget}, \text{placement}, \text{collegeQuality}, \text{roi}\}$ and $\sum_{i \in K} w_i = 1.00$.

---

## 2. Configurable Weight Configuration

Weights are defined as configurable constants in `prediction-math.util.ts` and can be adjusted per tenant or risk profile:

| Component Score ($S_i$) | Variable | Weight ($w_i$) | Primary Data Source |
|---|---|---|---|
| **Eligibility & Portfolio Fit** | `w_eligibility` | **0.30** | Cutoff closing rank & student rank ratio ($r$) |
| **Branch / Course Match** | `w_branch` | **0.20** | User preferred branch selections |
| **Location Match** | `w_location` | **0.15** | User preferred city/district/state |
| **Budget Fit** | `w_budget` | **0.10** | Annual fee vs user max budget filter |
| **Placement Package Strength** | `w_placement` | **0.10** | College median placement LPA |
| **Institutional Quality** | `w_quality` | **0.10** | NIRF rank accreditation category |
| **Financial ROI** | `w_roi` | **0.05** | Median placement LPA / annual fee ratio |

---

## 3. Sub-Score Formulations

### 3.1 Eligibility Score ($S_{\text{eligibility}} \in [1, 100]$)
Based on rank ratio $r = R_{\text{student}} / C_{\text{hist}}$:
* If $r \le 0.55$: $S = 95 + \min(5, (0.55 - r) \times 10)$
* If $0.55 < r \le 0.80$ (SAFE): $S = 80 + \frac{0.80 - r}{0.25} \times 15$
* If $0.80 < r \le 1.05$ (TARGET): $S = 50 + \frac{1.05 - r}{0.25} \times 30$
* If $1.05 < r \le 1.30$ (DREAM): $S = 15 + \frac{1.30 - r}{0.25} \times 35$
* If $r > 1.30$: $S = \max(1, 15 - (r - 1.30) \times 10)$
* If $C_{\text{hist}}$ missing ($N_{\text{obs}} = 0$): $S = 10$ (`INSUFFICIENT_DATA`)

### 3.2 Branch Match Score ($S_{\text{branch}} \in [10, 100]$)
* Exact match to user 1st preferred branch: $100$
* Exact match to 2nd/3rd preferred branch: $85$
* Same engineering discipline (e.g. ECE vs CSE): $65$
* General engineering fallback: $40$

### 3.3 Location Score ($S_{\text{location}} \in [20, 100]$)
* Exact match to user preferred city: $100$
* Same district / metropolitan educational hub (e.g. Bengaluru): $85$
* Same state (Karnataka): $70$
* Other states: $40$

### 3.4 Budget Score ($S_{\text{budget}} \in [10, 100]$)
Given annual fee $F$ and max user budget $B$:
* If $B$ unspecified or $F \le 0.8 B$: $100$
* If $0.8 B < F \le B$: $85$
* If $B < F \le 1.2 B$: $50$
* If $F > 1.2 B$: $20$

### 3.5 Placement Score ($S_{\text{placement}} \in [10, 100]$)
Based on median package $L$ (LPA):
* $L \ge 12 \text{ LPA} \implies 100$
* $8 \le L < 12 \text{ LPA} \implies 85$
* $5 \le L < 8 \text{ LPA} \implies 70$
* $L < 5 \text{ LPA} \implies 40$
* Missing placement data: $30$

### 3.6 Quality Score ($S_{\text{quality}} \in [10, 100]$)
Based on NIRF Rank $N$:
* $N \le 50 \implies 100$
* $50 < N \le 100 \implies 85$
* $100 < N \le 200 \implies 70$
* $N > 200$ or unranked: $40$

### 3.7 ROI Score ($S_{\text{roi}} \in [10, 100]$)
Ratio $R_{\text{roi}} = L / (F / 100,000)$:
* $R_{\text{roi}} \ge 4.0 \implies 100$
* $2.5 \le R_{\text{roi}} < 4.0 \implies 85$
* $1.5 \le R_{\text{roi}} < 2.5 \implies 70$
* $R_{\text{roi}} < 1.5 \implies 40$

---

## 4. Score Breakdown & Transparency

Each recommendation result exposes a structured `scoreBreakdown` object alongside the composite `recommendationFitScore`:

```json
{
  "collegeId": "E001",
  "collegeName": "Acharya Institute of Technology",
  "courseName": "Computer Science & Engineering",
  "portfolioClassification": "SAFE",
  "recommendationFitScore": 88,
  "scoreBreakdown": {
    "eligibility": 92,
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
    "Located in your target city (Bengaluru)."
  ]
}
```
