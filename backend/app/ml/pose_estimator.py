"""Pose estimation and animal tracking module for cattle video analysis.

Single-animal tracking (extract_pose_keypoints) and multi-animal tracking
(track_multiple_blobs) both use YOLOv8 + ByteTrack for reliable per-animal
detection and ID assignment. This replaces the old MOG2 approach that was
fragmenting one cow body into multiple blobs.
"""

import logging
import cv2
import numpy as np
from collections import defaultdict

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# YOLO model — loaded once at import time
# ---------------------------------------------------------------------------

_yolo = None
COW_CLASS_ID = 19   # COCO class 19 = 'cow'


def _get_yolo():
    global _yolo
    if _yolo is None:
        from ultralytics import YOLO
        _yolo = YOLO('yolov8n.pt')   # ~6 MB, cached after first download
        logger.info("YOLOv8n loaded")
    return _yolo


# ---------------------------------------------------------------------------
# Public: single-animal tracking
# ---------------------------------------------------------------------------

def extract_pose_keypoints(video_path, sample_fps=5, min_frames=8):
    """Track the primary animal in a single-animal video clip.

    Returns the same dict shape expected by gait_analyzer.analyze_gait().
    """
    tracks = _run_yolo_tracking(video_path, sample_fps=sample_fps)
    if not tracks:
        logger.warning("extract_pose_keypoints: no tracks found in %s", video_path)
        return _empty_pose_data(sample_fps)

    # Pick the track with the most detections
    best = max(tracks.values(), key=lambda t: len(t['detections']))
    if len(best['detections']) < min_frames:
        return _empty_pose_data(sample_fps)

    return _build_pose_data(best['detections'], sample_fps)


# ---------------------------------------------------------------------------
# Public: multi-animal tracking (herd recording flow)
# ---------------------------------------------------------------------------

def track_multiple_blobs(video_path, max_animals=20, sample_fps=5,
                         max_duration_seconds=3600, min_frames=10,
                         snapshots_dir=None):
    """Track individual animals in a herd recording using YOLOv8 + ByteTrack.

    Returns:
        dict: { animal_index (int, 1-based) -> pose_data dict for analyze_gait() }
              pose_data includes 'snapshot_filename' key when snapshots_dir is given.
    """
    tracks = _run_yolo_tracking(
        video_path,
        sample_fps=sample_fps,
        max_duration_seconds=max_duration_seconds,
    )

    total_sampled = sum(len(t['detections']) for t in tracks.values()) or 1
    effective_min = max(min_frames, int(total_sampled / max(len(tracks), 1) * 0.10))

    survivors = [t for t in tracks.values() if len(t['detections']) >= effective_min]
    survivors.sort(key=lambda t: len(t['detections']), reverse=True)
    survivors = survivors[:max_animals]

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
        pose_data['snapshot_filename'] = info.get('filename')
        pose_data['snapshot_bbox'] = info.get('bbox')
        result[idx] = pose_data
    return result


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

def _run_yolo_tracking(video_path, sample_fps=5, max_duration_seconds=3600):
    """Run YOLOv8 + ByteTrack on a video and return raw track data.

    Returns:
        dict: { track_id -> {'detections': [(cx, cy, w, h), ...], 'frame_idxs': [...]} }
    """
    yolo = _get_yolo()

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        logger.error("_run_yolo_tracking: cannot open %s", video_path)
        return {}

    video_fps    = cap.get(cv2.CAP_PROP_FPS) or 30.0
    sample_every = max(1, int(round(video_fps / sample_fps)))
    max_frames   = int(max_duration_seconds * video_fps)

    tracks   = defaultdict(lambda: {'detections': [], 'frame_idxs': []})
    frame_idx = 0

    while frame_idx < max_frames:
        ret, frame = cap.read()
        if not ret:
            break

        if frame_idx % sample_every == 0:
            results = yolo.track(
                frame,
                classes=[COW_CLASS_ID],
                persist=True,
                tracker='bytetrack.yaml',
                verbose=False,
            )
            if results and results[0].boxes is not None:
                boxes = results[0].boxes
                if boxes.id is not None:
                    for box, tid in zip(boxes.xyxy.cpu().numpy(),
                                        boxes.id.cpu().numpy()):
                        x1, y1, x2, y2 = box
                        cx = (x1 + x2) / 2
                        cy = (y1 + y2) / 2
                        w  = x2 - x1
                        h  = y2 - y1
                        tracks[int(tid)]['detections'].append((float(cx), float(cy),
                                                               float(w),  float(h)))
                        tracks[int(tid)]['frame_idxs'].append(frame_idx)

        frame_idx += 1

    cap.release()
    return dict(tracks)


