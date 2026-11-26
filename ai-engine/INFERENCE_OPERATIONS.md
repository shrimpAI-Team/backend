# Species inference operations

> Updated: input images now pass the three-way presence filter first. See
> [PRESENCE_GATE.md](PRESENCE_GATE.md) for runtime files, results and limitations.

The active classifier supports eight visual/commercial shrimp groups. It does not
measure length, weight, health, disease, color quality or batch uniformity.
Those criteria return "Chưa đánh giá". A confidence score is a model score,
not a measured probability that the answer is correct.

## Identification contract

- Default acceptance threshold: 80%, retained from the previous application
  warning threshold, not selected using the test split.
- Below threshold: `identification_status: uncertain`, `species: Chưa xác định`.
  `candidate_species` is only a suggestion. Backend enforces this rule even for
  responses from an older Python process.
- At/above threshold: `identified`. This does not guarantee a correct answer.
- Missing, incompatible or broken checkpoint: failure, no invented prediction.
- The species classifier alone can confidently misclassify non-shrimp inputs.
  Its confidence threshold is not an out-of-distribution detector. The initial
  presence filter now runs first; it still needs broader negative/real-camera data.
- History saves uncertain results under "Chưa xác định"; the suggestion is saved
  in the description. No database migration is necessary.

## Configuration

Both FastAPI and CLI fallback use the same Python configuration. Relative model
paths resolve against `ai-engine`, independently of the working directory:

```powershell
$env:SHRIMP_MODEL_PATH = 'models/species_curated_v1/shrimp_model_best.pt'
$env:SHRIMP_CONFIDENCE_THRESHOLD = '80'
.\venv\Scripts\python.exe server.py
```

Without overrides, `models/shrimp_model_best.pt` is used. If you set overrides,
set the same values in the shell running NestJS for its CLI fallback. Invalid
thresholds fail rather than silently reverting. Restart Python and NestJS after
code updates. Model loading is cached by path/file modification time/size; inference
is serialized per process. `/health` loads and validates the model and returns
the first 12 characters of its SHA256 as `model_version`, plus the threshold.

## Local trial rollout

The selected candidate is `models/species_curated_v1/shrimp_model_best.pt`.
Raw top-1 on the frozen internal test was 81.74% (197/241); macro F1 was 81.47%.
These scores precede the abstention policy. They do not establish the accuracy
of accepted-only predictions, non-shrimp rejection or deployment-camera images.
The candidate is suitable for a local trial, not a claim of validated production
accuracy. No further threshold selection should use the frozen test.

When activating, preserve the old checkpoint under `models/backups/` and record
both SHA256 values in a rollout JSON. To roll back, restore that backup to
`models/shrimp_model_best.pt` and restart Python. Remove a `SHRIMP_MODEL_PATH`
override if it would bypass the restored file. Keep the uncertainty behavior.

## Checks

```powershell
.\venv\Scripts\python.exe scripts/test_predict.py
.\venv\Scripts\python.exe scripts/test_prepare_dataset.py
```

Next data work: expert label review; new real-camera samples; targeted coverage
of freshwater prawns and Metapenaeus; and negative/non-shrimp examples. Detection,
segmentation and calibrated physical measurement are separate later stages.
