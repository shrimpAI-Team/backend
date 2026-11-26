"""Apply the calibrated species adapter to the classifier's original scores."""

import hashlib
import json
import os
from functools import lru_cache
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
ADAPTER_VERSION = 'species_adapted_v3'


def adapted_probabilities(features, original, mean, scale, weight, bias):
    import torch

    normalized = np.clip((features - mean) / scale, -8, 8)
    scores = np.log(np.maximum(original, 1e-8)) + normalized @ weight + bias
    return torch.softmax(torch.from_numpy(scores), dim=1).numpy()


def guarded_probabilities(original, adapted, tiger_index, threshold, promotion):
    promotes_tiger = ((adapted.argmax(1) == tiger_index) &
                      ((original.argmax(1) != tiger_index) | (original[:, tiger_index] < threshold)))
    allow = ((adapted[:, tiger_index] >= promotion['minimum_tiger_score']) &
             (original.max(1) <= promotion['maximum_original_score']))
    return np.where((promotes_tiger & ~allow)[:, None], original, adapted)


@lru_cache(maxsize=4)
def load_adapter(backbone_version, names):
    folder = ROOT / 'models' / ADAPTER_VERSION
    report = json.loads((folder / 'report.json').read_text(encoding='utf-8'))
    if not report['backbone_sha256'].startswith(backbone_version):
        return None
    promotion = report['validation']['after']['promotion']
    if not report['validation']['guardrails_passed'] or not promotion:
        raise ValueError('Species adapter is missing its validated promotion rule')
    path = folder / 'adaptation_head.npz'
    if hashlib.sha256(path.read_bytes()).hexdigest() != report['head_sha256']:
        raise ValueError('Species adapter checksum mismatch')
    with np.load(path) as artifact:
        if tuple(artifact['labels']) != names:
            raise ValueError('Species adapter label order mismatch')
        parameters = {key: artifact[key] for key in ('mean', 'scale', 'weight', 'bias')}
    return parameters, promotion


def apply_adapter(feature, scores, backbone_version, names, threshold):
    if os.environ.get('SHRIMP_SPECIES_ADAPTER', '1') == '0':
        return scores, None
    adapter = load_adapter(backbone_version, names)
    if adapter is None:
        return scores, None
    parameters, promotion = adapter
    original = scores.reshape(1, -1)
    adapted = adapted_probabilities(feature.reshape(1, -1), original, **parameters)
    adjusted = guarded_probabilities(original, adapted, names.index('tom_su'), threshold, promotion)
    return adjusted[0], ADAPTER_VERSION