def _save_animal_snapshots(video_path, indexed_survivors, snapshots_dir):
    """Capture one representative frame per animal and save as a raw JPEG.

    indexed_survivors: list of (animal_index, track_dict) tuples.
    Returns {animal_index: {'filename': str, 'bbox': (x1, y1, x2, y2)}}.
    Annotation (colored bounding box) is applied later via annotate_snapshot()
    once the lameness status is known.
    """
    import os
    import uuid

    os.makedirs(snapshots_dir, exist_ok=True)
    cap = cv2.VideoCapture(video_path)
    result = {}

    for animal_idx, track in indexed_survivors:
        frame_idxs = track.get('frame_idxs', [])
        detections = track['detections']
        if not frame_idxs:
            continue

        mid = len(frame_idxs) // 2
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idxs[mid])
        ret, frame = cap.read()
        if not ret:
            continue

        cx, cy, w, h = detections[mid]
        x1, y1 = int(cx - w / 2), int(cy - h / 2)
        x2, y2 = int(cx + w / 2), int(cy + h / 2)

        filename = f'snapshot_{uuid.uuid4().hex[:10]}_a{animal_idx}.jpg'
        cv2.imwrite(os.path.join(snapshots_dir, filename), frame,
                    [cv2.IMWRITE_JPEG_QUALITY, 88])
        result[animal_idx] = {'filename': filename, 'bbox': (x1, y1, x2, y2)}
        logger.debug("Saved raw snapshot for animal %d → %s", animal_idx, filename)

    cap.release()
    return result


def annotate_snapshot(snapshots_dir, filename, bbox, status, animal_idx):
    """Draw a colored bounding box on a snapshot based on lameness status.

    Modifies the JPEG file in-place. Call this after analyze_gait() returns
    the status so the box color matches the actual finding.
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

    if status == 'confirmed':
        color_bgr = (60, 76, 231)     # #e74c3c  red
        label_text = f'Animal {animal_idx}  LAME (confirmed)'
    elif status == 'suspected':
        color_bgr = (35, 166, 245)    # #f5a623  orange
        label_text = f'Animal {animal_idx}  SUSPECTED'
    else:
        color_bgr = (207, 228, 101)   # #65E4CF  teal
        label_text = f'Animal {animal_idx}  Normal'

    thickness = max(3, int(min(fw, fh) / 160))
    cv2.rectangle(frame, (x1, y1), (x2, y2), color_bgr, thickness)

    font = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = max(0.55, min(fw, fh) / 900)
    (tw, th), _ = cv2.getTextSize(label_text, font, font_scale, 2)
    label_y = max(y1 - th - 12, 0)
    cv2.rectangle(frame, (x1, label_y), (x1 + tw + 10, label_y + th + 10),
                  color_bgr, cv2.FILLED)
    cv2.putText(frame, label_text, (x1 + 5, label_y + th + 3),
                font, font_scale, (255, 255, 255), 2, cv2.LINE_AA)

    cv2.imwrite(path, frame, [cv2.IMWRITE_JPEG_QUALITY, 90])
    logger.debug("Annotated snapshot %s status=%s", filename, status)


def _build_pose_data(detections, frame_rate):
    """Convert a list of (cx, cy, w, h) detections into the pose_data dict."""
    centroids = [(d[0], d[1]) for d in detections]
    bboxes    = [(d[2], d[3]) for d in detections]   # (w, h) per frame

    frames = [
        {
            'frame_index': i,
            'centroid':    {'x': cx, 'y': cy},
            'bbox':        {'w': bboxes[i][0], 'h': bboxes[i][1]},
            'confidence':  0.90,
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
