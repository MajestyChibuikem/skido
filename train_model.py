"""
Cattle lameness training script.
Run from the project root with the backend venv active:

    source backend/venv/bin/activate
    python train_model.py
"""

import cv2
import os
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')   # headless — saves plots to files instead of opening windows
import matplotlib.pyplot as plt
import seaborn as sns
import joblib
import warnings
warnings.filterwarnings('ignore')

from pathlib import Path
from collections import defaultdict
from ultralytics import YOLO

from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.svm import SVC
from sklearn.calibration import CalibratedClassifierCV
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.metrics import classification_report, confusion_matrix, ConfusionMatrixDisplay

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

ROOT       = Path(__file__).parent
LAME_DIR   = ROOT / 'dataset' / 'Lame'
NORMAL_DIR = ROOT / 'dataset' / 'Normal'
MODEL_OUT  = ROOT / 'cattle_lameness_model.joblib'
PLOTS_DIR  = ROOT / 'training_plots'

SAMPLE_FPS  = 5
MIN_FRAMES  = 10
COW_CLASS   = 19   # COCO class for 'cow'

FEATURE_COLS = [
    'speed_mean', 'speed_cv',
    'stride_mean', 'stride_cv',
    'path_straightness',
    'lateral_sway',
    'bbox_ar_cv',
    # new lameness-specific features
    'y_oscillation',     # vertical head-bob: std of normalised top-of-box Y position
    'stride_rhythm',     # autocorrelation of speed at lag=stride_window (limp rhythm)
    'lateral_asymmetry', # mean signed offset from centreline (favours one side)
]

# ---------------------------------------------------------------------------
# Feature extraction
# ---------------------------------------------------------------------------

def _gait_features(detections, sample_fps):
    if len(detections) < 8:
        return None

    cx = np.array([d[0] for d in detections], dtype=float)
    cy = np.array([d[1] for d in detections], dtype=float)
    w  = np.array([d[2] for d in detections], dtype=float)
    h  = np.array([d[3] for d in detections], dtype=float)

    diffs      = np.sqrt(np.diff(cx)**2 + np.diff(cy)**2)
    speed_mean = float(np.mean(diffs))
    speed_cv   = float(np.std(diffs) / (speed_mean + 1e-9))

    win     = max(1, int(sample_fps * 3))
    strides = [
        float(np.sqrt((cx[i+win]-cx[i])**2 + (cy[i+win]-cy[i])**2))
        for i in range(0, len(cx) - win, win)
    ]
    stride_mean = float(np.mean(strides)) if strides else 0.0
    stride_cv   = float(np.std(strides) / (stride_mean + 1e-9)) if strides else 0.0

    total_path        = float(np.sum(diffs)) + 1e-9
    direct            = float(np.sqrt((cx[-1]-cx[0])**2 + (cy[-1]-cy[0])**2))
    path_straightness = min(1.0, direct / total_path)

    direction = np.array([cx[-1]-cx[0], cy[-1]-cy[0]], dtype=float)
    dir_norm  = np.linalg.norm(direction)
    if dir_norm > 1e-6:
        direction /= dir_norm
        perp         = np.array([-direction[1], direction[0]])
        pts          = np.stack([cx - cx[0], cy - cy[0]], axis=1)
        lateral_sway = float(np.std(np.abs(pts @ perp)))
    else:
        lateral_sway = float(np.std(cx)) + float(np.std(cy))

    ar    = w / (h + 1e-9)
    ar_cv = float(np.std(ar) / (np.mean(ar) + 1e-9))

    # --- y_oscillation: std of normalised top-of-bbox Y ---
    # Top of box = cy - h/2.  Normalise by bbox height so camera distance
    # doesn't dominate.  Lame cattle nod more → higher oscillation.
    y_top      = cy - h / 2.0
    y_top_norm = y_top / (h + 1e-9)
    y_oscillation = float(np.std(y_top_norm))

    # --- stride_rhythm: autocorrelation of speed at the stride lag ---
    # A limping gait creates a periodic fast-slow speed pattern at the
    # stride frequency.  Strong positive autocorrelation = rhythmic limp.
    if len(diffs) > win * 2:
        ac = float(np.corrcoef(diffs[:-win], diffs[win:])[0, 1])
        stride_rhythm = max(-1.0, min(1.0, ac))  # clamp to [-1, 1]
    else:
        stride_rhythm = 0.0

    # --- lateral_asymmetry: mean signed perpendicular offset ---
    # A lame animal consistently drifts toward its sound leg.
    # (lateral_sway above measures the spread; this measures the bias.)
    if dir_norm > 1e-6:
        direction_la = np.array([cx[-1]-cx[0], cy[-1]-cy[0]], dtype=float)
        direction_la /= np.linalg.norm(direction_la)
        perp_la = np.array([-direction_la[1], direction_la[0]])
        pts_la  = np.stack([cx - cx[0], cy - cy[0]], axis=1)
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


