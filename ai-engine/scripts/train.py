#!/usr/bin/env python3
"""
shrimpAI - Kịch bản huấn luyện mô hình nhận dạng giống tôm
Sử dụng YOLOv8 Classification (Ultralytics) hoặc PyTorch
"""

import os
import sys
import shutil
from pathlib import Path

def train_shrimp_classifier(
    data_dir: str = None,
    epochs: int = 50,
    img_size: int = 224,
    batch_size: int = 16,
    base_model: str = "yolov8n-cls.pt",
    output_dir: str = None
):
    try:
        from ultralytics import YOLO
    except ImportError:
        print("[LỖI] Chưa cài đặt thư viện 'ultralytics'.")
        print("Vui lòng chạy lệnh: pip install -r ../requirements.txt")
        sys.exit(1)

    # Xác định đường dẫn gốc
    root_dir = Path(__file__).resolve().parent.parent
    if not data_dir:
        data_dir = str(root_dir / "datasets")
    if not output_dir:
        output_dir = str(root_dir / "models")

    os.makedirs(output_dir, exist_ok=True)

    print("=" * 60)
    print("🦐 BẮT ĐẦU HUẤN LUYỆN MÔ HÌNH PHÂN LOẠI GIỐNG TÔM (shrimpAI)")
    print("=" * 60)
    print(f"📁 Dataset Directory: {data_dir}")
    print(f"⚙️  Số Epochs: {epochs}")
    print(f"📐 Image Size: {img_size}x{img_size}")
    print(f"📦 Batch Size: {batch_size}")
    print(f"🧠 Base Model: {base_model}")
    print("-" * 60)

    # Kiểm tra xem có ảnh trong dataset không
    train_dir = Path(data_dir) / "train"
    if not train_dir.exists():
        print(f"[CẢNH BÁO] Không tìm thấy thư mục {train_dir}!")
        return

    # Khởi tạo mô hình
    model = YOLO(base_model)

    # Tiến hành huấn luyện
    print("🚀 Đang huấn luyện...")
    results = model.train(
        data=data_dir,
        epochs=epochs,
        imgsz=img_size,
        batch=batch_size,
        project=str(Path(output_dir) / "runs"),
        name="shrimp_training",
        exist_ok=True,
        verbose=True
    )

    # Tìm và sao chép model tốt nhất vào thư mục models/
    best_weights = Path(output_dir) / "runs" / "shrimp_training" / "weights" / "best.pt"
    target_weights = Path(output_dir) / "shrimp_model_best.pt"

    if best_weights.exists():
        shutil.copy(str(best_weights), str(target_weights))
        print("=" * 60)
        print("✅ HUẤN LUYỆN HOÀN TẤT THÀNH CÔNG!")
        print(f"💾 Trọng số tốt nhất đã được lưu tại: {target_weights}")
        print("=" * 60)
    else:
        print(f"⚠️ Đã hoàn thành huấn luyện, kiểm tra kết quả tại: {output_dir}/runs")

if __name__ == "__main__":
    # Nhận tham số từ dòng lệnh (nếu có)
    import argparse
    parser = argparse.ArgumentParser(description="Train shrimpAI Classifier")
    parser.add_argument("--epochs", type=int, default=30, help="Số epochs huấn luyện")
    parser.add_argument("--batch", type=int, default=16, help="Kích thước batch")
    parser.add_argument("--imgsz", type=int, default=224, help="Kích thước ảnh đầu vào")
    args = parser.parse_args()

    train_shrimp_classifier(epochs=args.epochs, batch_size=args.batch, img_size=args.imgsz)
