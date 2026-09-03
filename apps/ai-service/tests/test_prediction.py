import pytest
from fastapi.testclient import TestClient
from main import app, get_ml_model
import os

client = TestClient(app)

def test_model_loading_kcet():
    # Test that get_ml_model loads KCET model without throwing errors
    model = get_ml_model("KCET")
    assert model is not None
    assert hasattr(model, "predict")

def test_model_loading_comedk():
    # Test that get_ml_model loads COMEDK model without throwing errors
    model = get_ml_model("COMEDK")
    assert model is not None
    assert hasattr(model, "predict")

def test_predict_endpoint_kcet():
    payload = {
        "exam": "KCET",
        "year": 2025,
        "round": 1,
        "college_code": "E001",
        "course_code": "CS",
        "category": "GM",
        "quota": "General",
        "college_type": "Government"
    }
    response = client.post("/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["exam"] == "KCET"
    assert isinstance(data["predictedClosingRank"], int)
    assert data["model"] == "random_forest"
    assert data["confidence"] is None

def test_predict_endpoint_comedk():
    payload = {
        "exam": "COMEDK",
        "year": 2025,
        "round": "Round 4",
        "college_code": "E001",
        "course_code": "CS - Computer Science and Engineering",
        "category": "GM"
    }
    response = client.post("/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["exam"] == "COMEDK"
    assert isinstance(data["predictedClosingRank"], int)
    assert data["model"] == "random_forest"
    assert data["confidence"] is None

def test_unsupported_exam():
    payload = {
        "exam": "JEE",
        "year": 2025,
        "round": 1,
        "college_code": "E001",
        "course_code": "CS",
        "category": "GM"
    }
    response = client.post("/predict", json=payload)
    assert response.status_code == 400
    assert "Unsupported exam" in response.json()["detail"]

def test_missing_model_file():
    # Test fallback error when a model file doesn't exist
    # Since we can mock get_ml_model to throw FileNotFoundError
    import main
    original_get_ml_model = main.get_ml_model
    try:
        main.get_ml_model = lambda exam: exec("raise(FileNotFoundError('Mock missing model'))")
        payload = {
            "exam": "KCET",
            "year": 2025,
            "round": 1,
            "college_code": "E001",
            "course_code": "CS",
            "category": "GM"
        }
        response = client.post("/predict", json=payload)
        assert response.status_code == 404 or response.status_code == 500
    finally:
        main.get_ml_model = original_get_ml_model
