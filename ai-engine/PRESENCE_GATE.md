# Initial shrimp-presence filter

An input filter now precedes species classification. It has three outcomes:

- `shrimp`: continue to the existing eight-group classifier and its 80% species
  abstention threshold.
- `no_shrimp`: show "Không phát hiện tôm" without suggesting a species, explaining
  shrimp photography or saving a shrimp-analysis history item.
- `uncertain`: ask for an image with a clearly visible shrimp, without claiming
  the cause is camera angle or asserting there is no shrimp. Do not save history.

The frontend hides species scores and unassessed metric cards for the latter two
cases. The backend also suppresses guesses from legacy AI responses that do not
provide a shrimp-presence status. Missing/corrupt/incompatible gate files fail
rather than silently bypassing the filter.

## Implementation and data

The gate is a regularized binary logistic classifier on 256-dimensional frozen
features from the current species checkpoint (SHA256 prefix `44ce3d4cfb5b`).
It does not use segmentation masks, filename keywords, a blacklist of cartoons,
or an exact-image hash rule. The example Goten/Gohan cartoon was not used in fit.

Positive fit: 320 images sampled by class/group from the curated classification
training split. Positive validation: 241 images from its validation split.
Negatives: 114 manually screened COCO128 images; 14 ambiguous food images were
excluded. Related perceptual groups remain together: 74 train, 20 val, 20 holdout.
COCO128 source/download documentation:
https://docs.ultralytics.com/datasets/detect/coco128/

Regularization was selected on validation only. Fixed scores <=0.05 mean reject,
>=0.95 mean accept; the middle is uncertain. These are model scores, not calibrated
probabilities. No thresholds were selected using the holdout or the user example.

## Frozen internal holdout

| Actual group | Accepted as shrimp | Rejected | Uncertain |
| --- | ---: | ---: | ---: |
| 241 shrimp images | 215 | 2 | 24 |
| 20 non-shrimp images | 0 | 15 | 5 |

The user's `GotenWthGohan.webp` example returns `no_shrimp`, no candidate species.
See `models/presence_gate_v1/holdout_report.json` for the recorded results.

This is an initial filter. Twenty negative holdout images from one source cannot
establish accuracy on all cartoons, objects or deployment-camera conditions. Two
shrimp images were wrongly rejected and 24 were uncertain. Legacy source/capture
IDs are incomplete; grouping cannot guarantee independent animals/photographers.
Continue collecting difficult negatives and real-camera positives, using a new
dataset version for subsequent development. Do not tune repeatedly on this holdout.

## Running and deploying

No database migration or classifier retraining is needed. Restart Python and
NestJS after the code update, and reload the frontend. `/health` exposes
`presence_gate_version: 2552bc6fd2af` in addition to the species model version.

Commit both runtime files:

- `models/presence_gate_v1/gate.npz`
- `models/presence_gate_v1/metadata.json`

Also commit the inference code, backend DTO/normalization and frontend updates.
Raw `presence_data/` images/downloads are ignored by Git. The learned gate depends
on its exact feature checkpoint: changing the species checkpoint requires fitting
and validating a new compatible gate rather than removing its identity check.

Reproduction: `scripts/train_presence_gate.py` and `scripts/evaluate_presence_gate.py`.
These preserve existing run outputs. They require the local curated dataset and
screened COCO128 download, not just runtime artifacts. Regression checks are in
`scripts/test_presence_gate.py` and the shrimp-analysis service tests.
