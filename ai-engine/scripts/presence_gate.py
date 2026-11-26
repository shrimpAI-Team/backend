"""Initial three-way shrimp-presence filter; scores are not probabilities."""
import hashlib
import json
from functools import lru_cache
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent


def decision(score, lower=.05, upper=.95):
    if not np.isfinite(score) or not 0 <= score <= 1 or not 0 <= lower < upper <= 1:
        raise ValueError('Invalid presence score or thresholds')
    return 'no_shrimp' if score <= lower else ('shrimp' if score >= upper else 'uncertain')


@lru_cache(maxsize=1)
def _load_gate(model_version, artifact_mtime, metadata_mtime):
    directory = ROOT / 'models/presence_gate_v1'
    metadata = json.loads((directory / 'metadata.json').read_text(encoding='utf-8'))
    if metadata['feature_model_sha256'][:12] != model_version:
        raise ValueError('Presence gate is incompatible with the species checkpoint; retrain/revalidate it')
    if hashlib.sha256((directory / 'gate.npz').read_bytes()).hexdigest() != metadata['artifact_sha256']:
        raise ValueError('Presence gate integrity check failed')
    with np.load(directory / 'gate.npz', allow_pickle=False) as data:
        parameters = {name: data[name].copy() for name in ('mean', 'scale', 'weight', 'bias')}
    dimension = metadata['feature_dimension']
    if any(parameters[name].shape != (dimension,) for name in ('mean', 'scale', 'weight')) or parameters['bias'].size != 1:
        raise ValueError('Invalid gate parameter dimensions')
    if any(not np.isfinite(value).all() for value in parameters.values()) or (parameters['scale'] <= 0).any():
        raise ValueError('Invalid gate parameters')
    decision(.5, metadata['lower_threshold'], metadata['upper_threshold'])
    return parameters, metadata


def load_gate(model_version):
    directory = ROOT / 'models/presence_gate_v1'
    return _load_gate(model_version, (directory / 'gate.npz').stat().st_mtime_ns,
                      (directory / 'metadata.json').stat().st_mtime_ns)


def score_feature(feature, parameters):
    feature = np.asarray(feature, dtype=np.float32).reshape(-1)
    if feature.shape != parameters['mean'].shape or not np.isfinite(feature).all():
        raise ValueError('Invalid image embedding')
    normalized = np.clip((feature - parameters['mean']) / parameters['scale'], -8, 8)
    logit = float(normalized @ parameters['weight'] + parameters['bias'].item())
    return float(1 / (1 + np.exp(-np.clip(logit, -50, 50))))


def assess_presence(model, image, model_version, *, include_feature=False):
    parameters, metadata = load_gate(model_version)
    embedding = model.predict(image, imgsz=224, embed=[metadata['feature_layer']], verbose=False)[0]
    feature = embedding.detach().cpu().numpy()
    score = score_feature(feature, parameters)
    status = decision(score, metadata['lower_threshold'], metadata['upper_threshold'])
    result = dict(status=status, score=round(score, 6), version=metadata['artifact_sha256'][:12])
    if include_feature and status == 'shrimp':
        result['feature'] = feature
    return result
