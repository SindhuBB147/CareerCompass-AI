import math

class AdmissionPredictor:
    """Predicts admission probability percentage and probability band based on rank & cutoff."""
    def predict(self, student_rank: int, closing_rank: int) -> dict:
        if closing_rank <= 0:
            return {"probability_percent": 5, "band": "Reach", "confidence": "low"}

        ratio = student_rank / closing_rank

        if ratio <= 0.7:
            percent = min(98, 85 + (0.7 - ratio) * 40)
            band = "Safe"
        elif ratio <= 0.95:
            percent = 50 + ((0.95 - ratio) / 0.25) * 35
            band = "Moderate"
        elif ratio <= 1.15:
            percent = 15 + ((1.15 - ratio) / 0.2) * 35
            band = "Ambitious"
        else:
            percent = max(2, 15 - (ratio - 1.15) * 30)
            band = "Reach"

        return {
            "probability_percent": round(percent, 1),
            "band": band,
            "confidence": "high" if closing_rank > 0 else "medium"
        }
