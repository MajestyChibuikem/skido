"""Pose estimation and animal tracking module for cattle video analysis.

Single-animal tracking (extract_pose_keypoints) and multi-animal tracking
(track_multiple_blobs) use YOLOv8 detections with lightweight center matching
for per-animal ID assignment.
"""

import logging
import cv2
import numpy as np
from collections import defaultdict

logger = logging.getLogger(__name__)

_yolo = None
# COCO livestock IDs used by YOLOv8: horse=17, sheep=18, cow=19. Cattle clips
# sometimes land on a neighboring livestock class, so use all three for recall.
CATTLE_CLASS_IDS = [17, 18, 19]


def _get_yolo():
    global _yolo
    if _yolo is None:
        from ultralytics import YOLO
        _yolo = YOLO('yolov8n.pt')
        logger.info("YOLOv8n loaded")
    return _yolo


# ---------------------------------------------------------------------------
# Public: single-animal tracking
# ---------------------------------------------------------------------------

def extract_pose_keypoints(video_path, sample_fps=5, min_frames=8):
    """Track the primary animal in a single-animal video clip."""
    tracks = _run_yolo_tracking(video_path, sample_fps=sample_fps)
    if not tracks:
        logger.warning("extract_pose_keypoints: no tracks found in %s", video_path)
        return _empty_pose_data(sample_fps)

    best = max(tracks.values(), key=lambda t: len(t['detections']))
    if len(best['detections']) < min_frames:
        return _empty_pose_data(sample_fps)

    return _build_pose_data(best['detections'], sample_fps)


# ---------------------------------------------------------------------------
# Public: multi-animal tracking (herd recording flow)
# ---------------------------------------------------------------------------

def track_multiple_blobs(video_path, max_animals=20, sample_fps=5,
                         max_duration_seconds=3600, max_wall_seconds=None,
                         min_frames=10, snapshots_dir=None):
    """Track individual animals in a herd recording using YOLOv8.

    Returns:
        dict: { animal_index (int, 1-based) -> pose_data dict }
              pose_data includes 'snapshot_filename', 'snapshot_bbox',
              'snapshot_confidence', 'snapshot_frame_sec' when snapshots_dir is given.
    """
    tracks = _run_yolo_tracking(
        video_path,
        sample_fps=sample_fps,
        max_duration_seconds=max_duration_seconds,
        max_wall_seconds=max_wall_seconds,
    )

    survivors, effective_min = _surviving_tracks(tracks, min_frames, max_animals)

    if not survivors:
        logger.warning(
            "track_multiple_blobs: YOLO found no usable cattle tracks; trying motion fallback"
        )
        tracks = _run_motion_tracking(
            video_path,
            sample_fps=sample_fps,
            max_duration_seconds=max_duration_seconds,
            max_wall_seconds=max_wall_seconds,
        )
        survivors, effective_min = _surviving_tracks(tracks, min_frames, max_animals)

    logger.info(
        "track_multiple_blobs: %d raw tracks → %d animals (min_frames=%d)",
        len(tracks), len(survivors), effective_min,
    )

    snapshot_info = {}
    if snapshots_dir and survivors:
        indexed = [(idx, t) for idx, t in enumerate(survivors, start=1)]
        snapshot_info = _save_animal_snapshots(video_path, indexed, snapshots_dir)

    result = {}
    for idx, t in enumerate(survivors, start=1):
        pose_data = _build_pose_data(t['detections'], sample_fps)
        info = snapshot_info.get(idx, {})
        pose_data['snapshot_filename']  = info.get('filename')
        pose_data['snapshot_bbox']      = info.get('bbox')
        pose_data['snapshot_confidence'] = info.get('confidence')
        pose_data['snapshot_frame_sec'] = info.get('frame_sec')
        result[idx] = pose_data
    return result


def _surviving_tracks(tracks, min_frames, max_animals):
    if not tracks:
        return [], min_frames

    total_sampled = sum(len(t['detections']) for t in tracks.values()) or 1
    effective_min = max(
        1,
        min(min_frames, int(total_sampled / max(len(tracks), 1) * 0.10) or 1),
    )
    survivors = [t for t in tracks.values() if len(t['detections']) >= effective_min]
    survivors.sort(key=lambda t: len(t['detections']), reverse=True)
    return survivors[:max_animals], effective_min


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

