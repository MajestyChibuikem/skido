"""Gait analysis module for cattle lameness detection.

Extracts the same 3 features used during SVM training and classifies
cattle gait as 'Lame' or 'Normal'.

Features (must match training exactly):
  0 — avg_stride_length : mean centroid displacement over 0.5s windows (pixels)
  1 — avg_walking_speed : mean frame-to-frame speed (cm/s, pixel_to_cm=0.1, fps=30)
  2 — symmetry_score    : left/right hindleg trajectory symmetry (0–1)
"""

import os
import logging
import numpy as np
import joblib

logger = logging.getLogger(__name__)

_MODEL_PATH = os.path.join(os.path.dirname(__file__), 'models', 'svm_model.joblib')

try:
    _svm_model = joblib.load(_MODEL_PATH)
    logger.info("SVM lameness model loaded from %s", _MODEL_PATH)
except Exception as exc:
    _svm_model = None
    logger.error("Failed to load SVM model: %s", exc)


def analyze_gait(pose_data, frame_rate=30, pixel_to_cm=0.1):
    """Classify cattle gait and produce a 0–10 lameness score.

    Args:
        pose_data: dict returned by pose_estimator.extract_pose_keypoints().
        frame_rate: fps of the source video.
        pixel_to_cm: pixel-to-centimetre conversion used during training (0.1).

    Returns:
        tuple (lameness_score: float 0–10, status: str)
            status is one of 'normal', 'suspected', 'confirmed'.
    """
    if _svm_model is None:
        raise RuntimeError("SVM model not loaded — check that svm_model.joblib exists in ml/models/.")

    features = _extract_features(pose_data, frame_rate=frame_rate, pixel_to_cm=pixel_to_cm)
    X = np.array(features).reshape(1, -1)

    prediction = _svm_model.predict(X)[0]               # 'Lame' or 'Normal'
    decision   = _svm_model.decision_function(X)[0]     # signed distance from hyperplane

    lameness_score = _decision_to_score(decision)
    status         = _classify_status(prediction, lameness_score)

    logger.debug(
        "Gait analysis — features=%s prediction=%s decision=%.3f score=%.1f status=%s",
        features, prediction, decision, lameness_score, status,
    )
    return lameness_score, status


# ---------------------------------------------------------------------------
# Feature extraction — mirrors the notebook's training pipeline exactly
# ---------------------------------------------------------------------------

def _extract_features(pose_data, frame_rate=30, pixel_to_cm=0.1):
    """Return [avg_stride_length, avg_walking_speed, symmetry_score]."""
    centroids = pose_data.get('centroids', [])
    frames    = pose_data.get('frames', [])

    avg_stride_length = _calculate_avg_stride_length(centroids, frame_rate=frame_rate)
    avg_walking_speed = _calculate_avg_walking_speed(centroids, frame_rate=frame_rate, pixel_to_cm=pixel_to_cm)
    symmetry_score    = _calculate_symmetry_score(frames)

    return [avg_stride_length, avg_walking_speed, symmetry_score]


def _calculate_avg_stride_length(centroids, frame_rate=30):
    """Mean centroid displacement measured over 0.5-second windows.

    Replicates calculate_stride_length() from the training notebook.
    """
    if len(centroids) < 2:
        return 0.0

    step = max(1, int(frame_rate * 0.5))
    strides = []
    for i in range(0, len(centroids) - step, step):
        p1 = np.array(centroids[i])
        p2 = np.array(centroids[i + step])
        strides.append(float(np.linalg.norm(p2 - p1)))

    return float(np.mean(strides)) if strides else 0.0


def _calculate_avg_walking_speed(centroids, frame_rate=30, pixel_to_cm=0.1):
    """Mean frame-to-frame speed in cm/s.

    Replicates calculate_walking_speed() from the training notebook.
    """
    if len(centroids) < 2:
        return 0.0

    speeds = []
    for i in range(len(centroids) - 1):
        p1 = np.array(centroids[i])
        p2 = np.array(centroids[i + 1])
        dist_cm   = float(np.linalg.norm(p2 - p1)) * pixel_to_cm
        speed_cms = dist_cm * frame_rate
        speeds.append(speed_cms)

    return float(np.mean(speeds)) if speeds else 0.0


def _calculate_symmetry_score(frames):
    """Left/right hindleg trajectory symmetry ratio (0–1, higher = more symmetric).

    Computes total path length for each hindleg across frames and returns
    min / max. Mirrors the limb symmetry logic from the training notebook.
    """
    left_positions  = []
    right_positions = []

    for frame in frames:
        kp = frame.get('keypoints', {})
        lh = kp.get('rear_left_hoof')
        rh = kp.get('rear_right_hoof')
        if lh:
            left_positions.append((lh['x'], lh['y']))
        if rh:
            right_positions.append((rh['x'], rh['y']))

    def path_length(pts):
        return sum(
            float(np.linalg.norm(np.array(pts[i + 1]) - np.array(pts[i])))
            for i in range(len(pts) - 1)
        )

    if len(left_positions) < 2 or len(right_positions) < 2:
        return 1.0

    left_len  = path_length(left_positions)
    right_len = path_length(right_positions)

    if left_len == 0 and right_len == 0:
        return 1.0
    if left_len == 0 or right_len == 0:
        return 0.0

    return float(min(left_len, right_len) / max(left_len, right_len))


# ---------------------------------------------------------------------------
# Score and status mapping
# ---------------------------------------------------------------------------

def _decision_to_score(decision_value):
    """Map SVM decision function to a 0–10 lameness score.

    For sklearn SVC with classes_ = ['Lame', 'Normal']:
      positive decision → Normal → low score
      negative decision → Lame  → high score
    """
    score = 10.0 / (1.0 + np.exp(2.0 * decision_value))
    return round(float(score), 1)


def _classify_status(prediction, lameness_score):
    if prediction == 'Normal':
        return 'normal'
    return 'confirmed' if lameness_score >= 7.0 else 'suspected'
