#!/usr/bin/env python3
"""Identify shrimp groups and assess supported visual signs."""

import sys
import os
import json
import time
import hashlib
import math
import threading
from functools import lru_cache
from pathlib import Path
try:
    from .presence_gate import assess_presence
    from .species_adaptation import apply_adapter
    from .tiger_signs_v5 import MODEL_VERSION as TIGER_SIGNS_VERSION, classify_images
except ImportError:
    from presence_gate import assess_presence
    from species_adaptation import apply_adapter
    from tiger_signs_v5 import MODEL_VERSION as TIGER_SIGNS_VERSION, classify_images

# Serving requests must not trigger package installation or network retries.
os.environ.setdefault('YOLO_AUTOINSTALL', 'false')

# Đảm bảo in tiếng Việt chuẩn trên console Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Eight visual/commercial groups, not eight exact biological species.
SPECIES_METADATA = {
    "the_chan_trang": {
        "name": "Tôm thẻ chân trắng",
        "scientific_name": "Litopenaeus vannamei",
        "description": "Vỏ mỏng, trong suốt, chân bơi màu trắng hoặc hơi vàng nhạt.",
        "commercial_grade": "Loại 1 (Đạt chuẩn thương phẩm)",
    },
    "tom_su": {
        "name": "Tôm sú",
        "scientific_name": "Penaeus monodon",
        "description": "Vỏ dày, có các sọc vân đen vàng hoặc đen nâu đặc trưng trên lưng.",
        "commercial_grade": "Loại 1 (Xuất khẩu)",
    },
    "tom_cang_xanh": {
        "name": "Tôm càng xanh",
        "scientific_name": "Macrobrachium rosenbergii",
        "description": "Đặc trưng có đôi càng màu xanh dương dài, thân màu xanh lục hoặc xám nhạt.",
        "commercial_grade": "Đặc sản nước ngọt",
    },
    "tom_hum": {
        "name": "Tôm hùm",
        "scientific_name": "Panulirus spp.",
        "description": "Vỏ giáp dày cứng có nhiều gai nhọn, đôi râu dài, thân to bè, giá trị kinh tế rất cao.",
        "commercial_grade": "Hải sản cao cấp đặc biệt",
    },
    "tom_tit": {
        "name": "Tôm tít (Bề bề)",
        "scientific_name": "Stomatopoda (nhóm tôm tít)",
        "description": "Thân dài dẹp lưng bụng, đôi càng gấp như bọ ngựa, thịt ngọt thơm đậm đà.",
        "commercial_grade": "Hải sản tươi sống loại 1",
    },
    "tom_dat": {
        "name": "Tôm đất",
        "scientific_name": "Metapenaeus spp.",
        "description": "Vỏ mỏng màu nâu nhạt hoặc hồng đất, sống tự nhiên ở đầm phá, thịt giòn ngọt.",
        "commercial_grade": "Tôm tự nhiên sinh thái",
    },
    "tom_hum_dat": {
        "name": "Tôm hùm đất (Crawfish)",
        "scientific_name": "Procambarus / Cherax spp.",
        "description": "Vỏ đỏ cam sẫm, hai càng to bè chắc khỏe, sống vùng nước ngọt.",
        "commercial_grade": "Thương phẩm ẩm thực",
    },
    "tep_kieng": {
        "name": "Tép cảnh (Cherry Shrimp)",
        "scientific_name": "Neocaridina davidi",
        "description": "Kích thước nhỏ nhắn, màu đỏ tươi rực rỡ, nuôi làm cảnh thủy sinh.",
        "commercial_grade": "Sinh vật cảnh thủy sinh",
    }
}


INFERENCE_LOCK = threading.Lock()
ANALYSIS_CONTRACT_VERSION = 6
TIGER_VISUAL_SIGNS = {
    'black_gill': 'Bệnh đen mang (dự đoán qua ảnh)',
    'white_spot_like': 'Bệnh đốm trắng (dự đoán qua ảnh)',
    'yellow_head_like': 'Bệnh đầu vàng (dự đoán qua ảnh)',
    'no_visible_target_sign': 'Chưa thấy dấu hiệu mục tiêu qua ảnh',
}


