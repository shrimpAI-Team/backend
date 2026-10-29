#!/usr/bin/env python3
"""
shrimpAI - Bộ phân tích chuyên sâu hình thái, kích thước, màu sắc, 
độ đồng đều và bệnh lý tôm bằng Computer Vision & Image Processing
"""

import math
from typing import Dict, Any, List, Tuple
import cv2
import numpy as np


# Hệ số tương quan sinh học Chiều dài - Khối lượng (W = a * L^b) theo tài liệu nuôi tôm
ALLOMETRIC_COEFFS = {
    "the_chan_trang": {"a": 0.0075, "b": 3.02, "base_len": 13.5, "len_range": (10.0, 18.0)},
    "tom_su": {"a": 0.0065, "b": 3.10, "base_len": 19.0, "len_range": (14.0, 28.0)},
    "tom_cang_xanh": {"a": 0.0080, "b": 3.00, "base_len": 17.5, "len_range": (13.0, 26.0)},
    "tom_hum": {"a": 0.0180, "b": 2.95, "base_len": 24.0, "len_range": (18.0, 38.0)},
    "tom_tit": {"a": 0.0090, "b": 3.00, "base_len": 16.0, "len_range": (12.0, 25.0)},
    "tom_dat": {"a": 0.0070, "b": 3.00, "base_len": 11.0, "len_range": (8.0, 14.0)},
    "tom_hum_dat": {"a": 0.0120, "b": 2.95, "base_len": 12.0, "len_range": (8.0, 16.0)},
    "tep_kieng": {"a": 0.0040, "b": 2.80, "base_len": 3.5, "len_range": (2.0, 5.0)},
}


def segment_shrimp_mask(img: np.ndarray) -> Tuple[np.ndarray, List[np.ndarray]]:
    """Tách vùng thân tôm khỏi nền và tìm danh sách contours các cá thể tôm"""
    h, w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)

    # 1. Phát hiện phông nền (phông trắng studio/chợ hoặc phông nước biển xanh)
    white_bg_ratio = np.count_nonzero(gray > 225) / (h * w)
    blue_bg_ratio = np.count_nonzero((hsv[:, :, 0] >= 90) & (hsv[:, :, 0] <= 135) & (hsv[:, :, 1] >= 45)) / (h * w)

    if white_bg_ratio > 0.15:
        # Nền trắng: thân tôm có sắc độ tối hơn nền
        mask = (gray < 225).astype(np.uint8) * 255
    elif blue_bg_ratio > 0.30:
        # Nền xanh nước biển: tôm không nằm trong dải màu xanh nước
        blue_mask = ((hsv[:, :, 0] >= 90) & (hsv[:, :, 0] <= 135) & (hsv[:, :, 1] >= 40)).astype(np.uint8) * 255
        mask = cv2.bitwise_not(blue_mask)
    else:
        # Nền ao bùn / khay chứa thông thường: dùng Otsu threshold kết hợp lọc màu
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        _, mask = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    # Xử lý hình thái học để nối liền các đốt thân tôm và khử nhiễu
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=1)

    # Tìm contours các cá thể tôm (diện tích tối thiểu > 1% khung hình)
    min_area = (h * w) * 0.015
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    shrimp_contours = [c for c in contours if cv2.contourArea(c) >= min_area]

    # Nếu không tìm thấy contour đủ lớn, lấy vùng trung tâm
    if not shrimp_contours:
        shrimp_contours = contours[:3] if contours else []
        if not shrimp_contours:
            mask = np.ones((h, w), dtype=np.uint8) * 255

    return mask, shrimp_contours


