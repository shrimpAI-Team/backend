# 🦐 shrimpAI - AI Vision & Training Engine

> **Segmentation (phần 4):** Xem [SEGMENTATION_GUIDE.md](SEGMENTATION_GUIDE.md).
> Đã có checkpoint segmentation thử nghiệm và nhãn mask cho cả 8 nhóm; chưa bật đếm trong ứng dụng.
> Nhãn 8 nhóm và quy trình hiện tại: [SEGMENTATION_EIGHT_GROUPS.md](SEGMENTATION_EIGHT_GROUPS.md).
> Luồng nhận diện loại tôm hiện tại xem [INFERENCE_OPERATIONS.md](INFERENCE_OPERATIONS.md).

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
│   ├── crawl_shrimp.py            # Script tự động cào và mở rộng dataset ảnh các giống tôm
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

### Bước 2: Thu thập và chuẩn bị dữ liệu hình ảnh (Dataset)

Bạn có thể cào tự động hàng trăm ảnh các giống tôm chỉ với 1 dòng lệnh bằng công cụ có sẵn:

```bash
# Xem danh sách các giống tôm hỗ trợ sẵn:
python scripts/crawl_shrimp.py --list

# Cào tự động 200 ảnh mới cho TẤT CẢ các giống tôm (mặc định 200 ảnh):
python scripts/crawl_shrimp.py --species all

# Chế độ thông minh: Chỉ cào bù cho đủ mốc 200 ảnh (nếu đã có 100 ảnh thì chỉ cào thêm 100 ảnh nữa):
python scripts/crawl_shrimp.py --species all --target-total 200

# Hoặc chỉ cào bù cho một số giống cụ thể:
python scripts/crawl_shrimp.py --species tom_su,tom_cang_xanh --target-total 200
```

> **Cơ chế tự động của tool:**
> - Tự động tải ảnh sinh học chuẩn từ **iNaturalist** và **Wikimedia Commons**.
> - Tự động khử ảnh hỏng, lọc ảnh trùng lặp (MD5 hash).
> - Tự động chia tỉ lệ **80% Train** vào `datasets/train/` và **20% Val** vào `datasets/val/`.

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
  "size_estimate": "Chưa đánh giá",
  "commercial_grade": "Chưa đánh giá"
}
```

Ví dụ trên chỉ minh họa phân loại giống. Model phân loại không đo kích thước,
khối lượng hay cấp thương phẩm; các trường chưa có mô hình/hiệu chuẩn sẽ giữ
`Chưa đánh giá`. Checkpoint segmentation thử nghiệm được lưu riêng và chưa tự
tham gia endpoint `/predict`.

---

### Bước 5: Chạy FastAPI Microservice kết nối với NestJS

Chạy server tại cổng `8000`:
```bash
python server.py
```
- API sẽ lắng nghe tại: `http://127.0.0.1:8000`
- Tài liệu API Swagger UI trực quan: `http://127.0.0.1:8000/docs`
- Endpoint nhận diện: `POST http://127.0.0.1:8000/predict` (nhận file `multipart/form-data`)