def get_model_path():
    root = Path(__file__).resolve().parent.parent
    configured = Path(os.environ.get('SHRIMP_MODEL_PATH', 'models/shrimp_model_best.pt'))
    return (configured if configured.is_absolute() else root / configured).resolve()


def get_confidence_threshold():
    threshold = float(os.environ.get('SHRIMP_CONFIDENCE_THRESHOLD', '80'))
    if not math.isfinite(threshold) or not 1 <= threshold <= 100:
        raise ValueError('SHRIMP_CONFIDENCE_THRESHOLD must be between 1 and 100')
    return threshold


@lru_cache(maxsize=1)
def _load_model(path, modified_ns, size):
    from ultralytics import YOLO
    model = YOLO(path)
    if model.task != 'classify' or set(model.names.values()) != set(SPECIES_METADATA):
        raise ValueError('Checkpoint does not match the eight supported classification groups')
    version = hashlib.sha256(Path(path).read_bytes()).hexdigest()[:12]
    return model, version


def load_model():
    path = get_model_path()
    stat = path.stat()
    return _load_model(str(path), stat.st_mtime_ns, stat.st_size)


def classify_result(selected_class, confidence, threshold):
    if selected_class not in SPECIES_METADATA or not math.isfinite(confidence) or not 0 <= confidence <= 100:
        raise ValueError('Invalid classification result')
    meta = SPECIES_METADATA[selected_class]
    uncertain = confidence < threshold
    return {
        'identification_status': 'uncertain' if uncertain else 'identified',
        'classification_threshold': threshold,
        'species': 'Chưa xác định' if uncertain else meta['name'],
        'scientific_name': 'Chưa xác định' if uncertain else meta['scientific_name'],
        'class_id': None if uncertain else selected_class,
        'candidate_species': meta['name'] if uncertain else None,
        'candidate_scientific_name': meta['scientific_name'] if uncertain else None,
        'confidence': round(confidence, 1),
        'description': (
            f"Chưa đủ độ tin cậy để kết luận. Gợi ý: {meta['name']} ({confidence:.1f}%, ngưỡng {threshold:g}%). Hãy chụp lại ảnh rõ hơn."
            if uncertain else meta['description']
        ),
    }