def _run_yolo_tracking(video_path, sample_fps=5, max_duration_seconds=3600,
                       max_wall_seconds=None):
    """Run YOLOv8 on sampled frames and return simple center-matched tracks.

    Returns:
        dict: {
            track_id -> {
                'detections': [(cx, cy, w, h, conf), ...],
                'frame_idxs': [...]
            }
        }
    """
    yolo = _get_yolo()
    import time
    started_at = time.monotonic()

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        logger.error("_run_yolo_tracking: cannot open %s", video_path)
        return {}

    video_fps    = cap.get(cv2.CAP_PROP_FPS) or 30.0
    sample_every = max(1, int(round(video_fps / sample_fps)))
    max_frames   = int(max_duration_seconds * video_fps)

    tracks    = defaultdict(lambda: {'detections': [], 'frame_idxs': []})
    last_centers = {}
    next_id = 1
    frame_idx = 0

    while frame_idx < max_frames:
        if max_wall_seconds and time.monotonic() - started_at > max_wall_seconds:
            logger.warning(
                "_run_yolo_tracking: stopped after %.1fs wall-clock cap for %s",
                time.monotonic() - started_at, video_path,
            )
            break

        ret, frame = cap.read()
        if not ret:
            break

        if frame_idx % sample_every == 0:
            results = yolo.predict(
                frame,
                classes=CATTLE_CLASS_IDS,
                conf=0.15,
                verbose=False,
            )
            if results and results[0].boxes is not None:
                boxes = results[0].boxes
                confs = boxes.conf.cpu().numpy() if boxes.conf is not None else []
                detections = []
                for box, conf in zip(boxes.xyxy.cpu().numpy(), confs):
                    x1, y1, x2, y2 = box
                    cx = (x1 + x2) / 2
                    cy = (y1 + y2) / 2
                    w  = x2 - x1
                    h  = y2 - y1
                    detections.append((float(cx), float(cy), float(w), float(h), float(conf)))

                detections.sort(key=lambda d: d[2] * d[3], reverse=True)
                used_ids = set()
                for cx, cy, w, h, conf in detections[:20]:
                    track_id = _nearest_track_id(cx, cy, last_centers, used_ids)
                    if track_id is None:
                        track_id = next_id
                        next_id += 1
                    used_ids.add(track_id)
                    last_centers[track_id] = (cx, cy)
                    tracks[track_id]['detections'].append((cx, cy, w, h, conf))
                    tracks[track_id]['frame_idxs'].append(frame_idx)

        frame_idx += 1

    cap.release()
    return dict(tracks)


