"""Gait analysis module for cattle lameness detection.

Loads a model bundle saved by train_model.py and extracts the same 10
features used during training:

  0 — speed_mean        : mean frame-to-frame centroid speed (pixels/frame)
  1 — speed_cv          : coefficient of variation of speed (gait irregularity)
  2 — stride_mean       : mean displacement over 3-second windows (pixels)
  3 — stride_cv         : coefficient of variation of stride length
  4 — path_straightness : direct distance / total path (1 = straight line)
  5 — lateral_sway      : std of perpendicular deviation from travel direction
  6 — bbox_ar_cv        : coefficient of variation of bbox aspect ratio
  7 — y_oscillation     : std of normalised top-of-bbox Y (head-bob proxy)
  8 — stride_rhythm     : speed autocorrelation at stride lag (limp periodicity)
  9 — lateral_asymmetry : mean signed lateral offset (favours one side)
"""

import os
import logging
import numpy as np
import joblib

logger = logging.getLogger(__name__)

_MODEL_PATH = os.path.join(os.path.dirname(__file__), 'models', 'cattle_lameness_model.joblib')

_bundle = None

def _load_bundle():
    global _bundle
    if _bundle is not None:
        return _bundle
    try:
        _bundle = joblib.load(_MODEL_PATH)
        logger.info(
            "Lameness model loaded: %s — features=%s",
            _bundle.get('model_name', '?'), _bundle.get('feature_cols'),
        )
    except Exception as exc:
        logger.error("Failed to load lameness model from %s: %s", _MODEL_PATH, exc)
        _bundle = None
    return _bundle


def analyze_gait(pose_data, frame_rate=5, pixel_to_cm=0.1):
    """Classify cattle gait and return a 0–10 lameness score.

    Primary path: LamenessSeverityModel (Transformer) when best_model.pt is present.
    Fallback: SVM pipeline trained by train_model.py.

    Args:
        pose_data: dict returned by pose_estimator.extract_pose_keypoints()
                   or pose_estimator.track_multiple_blobs().
        frame_rate: effective sample fps used during tracking.

    Returns:
        tuple (lameness_score: float 0–10, status: str)
            status is one of 'normal', 'suspected', 'confirmed'.
    """
    # ── Try Transformer model first ──────────────────────────────────────────
    try:
        from .transformer_analyzer import analyze_with_transformer, is_available as tf_available
        if tf_available():
            result = analyze_with_transformer(pose_data, frame_rate=frame_rate)
            if result is not None:
                logger.debug("Transformer inference: score=%.1f status=%s", *result)
                return result
    except Exception as exc:
        logger.warning("Transformer inference skipped (%s) — falling back to SVM", exc)

    # ── SVM fallback ─────────────────────────────────────────────────────────
    bundle = _load_bundle()
    if bundle is None:
        raise RuntimeError(
            "Lameness model not loaded — run cattle_lameness_training.ipynb, "
            "then copy cattle_lameness_model.joblib to backend/app/ml/models/"
        )

    pipe        = bundle['model']
    feature_cols = bundle['feature_cols']

    features = _extract_features(pose_data, frame_rate=frame_rate)
    X = np.array([features[c] for c in feature_cols]).reshape(1, -1)

    pred_idx = int(pipe.predict(X)[0])           # 0=Normal, 1=Lame
    prediction = bundle['classes'][pred_idx]

    if hasattr(pipe, 'predict_proba'):
        prob_lame = float(pipe.predict_proba(X)[0][1])
    else:
        prob_lame = 1.0 if prediction == 'Lame' else 0.0

    lameness_score = round(prob_lame * 10, 1)
    status = _classify_status(prediction, lameness_score)

    logger.debug(
        "Gait analysis — prediction=%s prob_lame=%.3f score=%.1f status=%s",
        prediction, prob_lame, lameness_score, status,
    )
    return lameness_score, status


# ---------------------------------------------------------------------------
# Feature extraction — must mirror cattle_lameness_training.ipynb exactly
# ---------------------------------------------------------------------------