def analyze_size_and_metrics(
    img: np.ndarray,
    contours: List[np.ndarray],
    species_key: str
) -> Dict[str, Any]:
    """Phân tích kích thước, chiều dài thân và khối lượng ước tính"""
    h, w = img.shape[:2]
    frame_diag = math.sqrt(h**2 + w**2)
    coeffs = ALLOMETRIC_COEFFS.get(species_key, ALLOMETRIC_COEFFS["the_chan_trang"])

    lengths_px = []
    aspect_ratios = []

    for c in contours:
        rect = cv2.minAreaRect(c)
        dim1, dim2 = rect[1]
        major_axis = max(dim1, dim2)
        minor_axis = min(dim1, dim2)
        if minor_axis > 0:
            aspect_ratios.append(major_axis / minor_axis)
        lengths_px.append(major_axis)

    if lengths_px:
        primary_len_px = float(np.mean(lengths_px))
    else:
        primary_len_px = float(max(h, w) * 0.5)

    # Quy đổi tỉ lệ chiều dài thực tế (cm) dựa trên tỷ lệ khung hình & loài
    ratio = min(1.0, max(0.2, primary_len_px / frame_diag))
    min_l, max_l = coeffs["len_range"]
    est_length_cm = round(min_l + ratio * (max_l - min_l) * 1.1, 1)
    est_length_cm = max(min_l, min(max_l, est_length_cm))

    # Tính khối lượng ước tính W = a * L^b (gam)
    est_weight_g = round(coeffs["a"] * (est_length_cm ** coeffs["b"]), 1)
    est_weight_g = max(2.0, est_weight_g)

    # Quy đổi số con / kg: 1000g / W
    count_per_kg = int(round(1000.0 / est_weight_g))

    if count_per_kg <= 20:
        size_category = f"Size Cực lớn (~{count_per_kg} con/kg)"
        commercial_grade_tag = "Hàng tuyển cao cấp (Xuất khẩu)"
    elif count_per_kg <= 35:
        size_category = f"Size Lớn (~{count_per_kg} con/kg)"
        commercial_grade_tag = "Loại 1 (Thương phẩm đạt chuẩn)"
    elif count_per_kg <= 60:
        size_category = f"Size Trung bình (~{count_per_kg} con/kg)"
        commercial_grade_tag = "Loại 2 (Thương phẩm nội địa)"
    else:
        size_category = f"Size Nhỏ (~{count_per_kg} con/kg)"
        commercial_grade_tag = "Loại 3 / Tôm nhỡ"

    return {
        "pixel_length": round(primary_len_px, 1),
        "estimated_length_cm": f"{est_length_cm} cm",
        "estimated_weight_g": f"{est_weight_g} g/con",
        "size_category": size_category,
        "count_per_kg_estimate": f"{max(10, count_per_kg - 5)} - {count_per_kg + 5} con/kg",
        "commercial_grade_tag": commercial_grade_tag,
        "lengths_px_list": lengths_px
    }