def _run_motion_tracking(video_path, sample_fps=2, max_duration_seconds=180,
                         max_wall_seconds=None):
    """Fallback tracker based on moving foreground blobs.

    This is intentionally conservative and only runs when YOLO produces no
    usable cattle tracks. It gives the gait model real centroid/bbox movement
    instead of leaving the report empty.
    """
    import time

    started_at = time.monotonic()
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        logger.error("_run_motion_tracking: cannot open %s", video_path)
        return {}

    video_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    sample_every = max(1, int(round(video_fps / sample_fps)))
    max_frames = int(max_duration_seconds * video_fps)
    frame_area = (cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 640) * (
        cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 480
    )
    min_area = max(900.0, frame_area * 0.01)

    bg = cv2.createBackgroundSubtractorMOG2(
        history=max(20, int(sample_fps * 20)),
        varThreshold=32,
        detectShadows=True,
    )
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))

    tracks = defaultdict(lambda: {'detections': [], 'frame_idxs': []})
    last_centers = {}
    next_id = 1
    frame_idx = 0

    while frame_idx < max_frames:
        if max_wall_seconds and time.monotonic() - started_at > max_wall_seconds:
            logger.warning(
                "_run_motion_tracking: stopped after %.1fs wall-clock cap for %s",
                time.monotonic() - started_at, video_path,
            )
            break

        ret, frame = cap.read()
        if not ret:
            break

        if frame_idx % sample_every == 0:
            small = cv2.GaussianBlur(frame, (5, 5), 0)
            fg = bg.apply(small)
            _, fg = cv2.threshold(fg, 200, 255, cv2.THRESH_BINARY)
            fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, kernel)
            fg = cv2.morphologyEx(fg, cv2.MORPH_CLOSE, kernel, iterations=2)

            contours, _ = cv2.findContours(fg, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            boxes = []
            for contour in contours:
                area = cv2.contourArea(contour)
                if area < min_area:
                    continue
                x, y, w, h = cv2.boundingRect(contour)
                if w < 20 or h < 20:
                    continue
                boxes.append((x, y, w, h, area))

            boxes.sort(key=lambda b: b[4], reverse=True)
            used_ids = set()
            for x, y, w, h, area in boxes[:12]:
                cx = x + w / 2
                cy = y + h / 2
                track_id = _nearest_track_id(cx, cy, last_centers, used_ids)
                if track_id is None:
                    track_id = next_id
                    next_id += 1
                used_ids.add(track_id)
                last_centers[track_id] = (cx, cy)
                tracks[track_id]['detections'].append(
                    (float(cx), float(cy), float(w), float(h), 0.35)
                )
                tracks[track_id]['frame_idxs'].append(frame_idx)

        frame_idx += 1

    cap.release()
    return dict(tracks)


def _nearest_track_id(cx, cy, last_centers, used_ids, max_distance=140):
    best_id = None
    best_dist = max_distance
    for track_id, (px, py) in last_centers.items():
        if track_id in used_ids:
            continue
        dist = float(np.hypot(cx - px, cy - py))
        if dist < best_dist:
            best_id = track_id
            best_dist = dist
    return best_id


def _best_frame_idx(detections, frame_idxs, video_fps):
    """Return (list_pos, frame_idx, confidence) for the highest-quality detection.

    Quality = bbox area × detection confidence. We also exclude the first and
    last 10 % of the track to avoid partial-entry/exit frames.
    """
    n = len(detections)
    margin = max(1, n // 10)
    candidates = range(margin, n - margin) if n > 2 * margin else range(n)

    best_pos, best_conf = 0, -1.0
    for i in candidates:
        cx, cy, w, h, conf = detections[i]
        quality = (w * h) * conf
        if quality > best_conf:
            best_conf = quality
            best_pos = i

    cx, cy, w, h, conf = detections[best_pos]
    return best_pos, frame_idxs[best_pos], float(conf)


def _save_animal_snapshots(video_path, indexed_survivors, snapshots_dir):
    """Capture the best-quality frame per animal and save as a raw JPEG.

    Selection criterion: largest (bbox area × YOLOv8 confidence) excluding
    the first/last 10 % of the track to avoid entry/exit frames.

    Frames are captured by sequential decode (not cap.set seek) because
    CAP_PROP_POS_FRAMES is unreliable on H.264/MP4 — it snaps to keyframes
    and can return dark or wrong frames.

    Returns:
        {animal_index: {
            'filename': str,
            'bbox': (x1, y1, x2, y2),
            'confidence': float,
            'frame_sec': float,
        }}
    """
    import os
    import uuid

    os.makedirs(snapshots_dir, exist_ok=True)

    cap = cv2.VideoCapture(video_path)
    video_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0

    # Pre-compute target frame index for every animal so we can do one pass.
    targets = {}  # frame_idx -> (animal_idx, list_pos, detections, conf)
    for animal_idx, track in indexed_survivors:
        frame_idxs = track.get('frame_idxs', [])
        detections = track['detections']
        if not frame_idxs:
            continue
        list_pos, chosen_frame_idx, conf = _best_frame_idx(
            detections, frame_idxs, video_fps
        )
        targets[chosen_frame_idx] = (animal_idx, list_pos, detections, conf)

    if not targets:
        cap.release()
        return {}

    max_target = max(targets)
    result = {}
    frame_idx = 0

    while frame_idx <= max_target:
        ret, frame = cap.read()
        if not ret:
            break

        if frame_idx in targets:
            animal_idx, list_pos, detections, conf = targets[frame_idx]

            # Auto-brighten underexposed frames using CLAHE on the L channel.
            gray_mean = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY).mean()
            if gray_mean < 60:
                clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
                lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
                lab[:, :, 0] = clahe.apply(lab[:, :, 0])
                frame = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)

            cx, cy, w, h = detections[list_pos][:4]
            x1, y1 = int(cx - w / 2), int(cy - h / 2)
            x2, y2 = int(cx + w / 2), int(cy + h / 2)
            frame_sec = frame_idx / video_fps

            filename = f'snapshot_{uuid.uuid4().hex[:10]}_a{animal_idx}.jpg'
            cv2.imwrite(os.path.join(snapshots_dir, filename), frame,
                        [cv2.IMWRITE_JPEG_QUALITY, 88])

            result[animal_idx] = {
                'filename':   filename,
                'bbox':       (x1, y1, x2, y2),
                'confidence': round(conf, 3),
                'frame_sec':  round(frame_sec, 2),
            }
            logger.debug(
                "Saved snapshot for animal %d → %s (conf=%.2f, t=%.1fs)",
                animal_idx, filename, conf, frame_sec,
            )

        frame_idx += 1

    cap.release()
    return result


