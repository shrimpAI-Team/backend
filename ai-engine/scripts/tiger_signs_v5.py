"""Inference for the experimental tiger-shrimp visual-sign model."""

import hashlib
import json
import threading
from functools import lru_cache
from pathlib import Path

from PIL import ImageOps

MODEL_VERSION = 'tiger_signs_v5'
ROTATIONS = (0, 90, 180, 270)
_LOCK = threading.Lock()


def prepare_view(rgb, rotation=0):
    if rotation:
        rgb = rgb.rotate(rotation, expand=True)
    return ImageOps.pad(rgb, (224, 224), color=(114, 114, 114))


@lru_cache(maxsize=1)
def _load_model():
    import numpy as np
    import torch
    from ultralytics import YOLO

    root = Path(__file__).resolve().parent.parent
    folder = root / 'models' / MODEL_VERSION
    report = json.loads((folder / 'report.json').read_text())
    backbone = root / report['feature_checkpoint']
    head_path = folder / 'kernel_head.npz'
    for path, field in ((backbone, 'feature_checkpoint_sha256'), (head_path, 'head_sha256')):
        if hashlib.sha256(path.read_bytes()).hexdigest() != report[field]:
            raise ValueError(f'V5 model checksum mismatch: {path.name}')
    with np.load(head_path) as head:
        return (YOLO(str(backbone)), report['feature_layer'], head['mean'], head['scale'],
                torch.from_numpy(head['support']), torch.from_numpy(head['alpha']),
                float(head['gamma']), float(head['black_gill_margin']), head['class_order'].tolist())


def squared_distance(left, right):
    import torch

    return torch.cdist(left, right).square() / left.shape[1]


def classify_images(images):
    import numpy as np
    import torch

    with _LOCK:
        model, layer, mean, scale, support, alpha, gamma, margin, labels = _load_model()
        results = model.predict([prepare_view(rgb, angle) for rgb in images for angle in ROTATIONS],
                                imgsz=224, embed=[layer], device='cpu', verbose=False)
    embedded = np.stack([item.detach().cpu().numpy().reshape(-1) for item in results])
    rotated = embedded.reshape(len(images), len(ROTATIONS), -1)
    pooled = np.concatenate((rotated.mean(axis=1), rotated.max(axis=1)), axis=1)
    features = torch.from_numpy(np.clip((pooled - mean) / scale, -8, 8)).double()
    scores = (torch.exp(-gamma * squared_distance(features, support)) @ alpha).numpy()
    other = scores[:, 1:].argmax(axis=1) + 1
    return [labels[0 if score[0] - score[index] > margin else index]
            for score, index in zip(scores, other, strict=True)]