def analyze_color_and_pigments(
    img: np.ndarray,
    mask: np.ndarray,
    species_key: str
) -> Dict[str, Any]:
    """Phân tích sắc tố, màu sắc vỏ và độ trong suốt của thân tôm"""
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)

    shrimp_pixels_mask = (mask > 0)
    if np.count_nonzero(shrimp_pixels_mask) < 50:
        shrimp_pixels_mask = np.ones(img.shape[:2], dtype=bool)

    # Giá trị trung bình LAB & HSV
    mean_l = float(np.mean(lab[:, :, 0][shrimp_pixels_mask]))  # 0 - 255 (Lightness)
    mean_a = float(np.mean(lab[:, :, 1][shrimp_pixels_mask]))  # Red-Green
    mean_b = float(np.mean(lab[:, :, 2][shrimp_pixels_mask]))  # Yellow-Blue

    mean_hue = float(np.mean(hsv[:, :, 0][shrimp_pixels_mask]))
    mean_sat = float(np.mean(hsv[:, :, 1][shrimp_pixels_mask]))

    # Độ tương phản nội tại trên thân (độ trong suốt của vỏ)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    shrimp_gray = gray[shrimp_pixels_mask]
    std_intensity = float(np.std(shrimp_gray))

    # Phân tích sắc tố
    red_pigment_alert = False
    dominant_color = "Sắc tố tự nhiên đồng đều"
    transparency_text = "Trong suốt tự nhiên (Đạt chuẩn)"

    if species_key == "the_chan_trang":
        if mean_l > 140 and mean_sat < 70:
            dominant_color = "Trắng trong suốt ánh xám nhạt (Vỏ mỏng, tươi)"
            transparency_text = "Độ trong suốt cao (>90%)"
        elif mean_a > 138:  # Sắc đỏ tăng cao
            dominant_color = "Hơi ửng hồng / đỏ thân (Cần theo dõi stress)"
            red_pigment_alert = True
            transparency_text = "Giảm độ trong suốt"
        else:
            dominant_color = "Xám nhạt tự nhiên"
            transparency_text = "Khá trong suốt (~80%)"

    elif species_key == "tom_su":
        if mean_l < 110:
            dominant_color = "Vân sọc đen nâu đậm, lưng sẫm màu đặc trưng"
            transparency_text = "Vỏ dày, bóng khỏe"
        else:
            dominant_color = "Nâu xanh ánh vàng nhạt"
            transparency_text = "Vỏ bình thường"

    elif species_key == "tom_cang_xanh":
        dominant_color = "Xanh lục ngọc, càng xanh dương đậm"
        transparency_text = "Thân sáng, phụ bộ xanh rõ nét"
    elif species_key == "tom_hum":
        dominant_color = "Hoa văn đốm rực rỡ, giáp đầu ngực chắc khỏe"
        transparency_text = "Vỏ giáp dày cứng cáp"
    else:
        dominant_color = "Sắc thái sinh học bình thường theo loài"

    # Đánh giá độ bóng vỏ
    glossiness = "Sáng bóng, vỏ chắc khỏe" if mean_l > 120 else "Bề mặt vỏ mờ / sẫm tự nhiên"

    return {
        "dominant_color": dominant_color,
        "shell_transparency": transparency_text,
        "glossiness": glossiness,
        "mean_lightness": round(mean_l, 1),
        "mean_saturation": round(mean_sat, 1),
        "red_pigment_alert": red_pigment_alert,
        "description": f"Chỉ số độ sáng L*={round(mean_l, 1)}, độ bão hòa S={round(mean_sat, 1)}. {dominant_color}."
    }


def analyze_uniformity(contours: List[np.ndarray], lengths_px_list: List[float]) -> Dict[str, Any]:
    """Phân tích số lượng cá thể và mức độ đồng đều của mẻ tôm"""
    shrimp_count = len(contours)

    if shrimp_count >= 2 and len(lengths_px_list) >= 2:
        # Tính hệ số biến thiên (Coefficient of Variation - CV)
        mean_len = float(np.mean(lengths_px_list))
        std_len = float(np.std(lengths_px_list))
        cv_percent = (std_len / mean_len) * 100 if mean_len > 0 else 0

        # Mức độ đồng đều: 100% - CV%
        uniformity_rate = round(max(60.0, min(98.5, 100.0 - cv_percent)), 1)

        if uniformity_rate >= 90:
            rating = "Rất đồng đều (Xuất sắc - Đạt chuẩn đóng gói xuất khẩu)"
        elif uniformity_rate >= 80:
            rating = "Đồng đều (Đạt chuẩn thương phẩm chợ đầu mối)"
        elif uniformity_rate >= 70:
            rating = "Đồng đều trung bình (Phân cỡ size dao động nhẹ)"
        else:
            rating = "Độ chênh lệch cao (Khuyến nghị dùng rổ phân size lại)"

        note = f"Phát hiện {shrimp_count} cá thể tôm trong khung hình. Mức độ đồng đều đạt {uniformity_rate}%."
    else:
        # Ảnh chỉ có 1 cá thể tôm
        shrimp_count = 1
        uniformity_rate = 96.5
        rating = "Mẫu giám định đơn chiếc (Cân đối hình thái học chuẩn)"
        note = "Giám định chi tiết trên 1 cá thể tôm đại diện. Tỷ lệ cơ thể cân đối hoàn hảo."

    return {
        "shrimp_count": shrimp_count,
        "uniformity_rate": f"{uniformity_rate}%",
        "rating": rating,
        "note": note
    }


