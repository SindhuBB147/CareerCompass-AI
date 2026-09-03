import os
import numpy as np
import pandas as pd
import joblib
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OrdinalEncoder, StandardScaler
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

# Paths
KCET_DATA_PATH = r"c:\Users\sindh\Downloads\career-compass-ai\files\kcet_cutoffs_clean.csv"
COMEDK_DATA_PATH = r"c:\Users\sindh\Downloads\career-compass-ai\files\comedk_cutoffs_clean.csv"
MODELS_DIR = r"c:\Users\sindh\Downloads\career-compass-ai\career-compass-ai\apps\ai-service\ml\models"

def prepare_directories():
    """Create directory for saved models if it doesn't exist."""
    os.makedirs(MODELS_DIR, exist_ok=True)
    print(f"Verified models directory: {MODELS_DIR}")

def train_and_evaluate_pipeline(name, df, feature_cols, target_col, categorical_cols, numeric_cols):
    print(f"\n=========================================")
    print(f" Training Pipeline for {name} Dataset")
    print(f"=========================================")
    
    # 1. Cleaning & Filtering
    # Drop rows where target is missing or <= 0
    df_clean = df.dropna(subset=[target_col]).copy()
    df_clean = df_clean[df_clean[target_col] > 0]
    
    X = df_clean[feature_cols]
    y = df_clean[target_col]
    
    print(f"Original shape: {df.shape}, Cleaned shape: {df_clean.shape}")
    print(f"Features: {feature_cols}")
    print(f"Target: {target_col}")

    # 2. Train/Test Split (80/20)
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    print(f"Train size: {X_train.shape[0]}, Test size: {X_test.shape[0]}")
    
    # 3. Feature Engineering Pipeline Setup
    categorical_transformer = Pipeline(steps=[
        ('imputer', SimpleImputer(strategy='constant', fill_value='missing')),
        ('encoder', OrdinalEncoder(handle_unknown='use_encoded_value', unknown_value=-1))
    ])
    
    numeric_transformer = Pipeline(steps=[
        ('imputer', SimpleImputer(strategy='median')),
        ('scaler', StandardScaler())
    ])
    
    preprocessor = ColumnTransformer(
        transformers=[
            ('num', numeric_transformer, numeric_cols),
            ('cat', categorical_transformer, categorical_cols)
        ])
    
    # Define models
    models = {
        "Linear Regression": LinearRegression(),
        "Random Forest": RandomForestRegressor(n_estimators=100, random_state=42, n_jobs=-1),
        "Gradient Boosting": GradientBoostingRegressor(n_estimators=100, random_state=42)
    }
    
    results = {}
    best_r2 = -float('inf')
    best_pipeline = None
    best_model_name = None
    
    # 4. Train, Evaluate & Compare
    for model_name, regressor in models.items():
        pipeline = Pipeline(steps=[
            ('preprocessor', preprocessor),
            ('regressor', regressor)
        ])
        
        # Train model
        pipeline.fit(X_train, y_train)
        
        # Predict on test
        y_pred = pipeline.predict(X_test)
        
        # Calculate metrics
        mae = mean_absolute_error(y_test, y_pred)
        rmse = np.sqrt(mean_squared_error(y_test, y_pred))
        r2 = r2_score(y_test, y_pred)
        
        results[model_name] = {
            "MAE": round(mae, 2),
            "RMSE": round(rmse, 2),
            "R2": round(r2, 4)
        }
        
        print(f"[{model_name}] MAE: {mae:.2f} | RMSE: {rmse:.2f} | R²: {r2:.4f}")
        
        # Track best model
        if r2 > best_r2:
            best_r2 = r2
            best_pipeline = pipeline
            best_model_name = model_name

    # 5. Output comparison table
    print("\nModel Comparison:")
    comparison_df = pd.DataFrame(results).T
    print(comparison_df)
    
    print(f"\n--> Selected Best Model: {best_model_name} (R² = {best_r2:.4f})")
    
    # 6. Save the best pipeline
    model_filename = f"{name.lower()}_best_model.joblib"
    model_path = os.path.join(MODELS_DIR, model_filename)
    joblib.dump(best_pipeline, model_path)
    print(f"Saved best pipeline to: {model_path}")
    
    return best_model_name, results

def main():
    prepare_directories()
    
    # --- KCET Pipeline ---
    if os.path.exists(KCET_DATA_PATH):
        df_kcet = pd.read_csv(KCET_DATA_PATH)
        # Select Features & Targets
        kcet_features = ['year', 'round', 'collegeCode', 'courseCode', 'category', 'quota', 'collegeType']
        kcet_target = 'closingRank'
        kcet_cat = ['collegeCode', 'courseCode', 'category', 'quota', 'collegeType']
        kcet_num = ['year', 'round']
        
        train_and_evaluate_pipeline(
            "KCET", df_kcet, kcet_features, kcet_target, kcet_cat, kcet_num
        )
    else:
        print(f"Error: KCET dataset not found at {KCET_DATA_PATH}")
        
    # --- COMEDK Pipeline ---
    if os.path.exists(COMEDK_DATA_PATH):
        df_comedk = pd.read_csv(COMEDK_DATA_PATH)
        # Select Features & Targets
        comedk_features = ['year', 'round', 'college_code', 'course_normalized', 'seat_category']
        comedk_target = 'closing_rank'
        comedk_cat = ['round', 'college_code', 'course_normalized', 'seat_category']
        comedk_num = ['year']
        
        train_and_evaluate_pipeline(
            "COMEDK", df_comedk, comedk_features, comedk_target, comedk_cat, comedk_num
        )
    else:
        print(f"Error: COMEDK dataset not found at {COMEDK_DATA_PATH}")

if __name__ == "__main__":
    main()
