#!/usr/bin/env python3
"""
shrimpAI - FastAPI Microservice Server
Nhận request phân tích ảnh tôm từ NestJS và trả về kết quả thời gian thực
"""

import os
import shutil
import tempfile
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from scripts.predict import (
    ANALYSIS_CONTRACT_VERSION, SPECIES_METADATA, get_confidence_threshold, get_model_path, load_model, predict_shrimp,
)
from scripts.presence_gate import load_gate

app = FastAPI(
    title="shrimpAI Vision Engine",
    description="Microservice phân tích và nhận dạng giống tôm bằng AI",
    version="1.0.0"
)

# Cho phép CORS kết nối từ NestJS / Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    try:
        _, version = load_model()
        _, gate_metadata = load_gate(version)
        threshold = get_confidence_threshold()
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Mô hình AI chưa sẵn sàng.") from exc
    return {
        "status": "online",
        "service": "shrimpAI Vision Engine",
        "has_trained_model": True,
        "model_file": get_model_path().name,
        "model_version": version,
        "confidence_threshold": threshold,
        "capabilities": ["species_classification", "initial_shrimp_presence_filter"],
        "presence_gate_version": gate_metadata['artifact_sha256'][:12],
        "analysis_contract_version": ANALYSIS_CONTRACT_VERSION,
    }

@app.get("/species")
def get_supported_species():
    """Trả về danh mục các loài tôm mà mô hình hỗ trợ"""
    return {
        "success": True,
        "count": len(SPECIES_METADATA),
        "data": SPECIES_METADATA
    }

@app.post("/predict")
def predict_endpoint(file: UploadFile = File(...)):
    """API nhận file ảnh và trả về kết quả định danh giống tôm"""
    if file.content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(status_code=400, detail="File gửi lên phải là định dạng hình ảnh (JPG, PNG, WEBP).")

    # Lưu tạm file để phân tích
    suffix = Path(file.filename or '').suffix or ".jpg"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
        shutil.copyfileobj(file.file, temp_file)
        temp_path = temp_file.name

    try:
        result = predict_shrimp(temp_path)
        if not result.get('success'):
            raise HTTPException(status_code=503, detail=result.get('error', 'Không thể phân tích ảnh.'))
        return result
    finally:
        # Xóa file tạm sau khi dự đoán
        if os.path.exists(temp_path):
            os.remove(temp_path)

if __name__ == "__main__":
    import uvicorn
    print("🚀 Đang khởi động shrimpAI Vision Engine tại http://127.0.0.1:8000...")
    uvicorn.run(app, host="127.0.0.1", port=8000)
