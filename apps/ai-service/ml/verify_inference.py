import os
import pandas as pd
import joblib

# Paths
MODELS_DIR = r"c:\Users\sindh\Downloads\career-compass-ai\career-compass-ai\apps\ai-service\ml\models"
KCET_MODEL_PATH = os.path.join(MODELS_DIR, "kcet_best_model.joblib")
COMEDK_MODEL_PATH = os.path.join(MODELS_DIR, "comedk_best_model.joblib")

def verify_kcet():
    print("\n--- Testing KCET Inference ---")
    if not os.path.exists(KCET_MODEL_PATH):
        print(f"KCET model not found at: {KCET_MODEL_PATH}")
        return

    # Load model
    print(f"Loading KCET model from: {KCET_MODEL_PATH}")
    model = joblib.load(KCET_MODEL_PATH)

    # Prepare dummy input DataFrame matching trained columns
    sample_data = pd.DataFrame([{
        'year': 2025,
        'round': 1,
        'collegeCode': 'E001',
        'courseCode': 'CS',
        'category': 'GM',
        'quota': 'General',
        'collegeType': 'Government'
    }])

    # Predict
    predicted_rank = model.predict(sample_data)[0]
    print(f"Sample Input:\n{sample_data.to_string(index=False)}")
    print(f"Predicted Closing Rank: {predicted_rank:.2f}")

def verify_comedk():
    print("\n--- Testing COMEDK Inference ---")
    if not os.path.exists(COMEDK_MODEL_PATH):
        print(f"COMEDK model not found at: {COMEDK_MODEL_PATH}")
        return

    # Load model
    print(f"Loading COMEDK model from: {COMEDK_MODEL_PATH}")
    model = joblib.load(COMEDK_MODEL_PATH)

    # Prepare dummy input DataFrame matching trained columns
    sample_data = pd.DataFrame([{
        'year': 2025,
        'round': 'Round 4',
        'college_code': 'E001',
        'course_normalized': 'CS - Computer Science and Engineering',
        'seat_category': 'GM'
    }])

    # Predict
    predicted_rank = model.predict(sample_data)[0]
    print(f"Sample Input:\n{sample_data.to_string(index=False)}")
    print(f"Predicted Closing Rank: {predicted_rank:.2f}")

def main():
    verify_kcet()
    verify_comedk()

if __name__ == "__main__":
    main()
