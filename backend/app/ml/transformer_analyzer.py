"""
Transformer-based cattle lameness inference.

Adapts YOLOv8 centroid/bbox tracking data into the windowed feature format
expected by LamenessSeverityModel. Falls back gracefully when weights are absent.

Colab export (add to last cell of v33 notebook):
    torch.save(trainer.model.state_dict(), 'best_model.pt')
    # Download and place in backend/app/ml/models/best_model.pt
"""

import os
import logging
import numpy as np

logger = logging.getLogger(__name__)

_WEIGHTS_PATH = os.path.join(os.path.dirname(__file__), 'models', 'best_model.pt')

_CONFIG = {
    "POSE_DIM": 16,
    "FLOW_DIM": 3,
    "VIDEO_DIM": 128,
    "USE_POSE": True,
    "USE_FLOW": True,
    "USE_VIDEOMAE": False,
    "NUM_HEADS": 8,
    "NUM_LAYERS": 4,
    "MODE": "regression",
}

_WINDOW = 15   # frames per window (~3 s at 5 fps)
_HOP    = 7    # 50 % overlap

_model  = None
_device = None


def is_available() -> bool:
    """True when best_model.pt has been placed in models/."""
    return os.path.isfile(_WEIGHTS_PATH)


def _load():
    global _model, _device
    if _model is not None:
        return _model
    if not is_available():
        return None
    try:
        import torch
        from .lameness_model import LamenessSeverityModel

        _device = 'cuda' if torch.cuda.is_available() else 'cpu'
        m = LamenessSeverityModel(_CONFIG, mode="regression")
        state = torch.load(_WEIGHTS_PATH, map_location=_device, weights_only=True)
        if isinstance(state, dict) and 'model_state_dict' in state:
            state = state['model_state_dict']
        m.load_state_dict(state)
        m.to(_device)
        m.eval()
        _model = m
        logger.info("LamenessSeverityModel loaded from %s on %s", _WEIGHTS_PATH, _device)
    except Exception as exc:
        logger.error("Transformer load failed: %s", exc)
        _model = None
    return _model


def analyze_with_transformer(pose_data: dict, frame_rate: float = 5.0):
    """
    Run LamenessSeverityModel inference.

    Returns (lameness_score 0-10, status str) or None when unavailable.
    """
    model = _load()
    if model is None:
        return None

    pose_wins, flow_wins = _build_windows(pose_data)
    if pose_wins is None:
        return None

    try:
        import torch
        with torch.no_grad():
            p = torch.tensor(pose_wins, dtype=torch.float32).unsqueeze(0).to(_device)
            f = torch.tensor(flow_wins, dtype=torch.float32).unsqueeze(0).to(_device)
            severity, _ = model(pose=p, flow=f)
            sev = float(severity.item())

        # Severity 0-3 → lameness score 0-10
        score = round(min(10.0, sev * (10.0 / 3.0)), 1)
        return score, _status(score)

    except Exception as exc:
        logger.error("Transformer inference error: %s", exc)
        return None


# ── Feature extraction ────────────────────────────────────────────────────────

def _build_windows(pose_data: dict):
    centroids = pose_data.get('centroids', [])
    bboxes    = pose_data.get('bboxes', [])

    if len(centroids) < _WINDOW:
        return None, None

    cx = np.array([c[0] for c in centroids], dtype=np.float64)
    cy = np.array([c[1] for c in centroids], dtype=np.float64)

    has_bb = bboxes and len(bboxes) == len(centroids)
    bw = np.array([b[0] for b in bboxes], dtype=np.float64) if has_bb else np.full(len(cx), 50.0)
    bh = np.array([b[1] for b in bboxes], dtype=np.float64) if has_bb else np.full(len(cx), 80.0)

    # Frame-level velocities (prepend so same length as cx)
    dx = np.diff(cx, prepend=cx[0])
    dy = np.diff(cy, prepend=cy[0])
    sp = np.sqrt(dx**2 + dy**2)

    pose_wins, flow_wins = [], []

    for s in range(0, len(cx) - _WINDOW + 1, _HOP):
        e = s + _WINDOW
        wcx, wcy = cx[s:e], cy[s:e]
        wbw, wbh = bw[s:e], bh[s:e]
        wsp       = sp[s:e]
        wdx, wdy  = dx[s:e], dy[s:e]

        # Speed stats
        sp_mean = float(np.mean(wsp))
        sp_std  = float(np.std(wsp))
        sp_cv   = sp_std / (sp_mean + 1e-9)

        # Acceleration stats
        acc = np.abs(np.diff(wsp))
        acc_mean = float(np.mean(acc)) if len(acc) else 0.0
        acc_std  = float(np.std(acc))  if len(acc) else 0.0

        # Positional spread
        x_std  = float(np.std(wcx))
        y_std  = float(np.std(wcy))
        x_rng  = float(np.ptp(wcx))
        y_rng  = float(np.ptp(wcy))

        # Bounding-box aspect ratio
        ar      = wbw / (wbh + 1e-9)
        ar_mean = float(np.mean(ar))
        ar_std  = float(np.std(ar))

        # Head-bob proxy (normalised top-bbox Y std)
        y_top_std = float(np.std((wcy - wbh / 2.0) / (wbh + 1e-9)))

        # Path geometry
        path_len    = float(np.sum(wsp)) + 1e-9
        disp        = float(np.sqrt((wcx[-1]-wcx[0])**2 + (wcy[-1]-wcy[0])**2))
        straight    = min(1.0, disp / path_len)
        lat_offset  = _lateral_offset(wcx, wcy)

        pose_vec = np.array([
            sp_mean,            sp_std,            sp_cv,
            acc_mean,           acc_std,
            x_std,              y_std,             x_rng,             y_rng,
            ar_mean,            ar_std,            y_top_std,
            path_len / 1000.0,  disp / 1000.0,     straight,
            lat_offset / 100.0,
        ], dtype=np.float32)

        flow_vec = np.array([
            float(np.mean(wdx)) / 10.0,
            float(np.mean(wdy)) / 10.0,
            sp_mean / 10.0,
        ], dtype=np.float32)

        pose_wins.append(pose_vec)
        flow_wins.append(flow_vec)

    if not pose_wins:
        return None, None

    return np.stack(pose_wins), np.stack(flow_wins)


def _lateral_offset(cx, cy) -> float:
    direction = np.array([cx[-1] - cx[0], cy[-1] - cy[0]], dtype=float)
    norm = np.linalg.norm(direction)
    if norm < 1e-6:
        return 0.0
    direction /= norm
    perp = np.array([-direction[1], direction[0]])
    pts  = np.stack([cx - cx[0], cy - cy[0]], axis=1)
    return float(np.abs(np.mean(pts @ perp)))


def _status(score: float) -> str:
    if score < 4.0:
        return 'normal'
    if score >= 8.5:
        return 'confirmed'
    return 'suspected'