def predict_shrimp(image_path: str):
    start_time = time.time()
    if not get_model_path().is_file():
        return {"success": False, "error": "Chưa có mô hình phân loại tôm."}
    try:
        from PIL import Image
        from PIL import ImageOps
        with Image.open(image_path) as image:
            image.load()
            width, height = image.size
            rgb = ImageOps.exif_transpose(image).convert('RGB')
        threshold = get_confidence_threshold()
        model, version = load_model()
        adapter_version = None
        with INFERENCE_LOCK:
            presence = assess_presence(model, rgb, version, include_feature=True)
            if presence['status'] == 'shrimp':
                # Explicitly reset embed: Ultralytics predictor retains overrides.
                result = model.predict(rgb, imgsz=224, embed=None, verbose=False)[0]
                selected_class = result.names[result.probs.top1]
                confidence = float(result.probs.top1conf) * 100
                if 'feature' in presence:
                    try:
                        original = result.probs.data.detach().cpu().numpy()
                        names = tuple(result.names[index] for index in range(len(original)))
                        scores, adapter_version = apply_adapter(presence['feature'], original, version, names, threshold / 100)
                        if adapter_version:
                            selected = int(scores.argmax())
                            selected_class = names[selected]
                            confidence = float(scores[selected]) * 100
                    except (OSError, KeyError, ValueError, RuntimeError) as exc:
                        print(f'Species adapter unavailable: {exc}', file=sys.stderr)
                classification = classify_result(selected_class, confidence, threshold)
            else:
                confidence = 0
                rejected = presence['status'] == 'no_shrimp'
                classification = dict(
                    identification_status='no_shrimp' if rejected else 'uncertain',
                    classification_threshold=threshold,
                    species='Không phát hiện tôm' if rejected else 'Chưa xác định',
                    scientific_name='Không áp dụng' if rejected else 'Chưa xác định',
                    class_id=None, candidate_species=None, candidate_scientific_name=None,
                    confidence=0,
                    description='Không phát hiện tôm trong ảnh. Vui lòng tải ảnh có tôm.' if rejected else
                    'Chưa xác định ảnh có tôm hay không. Vui lòng chọn ảnh có tôm nhìn rõ.',
                )
    except Exception as exc:
        print(f"Species inference failed: {exc}", file=sys.stderr)
        return {"success": False, "error": "Không thể phân tích ảnh bằng mô hình AI. Vui lòng thử lại."}

    try:
        from .shell_color import observe_shell_color, unavailable
    except ImportError:
        from shell_color import observe_shell_color, unavailable
    color = observe_shell_color(rgb) if presence['status'] == 'shrimp' else unavailable('Chưa xác nhận ảnh có tôm.')
    abnormalities = {
        'assessed': False,
        'abnormal_detected': False,
        'health_summary': 'Chưa đánh giá',
        'alerts': [],
        'details': ['Hiện chỉ hỗ trợ phân tích dấu hiệu qua ảnh khi nhận diện được tôm sú.'],
    }
    if classification['class_id'] == 'tom_su':
        try:
            sign, = classify_images([rgb])
            summary = TIGER_VISUAL_SIGNS[sign]
            detected = sign != 'no_visible_target_sign'
            abnormalities = {
                'assessed': True, 'visual_sign': sign, 'model_version': TIGER_SIGNS_VERSION,
                'abnormal_detected': detected, 'health_summary': summary, 'alerts': [summary] if detected else [],
                'details': ['Kết quả thử nghiệm qua ảnh tôm sú, cần kiểm tra thêm để xác nhận bệnh.'],
            }
        except Exception as exc:
            print(f'Tiger-shrimp sign inference failed: {exc}', file=sys.stderr)
            abnormalities['details'] = ['Mô hình dấu hiệu tôm sú hiện chưa sẵn sàng.']

    return {
        **classification,
        "analysis_contract_version": ANALYSIS_CONTRACT_VERSION,
        "color_analysis": color,
        "success": True,
        "model_status": "YOLO_SPECIES_WITH_PRESENCE_GATE",
        "model_version": version,
        "species_adapter_version": adapter_version,
        "image_content_status": presence['status'],
        "presence_score": presence['score'],
        "presence_gate_version": presence['version'],
        "processing_time": f"{time.time() - start_time:.2f} giây",
        "image_dimensions": f"{width} x {height} px",
        "health_status": "Chưa đánh giá",
        "commercial_grade": "Chưa đánh giá",
        "abnormal_detected": abnormalities['abnormal_detected'],
        "alerts": abnormalities['alerts'],
        "abnormalities": abnormalities,
        "angle_guidance": {
            "needs_reshoot": presence['status'] == 'shrimp' and classification['identification_status'] == 'uncertain',
            "confidence": round(confidence, 1),
            "threshold": threshold,
            "warning": classification['description'] if presence['status'] != 'shrimp' else
                ("Chưa đủ độ tin cậy để kết luận loại tôm; hãy thử ảnh rõ hơn." if confidence < threshold else "Độ tin cậy chỉ áp dụng cho phân loại loại tôm; chưa đánh giá góc chụp."),
            "instructions": [],
        },
    }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({
            "error": "Cần truyền đường dẫn file ảnh: python predict.py <path_to_image>"
        }, ensure_ascii=False, indent=2))
        sys.exit(1)

    img_arg = sys.argv[1]
    res = predict_shrimp(img_arg)
    print(json.dumps(res, ensure_ascii=False, indent=2))
