class AdmissionPredictor:
    """
    Computes a deterministic rank-to-cutoff recommendation fit score (1-99)
    and portfolio category (Safe / Moderate / Ambitious / Reach).
    
    NOTE: This is a rule-based rank-ratio heuristic score for preference sorting,
    NOT a trained machine learning probability model.
    """
    def predict(self, student_rank: int, closing_rank: int) -> dict:
        if closing_rank <= 0 or student_rank <= 0:
            return {
                "probability_percent": 5,
                "recommendation_score": 5,
                "band": "Reach",
                "portfolio_classification": "INSUFFICIENT_DATA",
                "confidence": "low"
            }

        ratio = student_rank / closing_rank

        if ratio <= 0.80:
            score = min(98, 85 + (0.80 - ratio) * 40)
            band = "Safe"
            classification = "SAFE"
        elif ratio <= 1.05:
            score = 50 + ((1.05 - ratio) / 0.25) * 35
            band = "Moderate"
            classification = "TARGET"
        elif ratio <= 1.30:
            score = 15 + ((1.30 - ratio) / 0.25) * 35
            band = "Ambitious"
            classification = "DREAM"
        else:
            score = max(2, 15 - (ratio - 1.30) * 30)
            band = "Reach"
            classification = "OUTSIDE_HISTORICAL_RANGE"

        return {
            "probability_percent": round(score, 1), # Backwards compatibility alias for recommendation_score
            "recommendation_score": round(score, 1),
            "band": band,
            "portfolio_classification": classification,
            "confidence": "high" if closing_rank > 0 else "medium"
        }