def annotate_snapshot(snapshots_dir, filename, bbox, status, animal_idx,
                      confidence=None, frame_sec=None):
    """Draw a detection overlay on a real video frame.

    Overlay includes:
    - Thick colored bounding box
    - Corner bracket accents
    - Filled label bar: "Animal N — STATUS  conf%"
    - Frame timestamp in bottom-right corner
    """
    import os
    path = os.path.join(snapshots_dir, filename)
    frame = cv2.imread(path)
    if frame is None:
        logger.warning("annotate_snapshot: cannot read %s", path)
        return

    fh, fw = frame.shape[:2]
    x1, y1, x2, y2 = bbox
    x1, y1 = max(0, x1), max(0, y1)
    x2, y2 = min(fw - 1, x2), min(fh - 1, y2)

    # ── Color scheme ──────────────────────────────────────────────────
    if status == 'confirmed':
        color_bgr = (60, 76, 231)      # red  #e74c3c
        label_status = 'LAME — CONFIRMED'
    elif status == 'suspected':
        color_bgr = (35, 166, 245)     # orange  #f5a623
        label_status = 'SUSPECTED LAMENESS'
    else:
        color_bgr = (207, 228, 101)    # teal  #65E4CF
        label_status = 'NORMAL'

    # ── Bounding box ──────────────────────────────────────────────────
    box_thickness = max(2, int(min(fw, fh) / 180))
    cv2.rectangle(frame, (x1, y1), (x2, y2), color_bgr, box_thickness)

    # ── Corner brackets ───────────────────────────────────────────────
    bracket = max(14, int(min(x2 - x1, y2 - y1) * 0.12))
    bt = box_thickness + 1
    for (bx, by, sx, sy) in [
        (x1, y1,  1,  1),
        (x2, y1, -1,  1),
        (x1, y2,  1, -1),
        (x2, y2, -1, -1),
    ]:
        cv2.line(frame, (bx, by), (bx + sx * bracket, by), color_bgr, bt)
        cv2.line(frame, (bx, by), (bx, by + sy * bracket), color_bgr, bt)

    # ── Label bar ─────────────────────────────────────────────────────
    conf_pct = f'{int(confidence * 100)}%' if confidence is not None else ''
    label = f'Animal {animal_idx}  {label_status}'
    if conf_pct:
        label += f'  {conf_pct}'

    font       = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = max(0.45, min(fw, fh) / 1100)
    font_thick = max(1, box_thickness - 1)
    (tw, th), baseline = cv2.getTextSize(label, font, font_scale, font_thick)

    pad = 6
    bar_h = th + baseline + pad * 2
    bar_y1 = max(y1 - bar_h, 0)
    bar_y2 = bar_y1 + bar_h

    # Semi-transparent dark background
    overlay = frame.copy()
    cv2.rectangle(overlay, (x1, bar_y1), (x1 + tw + pad * 2, bar_y2),
                  (15, 15, 15), cv2.FILLED)
    cv2.addWeighted(overlay, 0.82, frame, 0.18, 0, frame)

    # Colored left accent stripe
    cv2.rectangle(frame, (x1, bar_y1), (x1 + 4, bar_y2), color_bgr, cv2.FILLED)

    # Label text
    cv2.putText(frame, label,
                (x1 + pad + 4, bar_y2 - baseline - pad // 2),
                font, font_scale, (255, 255, 255), font_thick, cv2.LINE_AA)

    # ── Timestamp (bottom-right of bbox) ──────────────────────────────
    if frame_sec is not None:
        mins  = int(frame_sec // 60)
        secs  = frame_sec % 60
        ts_text = f'@ {mins:02d}:{secs:05.2f}s'
        ts_scale = font_scale * 0.85
        (tsw, tsh), _ = cv2.getTextSize(ts_text, font, ts_scale, 1)
        ts_x = max(x1, x2 - tsw - pad)
        ts_y = min(fh - pad, y2 + tsh + pad)

        ts_ov = frame.copy()
        cv2.rectangle(ts_ov, (ts_x - pad, ts_y - tsh - pad),
                      (ts_x + tsw + pad, ts_y + pad),
                      (15, 15, 15), cv2.FILLED)
        cv2.addWeighted(ts_ov, 0.75, frame, 0.25, 0, frame)
        cv2.putText(frame, ts_text, (ts_x, ts_y),
                    font, ts_scale, (200, 200, 200), 1, cv2.LINE_AA)

    cv2.imwrite(path, frame, [cv2.IMWRITE_JPEG_QUALITY, 92])
    logger.debug("Annotated snapshot %s  status=%s conf=%s t=%s",
                 filename, status, confidence, frame_sec)


def _build_pose_data(detections, frame_rate):
    """Convert a list of (cx, cy, w, h[, conf]) detections into pose_data dict."""
    centroids = [(d[0], d[1]) for d in detections]
    bboxes    = [(d[2], d[3]) for d in detections]

    frames = [
        {
            'frame_index': i,
            'centroid':    {'x': cx, 'y': cy},
            'bbox':        {'w': bboxes[i][0], 'h': bboxes[i][1]},
            'confidence':  float(detections[i][4]) if len(detections[i]) > 4 else 0.9,
        }
        for i, (cx, cy) in enumerate(centroids)
    ]

    return {
        'total_frames': len(frames),
        'frame_rate':   frame_rate,
        'centroids':    centroids,
        'bboxes':       bboxes,
        'frames':       frames,
    }


def _empty_pose_data(frame_rate):
    return {
        'total_frames': 0,
        'frame_rate':   frame_rate,
        'centroids':    [],
        'bboxes':       [],
        'frames':       [],
    }
