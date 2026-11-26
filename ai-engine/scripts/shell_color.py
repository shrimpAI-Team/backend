"""Experimental observed image colour inside learned body masks, no health claims."""
import logging
import hashlib
import json
import os
import threading
from functools import lru_cache
from pathlib import Path

import cv2
import numpy as np

LOCK = threading.Lock()
NOTE = 'Màu quan sát tại vùng lõi thân trong ảnh, phụ thuộc ánh sáng và mask thử nghiệm; không đại diện toàn bộ hoa văn vỏ, không đánh giá độ tươi hay bệnh lý.'


def unavailable(reason):
    return dict(assessed=False, status='unassessed', dominant_color='Chưa đánh giá',
                shell_transparency='Chưa đánh giá', description=reason)


def simple_background_mask(rgb):
    """Conservative colour-distance proposal, NOT a trained shrimp detector.

    Called only after the independent shrimp presence gate in predict.py.
    Reject textured borders, multiple foreground objects and clipped objects.
    """
    h, w = rgb.shape[:2]
    if min(h, w) < 64:
        return None
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB).astype(np.float32)
    border = np.concatenate([lab[:3].reshape(-1,3), lab[-3:].reshape(-1,3), lab[:, :3].reshape(-1,3), lab[:, -3:].reshape(-1,3)])
    background = np.median(border, axis=0)
    spread = np.linalg.norm(border-background, axis=1)
    if np.percentile(spread, 90) > 12:
        return None
    mask = (np.linalg.norm(lab-background, axis=2) > max(22, float(np.percentile(spread,90))*2.5)).astype(np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((3,3),np.uint8))
    count, labels, stats, _ = cv2.connectedComponentsWithStats(mask)
    order = sorted(range(1,count), key=lambda i: stats[i,cv2.CC_STAT_AREA], reverse=True)
    if not order:
        return None
    largest = order[0]; area = stats[largest,cv2.CC_STAT_AREA]
    if not .02 <= area/(h*w) <= .65 or (len(order)>1 and stats[order[1],cv2.CC_STAT_AREA] > area*.2):
        return None
    component = (labels==largest).astype(np.uint8)
    if component[:2].any() or component[-2:].any() or component[:,:2].any() or component[:,-2:].any():
        return None
    contours,_ = cv2.findContours(component,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
    contour = max(contours,key=cv2.contourArea)
    a,b = cv2.minAreaRect(contour)[1]
    if min(a,b) <= 0 or not 1.4 <= max(a,b)/min(a,b) <= 12:
        return None
    return component


def mask_result(rgb, mask, method):
    answer = measure_color(rgb,mask)
    contours,_ = cv2.findContours(mask,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
    if contours:
        contour = max(contours,key=cv2.contourArea)
        points = cv2.approxPolyDP(contour, .003*cv2.arcLength(contour,True),True).reshape(-1,2)
        answer['body_polygon'] = (points/[rgb.shape[1],rgb.shape[0]]).round(5).tolist()
    answer['method'] = method
    return answer


def sampling_core(mask):
    distance = cv2.distanceTransform((mask > 0).astype(np.uint8), cv2.DIST_L2, 5)
    maximum = float(distance.max())
    return distance >= max(2.0, maximum * .5) if maximum > 0 else np.zeros(mask.shape, dtype=bool)


def measure_color(rgb, mask):
    if mask.shape != rgb.shape[:2] or np.count_nonzero(mask) < 256:
        return unavailable('Vùng thân quá nhỏ để phân tích màu.')
    # Remove boundary contamination; never substitute the entire image.
    core = sampling_core(mask)
    pixels = rgb[core]
    if len(pixels) < 256:
        return unavailable('Chưa tách được đủ vùng thân tôm.')
    hsv = cv2.cvtColor(pixels.reshape(-1, 1, 3), cv2.COLOR_RGB2HSV).reshape(-1, 3)
    valid = (hsv[:, 2] >= 35) & ~((hsv[:, 2] > 245) & (hsv[:, 1] < 35))
    if valid.mean() < .5 or valid.sum() < 256:
        return unavailable('Vùng thân quá tối hoặc phản sáng; hãy chụp với ánh sáng đều.')
    pixels, hsv = pixels[valid], hsv[valid]
    h, s, v = hsv.T
    names = np.full(len(h), 'Xám', dtype=object)
    chromatic = s >= 45
    names[chromatic & ((h < 10) | (h >= 170))] = 'Đỏ / hồng'
    names[chromatic & (h >= 10) & (h < 25)] = 'Cam / nâu'
    names[chromatic & (h >= 25) & (h < 35)] = 'Vàng'
    names[chromatic & (h >= 35) & (h < 85)] = 'Xanh lục'
    names[chromatic & (h >= 85) & (h < 135)] = 'Xanh lam'
    names[chromatic & (h >= 135) & (h < 170)] = 'Tím / hồng'
    names[(~chromatic) & (v >= 200)] = 'Trắng / xám nhạt'
    names[v < 65] = 'Sẫm màu'
    labels, counts = np.unique(names, return_counts=True)
    order = np.argsort(-counts)
    main = labels[order[0]]
    share = counts[order[0]] / len(pixels)
    selected = pixels[names == main]
    median = np.median(selected, axis=0).astype(int)
    return dict(assessed=True, status='observed_experimental', dominant_color=str(main),
                dominant_hex='#' + ''.join(f'{x:02x}' for x in median),
                dominant_fraction=round(float(share), 3), sampled_pixels=len(pixels),
                shell_transparency='Chưa đánh giá', description=NOTE)


@lru_cache(maxsize=1)
def load_segmenter(path, modified, size):
    from ultralytics import YOLO
    model = YOLO(path)
    if model.task != 'segment' or model.names != {0: 'shrimp_body'}:
        raise ValueError('Expected shrimp_body segmentation checkpoint')
    return model


def load_profile(path):
    profile_path = path.parent/'profile.json'
    if not profile_path.exists():
        return dict(threshold=.8, imgsz=640)
    profile = json.loads(profile_path.read_text(encoding='utf-8'))
    threshold = profile.get('threshold')
    if not isinstance(threshold, (int, float)) or not .3 <= threshold <= .95 or profile.get('imgsz') not in (512, 640):
        raise ValueError('Invalid mask inference profile')
    stat = path.stat()
    if checkpoint_hash(str(path), stat.st_mtime_ns, stat.st_size) != profile.get('checkpoint_sha256'):
        raise ValueError('Mask profile does not match checkpoint')
    return profile


@lru_cache(maxsize=2)
def checkpoint_hash(path, modified, size):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def observe_shell_color(image):
    root = Path(__file__).resolve().parent.parent
    path = Path(os.environ.get('SHRIMP_COLOR_MODEL_PATH', str(root/'models/shell_color_v2/body_mask.pt')))
    if not path.is_absolute():
        path = root/path
    try:
        stat = path.stat()
        profile = load_profile(path)
        with LOCK:
            model = load_segmenter(str(path), stat.st_mtime_ns, stat.st_size)
            result = model.predict(image, imgsz=profile['imgsz'], conf=profile['threshold'], retina_masks=True, verbose=False)[0]
        if result.masks is None or len(result.masks.xy) != 1:
            proposed = simple_background_mask(np.asarray(image)) if result.masks is None else None
            if proposed is not None:
                return mask_result(np.asarray(image), proposed, 'simple_background_experimental')
            return unavailable('Cần ảnh một con tôm rõ thân và mask đủ tin cậy để phân tích màu.')
        rgb = np.asarray(image)
        mask = np.zeros(rgb.shape[:2], np.uint8)
        polygon = np.rint(result.masks.xy[0]).astype(np.int32)
        if len(polygon) < 3:
            return unavailable('Chưa tách được thân tôm rõ ràng.')
        cv2.fillPoly(mask, [polygon], 1)
        fraction = float(mask.mean())
        if not .02 <= fraction <= .85:
            return unavailable('Vùng thân quá nhỏ hoặc mask chưa phù hợp; hãy thử ảnh rõ hơn.')
        answer = mask_result(rgb, mask, 'learned_body_core_hsv_v2')
        answer['mask_model_version'] = checkpoint_hash(str(path), stat.st_mtime_ns, stat.st_size)[:12]
        return answer
    except Exception:
        logging.getLogger(__name__).warning('Optional shell colour unavailable', exc_info=True)
        return unavailable('Chưa sẵn sàng mô hình tách thân để phân tích màu.')
