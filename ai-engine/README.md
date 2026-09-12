# 🦐 shrimpAI - AI Vision & Training Engine

Thư mục này chứa toàn bộ mã nguồn phục vụ **thu thập dữ liệu, huấn luyện (Train AI)** và **phục vụ dự đoán (Inference)** các giống tôm cho dự án shrimpAI.

---

## 📁 Cấu trúc thư mục

```text
backend/ai-engine/
├── datasets/                      # Dữ liệu ảnh các giống tôm
│   ├── train/                     # Tập huấn luyện (~80% số ảnh)
│   │   ├── the_chan_trang/        # Ảnh Tôm thẻ chân trắng (L. vannamei)
│   │   ├── tom_su/                # Ảnh Tôm sú (P. monodon)
│   │   └── tom_cang_xanh/         # Ảnh Tôm càng xanh (M. rosenbergii)
│   └── val/                       # Tập kiểm thử/đánh giá (~20% số ảnh)
│       ├── the_chan_trang/
│       ├── tom_su/
│       └── tom_cang_xanh/
├── models/                        # Chứa trọng số mô hình sau khi train
│   └── shrimp_model_best.pt       # Model tốt nhất xuất ra từ quá trình huấn luyện
├── scripts/
│   ├── train.py                   # Script tự động huấn luyện YOLOv8 classification
│   ├── predict.py                 # Script test nhận dạng trên 1 ảnh bất kỳ
│   └── export_onnx.py             # Xuất sang định dạng ONNX
├── requirements.txt               # Thư viện Python cần cài đặt
└── server.py                      # FastAPI microservice (cổng 8000) kết nối với NestJS
```

---

## 🚀 Hướng dẫn bắt đầu nhanh (Quickstart)

### Bước 1: Khởi tạo môi trường ảo Python
Mở terminal tại thư mục `backend/ai-engine/`:

```bash
# Di chuyển vào thư mục ai-engine
cd d:\shrimpAI\backend\ai-engine

# Tạo môi trường ảo (venv)
python -m venv venv

# Kích hoạt môi trường ảo (Windows PowerShell):
.\venv\Scripts\Activate.ps1
# Hoặc trên Windows Command Prompt (CMD):
# .\venv\Scripts\activate.bat

# Cài đặt các thư viện cần thiết
pip install -r requirements.txt
```

---

### Bước 2: Chuẩn bị dữ liệu hình ảnh (Dataset)
- Copy ảnh tôm tương ứng vào các thư mục:
  - `datasets/train/the_chan_trang/`: khoảng 30 - 100 ảnh tôm thẻ chân trắng.
  - `datasets/train/tom_su/`: khoảng 30 - 100 ảnh tôm sú.
  - `datasets/train/tom_cang_xanh/`: khoảng 30 - 100 ảnh tôm càng xanh.
- Đặt khoảng 10 - 20 ảnh mỗi loại vào thư mục `datasets/val/` để đánh giá độ chính xác.

> **Mẹo**: Nếu chưa có đủ ảnh thật ngay, bạn có thể copy vài ảnh mẫu vào các thư mục trên để chạy thử luồng code trước.

---

### Bước 3: Chạy huấn luyện (Train Model)

Chạy lệnh:
```bash
python scripts/train.py --epochs 30 --batch 16
```
- Quá trình huấn luyện sẽ tải trọng số nền `yolov8n-cls.pt` (siêu nhẹ, chỉ vài MB) và tinh chỉnh (fine-tune) theo đặc trưng các loài tôm của bạn.
- Khi hoàn tất, model tốt nhất sẽ tự động được lưu vào: `models/shrimp_model_best.pt`.

---

### Bước 4: Kiểm thử nhận diện trên 1 ảnh bất kỳ (Predict)

```bash
python scripts/predict.py duong_dan_anh_tom.jpg
```
Kết quả trả về định dạng JSON:
```json
{
  "success": true,
  "species": "Tôm thẻ chân trắng",
  "scientific_name": "Litopenaeus vannamei",
  "confidence": 97.4,
  "size_estimate": "25 - 35 con/kg",
  "commercial_grade": "Loại 1 (Đạt chuẩn thương phẩm)"
}
```

---

### Bước 5: Chạy FastAPI Microservice kết nối với NestJS

Chạy server tại cổng `8000`:
```bash
python server.py
```
- API sẽ lắng nghe tại: `http://127.0.0.1:8000`
- Tài liệu API Swagger UI trực quan: `http://127.0.0.1:8000/docs`
- Endpoint nhận diện: `POST http://127.0.0.1:8000/predict` (nhận file `multipart/form-data`)
