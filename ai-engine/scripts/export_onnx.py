#!/usr/bin/env python3
"""
shrimpAI - Xuất mô hình PyTorch sang định dạng ONNX
Giúp NestJS / Node.js có thể chạy inference trực tiếp qua onnxruntime
"""

import sys
from pathlib import Path

def export_to_onnx():
    root_dir = Path(__file__).resolve().parent.parent
    weights_path = root_dir / "models" / "shrimp_model_best.pt"

    if not weights_path.exists():
        print(f"[LỖI] Không tìm thấy file trọng số tại: {weights_path}")
        print("Vui lòng chạy 'python scripts/train.py' trước để tạo model.")
        sys.exit(1)

    try:
        from ultralytics import YOLO
        print(f"📦 Đang nạp model: {weights_path}...")
        model = YOLO(str(weights_path))

        print("⚡ Đang xuất sang định dạng ONNX...")
        path = model.export(format="onnx", imgsz=224)
        print(f"✅ Đã xuất thành công: {path}")
    except Exception as e:
        print(f"[LỖI khi export]: {e}")
        sys.exit(1)

if __name__ == "__main__":
    export_to_onnx()