def extract_features(video_path, yolo_model):
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        return None

    video_fps    = cap.get(cv2.CAP_PROP_FPS) or 30.0
    sample_every = max(1, int(round(video_fps / SAMPLE_FPS)))
    tracks       = defaultdict(list)
    frame_idx    = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        if frame_idx % sample_every == 0:
            results = yolo_model.track(
                frame, classes=[COW_CLASS],
                persist=True, tracker='bytetrack.yaml', verbose=False,
            )
            if results and results[0].boxes is not None:
                boxes = results[0].boxes
                if boxes.id is not None:
                    for box, tid in zip(boxes.xyxy.cpu().numpy(), boxes.id.cpu().numpy()):
                        x1, y1, x2, y2 = box
                        tracks[int(tid)].append((
                            (x1+x2)/2, (y1+y2)/2, x2-x1, y2-y1
                        ))
        frame_idx += 1

    cap.release()

    valid = {tid: d for tid, d in tracks.items() if len(d) >= MIN_FRAMES}
    if not valid:
        return None

    best = max(valid, key=lambda t: len(valid[t]))
    return _gait_features(valid[best], SAMPLE_FPS)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    PLOTS_DIR.mkdir(exist_ok=True)

    # Validate dataset
    assert LAME_DIR.exists(),   f"Missing {LAME_DIR} — run: python download_dataset.py"
    assert NORMAL_DIR.exists(), f"Missing {NORMAL_DIR} — run: python download_dataset.py"

    lame_videos   = sorted(LAME_DIR.glob('*.mp4'))
    normal_videos = sorted(NORMAL_DIR.glob('*.mp4'))
    print(f"Dataset  — Lame: {len(lame_videos)}  Normal: {len(normal_videos)}")

    # Load YOLO
    print("\nLoading YOLOv8n...")
    yolo = YOLO('yolov8n.pt')
    print("YOLOv8n ready\n")

    # Process videos
    all_features, all_labels, skipped = [], [], []

    def process(paths, label):
        total = len(paths)
        for i, vp in enumerate(paths, 1):
            print(f"  [{label}] {i}/{total}  {vp.name}", end=" ... ", flush=True)
            feats = extract_features(vp, yolo)
            if feats:
                all_features.append(feats)
                all_labels.append(label)
                print("OK")
            else:
                skipped.append(f"{label}/{vp.name}")
                print("SKIPPED")

    print("Processing Lame videos...")
    process(lame_videos, 'Lame')
    print("\nProcessing Normal videos...")
    process(normal_videos, 'Normal')

    print(f"\nCollected {len(all_features)} samples  ({len(skipped)} skipped)")
    if skipped:
        print("  Skipped:", skipped)

    if len(all_features) < 10:
        print("ERROR: too few samples to train — check that YOLO can detect cows in the videos.")
        return

    # Build dataframe
    df = pd.DataFrame(all_features)
    df['label'] = all_labels
    print("\nClass balance:")
    print(df['label'].value_counts().to_string())
    print("\nFeature means by class:")
    print(df.groupby('label')[FEATURE_COLS].mean().T.to_string())

    # Feature distribution plots
    fig, axes = plt.subplots(2, 4, figsize=(22, 9))
    for ax, col in zip(axes.flatten(), FEATURE_COLS):
        sns.boxplot(x='label', y=col, data=df, palette='Set2', ax=ax)
        ax.set_title(col)
        ax.set_xlabel('')
    axes.flatten()[-1].set_visible(False)
    plt.suptitle('Feature Distributions: Lame vs Normal', fontsize=14, fontweight='bold')
    plt.tight_layout()
    out = PLOTS_DIR / 'feature_distributions.png'
    plt.savefig(out, dpi=120)
    plt.close()
    print(f"\nSaved feature plot → {out}")

    # Train
    X = df[FEATURE_COLS].values
    y = (df['label'] == 'Lame').astype(int).values

    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

    candidates = {
        'Random Forest': Pipeline([
            ('scaler', StandardScaler()),
            ('clf',    RandomForestClassifier(
                n_estimators=200, max_depth=6,
                random_state=42, class_weight='balanced'
            )),
        ]),
        'Gradient Boosting': Pipeline([
            ('scaler', StandardScaler()),
            ('clf',    GradientBoostingClassifier(
                n_estimators=150, max_depth=3,
                learning_rate=0.1, random_state=42
            )),
        ]),
        'SVM (RBF)': Pipeline([
            ('scaler', StandardScaler()),
            # CalibratedClassifierCV with isotonic regression gives far better
            # probability estimates than SVC's built-in Platt scaling on small
            # datasets — avoids overconfident scores near the decision boundary.
            ('clf', CalibratedClassifierCV(
                SVC(kernel='rbf', C=2.0, random_state=42, class_weight='balanced'),
                method='isotonic', cv=3,
            )),
        ]),
    }

    print(f"\n{'Model':<25}  {'F1 mean':>8}  {'F1 std':>8}  {'AUC mean':>9}")
    print('-' * 56)

    results = {}
    for name, pipe in candidates.items():
        f1  = cross_val_score(pipe, X, y, cv=skf, scoring='f1')
        auc = cross_val_score(pipe, X, y, cv=skf, scoring='roc_auc')
        results[name] = {'f1': f1.mean(), 'auc': auc.mean(), 'pipe': pipe}
        print(f"{name:<25}  {f1.mean():>8.3f}  {f1.std():>8.3f}  {auc.mean():>9.3f}")

    best_name = max(results, key=lambda k: results[k]['f1'])
    best_pipe = results[best_name]['pipe']
    print(f"\nBest: {best_name}  (F1={results[best_name]['f1']:.3f})")

    # Final eval on held-out split
    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)
    best_pipe.fit(X_tr, y_tr)
    y_pred = best_pipe.predict(X_te)
    print(f"\nTest set ({len(X_te)} samples):")
    print(classification_report(y_te, y_pred, target_names=['Normal', 'Lame']))

    cm   = confusion_matrix(y_te, y_pred)
    disp = ConfusionMatrixDisplay(cm, display_labels=['Normal', 'Lame'])
    fig, ax = plt.subplots(figsize=(5, 4))
    disp.plot(cmap='Blues', ax=ax)
    ax.set_title(f'Confusion Matrix — {best_name}')
    plt.tight_layout()
    out = PLOTS_DIR / 'confusion_matrix.png'
    plt.savefig(out, dpi=120)
    plt.close()
    print(f"Saved confusion matrix → {out}")

    # Feature importance
    clf = best_pipe.named_steps['clf']
    if hasattr(clf, 'feature_importances_'):
        imp = pd.Series(clf.feature_importances_, index=FEATURE_COLS).sort_values()
        fig, ax = plt.subplots(figsize=(8, 4))
        imp.plot.barh(ax=ax, color='steelblue')
        ax.set_title('Feature Importance')
        plt.tight_layout()
        out = PLOTS_DIR / 'feature_importance.png'
        plt.savefig(out, dpi=120)
        plt.close()
        print(f"Saved feature importance → {out}")

    # Retrain on full dataset and save
    best_pipe.fit(X, y)
    bundle = {
        'model':        best_pipe,
        'feature_cols': FEATURE_COLS,
        'model_name':   best_name,
        'n_train':      len(X),
        'classes':      ['Normal', 'Lame'],
    }
    joblib.dump(bundle, MODEL_OUT)
    print(f"\nModel saved → {MODEL_OUT}")
    print(f"  Model   : {best_name}")
    print(f"  Samples : {len(X)}  (Lame={int(y.sum())}  Normal={int((1-y).sum())})")
    print(f"\nNext step:")
    print(f"  cp {MODEL_OUT} backend/app/ml/models/cattle_lameness_model.joblib")


if __name__ == '__main__':
    main()