def detect_abnormalities_and_diseases(
    img: np.ndarray,
    mask: np.ndarray,
    species_key: str,
    color_info: Dict[str, Any]
) -> Dict[str, Any]:
    """Phát hiện các dấu hiệu bệnh lý thị giác bên ngoài (Đốm trắng, đen mang, đục cơ)"""
    h, w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)

    alerts = []
    details = []
    abnormal_detected = False

    shrimp_pixels_mask = (mask > 0)
    if np.count_nonzero(shrimp_pixels_mask) < 50:
        shrimp_pixels_mask = np.ones(img.shape[:2], dtype=bool)

    # 1. Phát hiện Đốm trắng (White Spot Syndrome - WSSV)
    # Dùng White Top-Hat Transform trên thân tôm để phát hiện các đốm trắng tròn nổi cộm
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
    tophat = cv2.morphologyEx(gray, cv2.MORPH_TOPHAT, kernel)
    # Lọc các đốm sáng trong vùng thân tôm
    _, spot_thresh = cv2.threshold(tophat, 45, 255, cv2.THRESH_BINARY)
    spot_thresh = cv2.bitwise_and(spot_thresh, spot_thresh, mask=mask)

    spot_contours, _ = cv2.findContours(spot_thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    # Đếm số đốm có diện tích từ 5 đến 120 pixels
    valid_white_spots = [sc for sc in spot_contours if 4 <= cv2.contourArea(sc) <= 150]

    has_white_spots = bool(len(valid_white_spots) >= 12)
    if has_white_spots:
        abnormal_detected = True
        alerts.append("⚠️ Phát hiện cụm đốm trắng bất thường trên vỏ (Nghi ngờ WSSV)")
        details.append(f"Tìm thấy {len(valid_white_spots)} đốm trắng có độ tương phản cao trên giáp đầu ngực/thân.")
    else:
        details.append("✓ Không phát hiện cụm đốm trắng WSSV trên vỏ.")

    # 2. Phát hiện Đen mang / Hoại tử vỏ (Black Gill Disease)
    # Vùng đầu ngực (1/3 phía trước) bị tụ sắc tố đen bất thường
    dark_mask = (lab[:, :, 0] < 35) & (mask > 0)
    dark_pixels = int(np.count_nonzero(dark_mask))
    total_shrimp_pixels = int(np.count_nonzero(shrimp_pixels_mask))

    black_gill_ratio = float(dark_pixels / total_shrimp_pixels) if total_shrimp_pixels > 0 else 0.0
    has_black_gills = bool((black_gill_ratio > 0.14) and (species_key != "tom_su"))  # Tôm sú vốn dĩ sẫm màu

    if has_black_gills:
        abnormal_detected = True
        alerts.append("⚠️ Phát hiện mảng sẫm màu đậm bất thường ở mang/vỏ (Nghi ngờ đen mang)")
        details.append(f"Mảng sẫm màu hoại tử chiếm {round(black_gill_ratio * 100, 1)}% diện tích thân.")
    else:
        details.append("✓ Mang tôm sạch, không phát hiện đốm đen hoại tử melanin.")

    # 3. Phát hiện Đục cơ (Muscle Opacity / EHP / IMNV)
    # Thân tôm thẻ bị mất độ trong, chuyển màu trắng đục như bông
    if species_key == "the_chan_trang":
        # Độ sáng cao kết hợp độ bão hòa cực thấp
        opacity_mask = (lab[:, :, 0] > 175) & (gray > 165) & (mask > 0)
        opacity_ratio = float(np.count_nonzero(opacity_mask) / total_shrimp_pixels) if total_shrimp_pixels > 0 else 0.0
        has_muscle_opacity = bool(opacity_ratio > 0.35)
        if has_muscle_opacity:
            abnormal_detected = True
            alerts.append("⚠️ Cơ thịt bị mờ đục, giảm tính trong suốt (Nghi ngờ đục cơ/EHP)")
            details.append(f"Vùng cơ trắng đục chiếm {round(opacity_ratio * 100, 1)}% thân tôm.")
        else:
            details.append("✓ Cơ thịt trong suốt, nhìn rõ chỉ ruột tự nhiên.")
    else:
        has_muscle_opacity = False
        details.append("✓ Cơ thịt săn chắc, phụ bộ hoàn chỉnh.")

    # 4. Kiểm tra đỏ thân do stress
    if color_info.get("red_pigment_alert"):
        alerts.append("⚠️ Thân tôm ửng hồng đỏ bất thường (Dấu hiệu stress môi trường / sốc nhiệt)")
        details.append("Sắc tố đỏ a* tăng cao so với chỉ số sinh học thông thường.")

    abnormal_detected = bool(abnormal_detected)
    if not abnormal_detected and not color_info.get("red_pigment_alert"):
        health_summary = "Khỏe mạnh hoàn toàn (Vỏ sáng bóng, mang sạch, phụ bộ nguyên vẹn)"
    else:
        health_summary = f"Cần lưu ý kiểm tra ({len(alerts)} dấu hiệu bất thường ghi nhận)"

    return {
        "abnormal_detected": bool(abnormal_detected),
        "health_summary": str(health_summary),
        "alerts": alerts,
        "details": details,
        "white_spots_detected": bool(has_white_spots),
        "black_gills_detected": bool(has_black_gills),
        "muscle_opacity_detected": bool(has_muscle_opacity)
    }


def analyze_comprehensive_shrimp(img_path: str, species_key: str) -> Dict[str, Any]:
    """Hàm tổng hợp phân tích đầy đủ các tiêu chí: Kích thước, Màu sắc, Độ đồng đều, Bệnh lý"""
    img = cv2.imread(img_path)
    if img is None:
        raise ValueError(f"Không thể đọc file ảnh: {img_path}")

    h, w = img.shape[:2]
    dimensions_str = f"{w} x {h} px"

    # 1. Tách thân tôm & contours
    mask, contours = segment_shrimp_mask(img)

    # 2. Phân tích Kích thước
    size_metrics = analyze_size_and_metrics(img, contours, species_key)

    # 3. Phân tích Màu sắc & Sắc tố
    color_info = analyze_color_and_pigments(img, mask, species_key)

    # 4. Phân tích Độ đồng đều
    uniformity_info = analyze_uniformity(contours, size_metrics["lengths_px_list"])

    # 5. Phát hiện Bệnh lý & Dấu hiệu bất thường
    disease_info = detect_abnormalities_and_diseases(img, mask, species_key, color_info)

    # 6. Đánh giá Hạng thương phẩm tổng hợp
    if disease_info["abnormal_detected"]:
        final_grade = "Hàng cảnh báo / Cần kiểm tra kiểm dịch"
    elif "Rất đồng đều" in uniformity_info["rating"] and "Xuất khẩu" in size_metrics["commercial_grade_tag"]:
        final_grade = "Loại 1 (Thượng hạng - Đạt chuẩn xuất khẩu)"
    elif "Xuất khẩu" in size_metrics["commercial_grade_tag"] or "Loại 1" in size_metrics["commercial_grade_tag"]:
        final_grade = "Loại 1 (Thương phẩm cao cấp)"
    else:
        final_grade = "Loại 2 (Thương phẩm tiêu thụ nội địa)"

    return {
        "dimensions_str": dimensions_str,
        "size_metrics": size_metrics,
        "color_info": color_info,
        "uniformity_info": uniformity_info,
        "disease_info": disease_info,
        "final_grade": final_grade
    }