def _extract_features(pose_data, frame_rate=5):
    centroids = pose_data.get('centroids', [])
    bboxes    = pose_data.get('bboxes', [])

    if len(centroids) < 5:
        return _zero_features()

    cx = np.array([c[0] for c in centroids], dtype=float)
    cy = np.array([c[1] for c in centroids], dtype=float)

    # --- speed ---
    diffs      = np.sqrt(np.diff(cx)**2 + np.diff(cy)**2)
    speed_mean = float(np.mean(diffs))
    speed_cv   = float(np.std(diffs) / (speed_mean + 1e-9))

    # --- stride (displacement over ~3-second windows) ---
    win     = max(1, int(frame_rate * 3))
    strides = [
        float(np.sqrt((cx[i+win]-cx[i])**2 + (cy[i+win]-cy[i])**2))
        for i in range(0, len(cx) - win, win)
    ]
    stride_mean = float(np.mean(strides)) if strides else 0.0
    stride_cv   = float(np.std(strides) / (stride_mean + 1e-9)) if strides else 0.0

    # --- path straightness ---
    total_path       = float(np.sum(diffs)) + 1e-9
    direct           = float(np.sqrt((cx[-1]-cx[0])**2 + (cy[-1]-cy[0])**2))
    path_straightness = min(1.0, direct / total_path)

    # --- lateral sway ---
    direction = np.array([cx[-1]-cx[0], cy[-1]-cy[0]], dtype=float)
    dir_norm  = np.linalg.norm(direction)
    if dir_norm > 1e-6:
        direction /= dir_norm
        perp         = np.array([-direction[1], direction[0]])
        pts          = np.stack([cx - cx[0], cy - cy[0]], axis=1)
        lateral_sway = float(np.std(np.abs(pts @ perp)))
    else:
        lateral_sway = float(np.std(cx)) + float(np.std(cy))

    # --- bbox aspect ratio variability ---
    if bboxes and len(bboxes) == len(centroids):
        w_arr = np.array([b[0] for b in bboxes], dtype=float)
        h_arr = np.array([b[1] for b in bboxes], dtype=float)
        ar    = w_arr / (h_arr + 1e-9)
        ar_cv = float(np.std(ar) / (np.mean(ar) + 1e-9))
    else:
        w_arr = np.zeros(len(centroids))
        h_arr = np.ones(len(centroids))
        ar_cv = 0.0

    # --- y_oscillation: std of normalised top-of-bbox Y (head-bob proxy) ---
    y_top         = cy - h_arr / 2.0
    y_top_norm    = y_top / (h_arr + 1e-9)
    y_oscillation = float(np.std(y_top_norm))

    # --- stride_rhythm: speed autocorrelation at stride lag (limp periodicity) ---
    if len(diffs) > win * 2:
        ac = float(np.corrcoef(diffs[:-win], diffs[win:])[0, 1])
        stride_rhythm = max(-1.0, min(1.0, ac))
    else:
        stride_rhythm = 0.0

    # --- lateral_asymmetry: mean signed offset from centreline ---
    if dir_norm > 1e-6:
        direction_la  = np.array([cx[-1]-cx[0], cy[-1]-cy[0]], dtype=float)
        direction_la /= np.linalg.norm(direction_la)
        perp_la       = np.array([-direction_la[1], direction_la[0]])
        pts_la        = np.stack([cx - cx[0], cy - cy[0]], axis=1)
        lateral_asymmetry = float(np.abs(np.mean(pts_la @ perp_la)))
    else:
        lateral_asymmetry = 0.0

    return {
        'speed_mean':        speed_mean,
        'speed_cv':          speed_cv,
        'stride_mean':       stride_mean,
        'stride_cv':         stride_cv,
        'path_straightness': path_straightness,
        'lateral_sway':      lateral_sway,
        'bbox_ar_cv':        ar_cv,
        'y_oscillation':     y_oscillation,
        'stride_rhythm':     stride_rhythm,
        'lateral_asymmetry': lateral_asymmetry,
    }


def _zero_features():
    return {
        'speed_mean': 0.0, 'speed_cv': 0.0,
        'stride_mean': 0.0, 'stride_cv': 0.0,
        'path_straightness': 0.0,
        'lateral_sway': 0.0,
        'bbox_ar_cv': 0.0,
        'y_oscillation': 0.0,
        'stride_rhythm': 0.0,
        'lateral_asymmetry': 0.0,
    }


def _classify_status(prediction, lameness_score):
    # Require high confidence before escalating — small training set means
    # Platt-scaled SVM probabilities are overconfident near the boundary.
    if prediction == 'Normal' or lameness_score < 4.0:
        return 'normal'
    if lameness_score >= 8.5:
        return 'confirmed'
    return 'suspected'
