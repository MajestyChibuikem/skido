"""Pose estimation and motion tracking module for cattle video analysis.

Uses ffmpeg (via subprocess) + numpy/scipy for motion-based centroid tracking.
This matches the OpenCV-based approach used during SVM training, but has no
dependency on cv2 — only numpy, scipy, and a system ffmpeg installation.
"""

import subprocess
import numpy as np
from scipy import ndimage


def extract_pose_keypoints(video_path, max_frames=100, frame_rate=30):
    """Extract motion tracking data and keypoint trajectories from a video.

    Args:
        video_path: Path to the video file.
        max_frames: Maximum number of frames to process.
        frame_rate: Frames per second (used for speed calculations downstream).

    Returns:
        dict with:
            'total_frames'  : int
            'frame_rate'    : int
            'centroids'     : list of (cx, cy) tuples — cattle centroid per frame
            'frames'        : list of per-frame dicts with 'frame_index' and 'keypoints'
    """
    centroids = _track_centroids(video_path, max_frames=max_frames)
    num_frames = len(centroids)

    frames = []
    for i, (cx, cy) in enumerate(centroids):
        frames.append({
            'frame_index': i,
            'centroid': {'x': cx, 'y': cy},
            'keypoints': _placeholder_keypoints(cx, cy),
            'confidence': 0.85,
        })

    return {
        'total_frames': num_frames,
        'frame_rate': frame_rate,
        'centroids': centroids,
        'frames': frames,
    }


def _track_centroids(video_path, max_frames=100):
    """Track the cattle centroid using frame-difference motion detection.

    Replicates the OpenCV-based process_video_for_tracking() used during
    SVM training, implemented with ffmpeg + numpy + scipy.

    Returns:
        list of (cx, cy) tuples, one per processed frame.
    """
    width, height = _get_video_dimensions(video_path)
    if width is None:
        return []

    frames = _read_frames(video_path, max_frames=max_frames, width=width, height=height)
    if len(frames) < 2:
        return []

    tracking_data = []

    # Convert to grayscale and apply Gaussian blur (sigma≈4 ≈ kernel 21,21 in cv2)
    gray_frames = [_to_gray(f) for f in frames]
    blur_frames = [ndimage.gaussian_filter(g.astype(np.float32), sigma=4) for g in gray_frames]

    for i in range(1, len(blur_frames)):
        prev = blur_frames[i - 1]
        curr = blur_frames[i]

        # Frame difference + threshold (matches cv2.absdiff + threshold 25)
        diff  = np.abs(curr - prev)
        thresh = (diff > 25).astype(np.uint8)

        # Dilate (2 iterations with 3×3 structuring element)
        struct = ndimage.generate_binary_structure(2, 2)
        dilated = ndimage.binary_dilation(thresh, structure=struct, iterations=2)

        # Label connected regions and find the largest (= the cattle)
        labeled, num_features = ndimage.label(dilated)
        if num_features == 0:
            tracking_data.append(tracking_data[-1] if tracking_data else (0, 0))
            continue

        sizes = ndimage.sum(dilated, labeled, range(1, num_features + 1))
        largest_label = int(np.argmax(sizes)) + 1
        largest_size  = sizes[largest_label - 1]

        if largest_size < 500:
            tracking_data.append(tracking_data[-1] if tracking_data else (0, 0))
            continue

        # Centroid of the largest region
        cy_f, cx_f = ndimage.center_of_mass(dilated, labeled, largest_label)
        tracking_data.append((int(cx_f), int(cy_f)))

    return tracking_data


def _get_video_dimensions(video_path):
    """Return (width, height) of the video using ffprobe."""
    try:
        result = subprocess.run(
            [
                'ffprobe', '-v', 'error',
                '-select_streams', 'v:0',
                '-show_entries', 'stream=width,height',
                '-of', 'csv=p=0',
                video_path,
            ],
            capture_output=True, text=True, timeout=10,
        )
        parts = result.stdout.strip().split(',')
        return int(parts[0]), int(parts[1])
    except Exception:
        return None, None


def _read_frames(video_path, max_frames, width, height):
    """Read up to max_frames raw BGR frames from video using ffmpeg."""
    try:
        cmd = [
            'ffmpeg', '-v', 'error',
            '-i', video_path,
            '-vframes', str(max_frames + 1),
            '-f', 'rawvideo',
            '-pix_fmt', 'bgr24',
            'pipe:1',
        ]
        result = subprocess.run(cmd, capture_output=True, timeout=60)
        raw = result.stdout
        frame_size = width * height * 3
        n_frames = len(raw) // frame_size
        frames = []
        for i in range(n_frames):
            chunk = raw[i * frame_size:(i + 1) * frame_size]
            frame = np.frombuffer(chunk, dtype=np.uint8).reshape(height, width, 3)
            frames.append(frame)
        return frames
    except Exception:
        return []


def _to_gray(bgr_frame):
    """Convert BGR frame to grayscale using standard luminance weights."""
    return (0.114 * bgr_frame[:, :, 0] +
            0.587 * bgr_frame[:, :, 1] +
            0.299 * bgr_frame[:, :, 2])


def track_multiple_blobs(video_path, max_blobs=3, sample_fps=1, max_frames=3600):
    """Track up to max_blobs animals in a long recording.

    Samples the video at sample_fps (default 1 fps) so a 1-hour feed
    produces ~3600 frames — manageable for the MVP ceiling.

    Returns:
        dict: { animal_id (int, 1-based) -> pose_data dict compatible with analyze_gait() }
    """
    width, height = _get_video_dimensions(video_path)
    if width is None:
        return {}

    frames = _read_frames_sampled(video_path, sample_fps=sample_fps,
                                   max_frames=max_frames, width=width, height=height)
    if len(frames) < 2:
        return {}

    # Each tracked animal: centroids list, frames list, last known centroid
    tracked = {}   # { id -> {'centroids': [...], 'frames': [...], 'last': (cx, cy)} }
    next_id = 1
    MAX_DIST = 150  # px — max distance to still consider the same animal

    gray_frames = [_to_gray(f) for f in frames]
    blur_frames = [ndimage.gaussian_filter(g.astype(np.float32), sigma=4) for g in gray_frames]

    for frame_i in range(1, len(blur_frames)):
        prev = blur_frames[frame_i - 1]
        curr = blur_frames[frame_i]

        diff = np.abs(curr - prev)
        thresh = (diff > 25).astype(np.uint8)

        struct = ndimage.generate_binary_structure(2, 2)
        dilated = ndimage.binary_dilation(thresh, structure=struct, iterations=2)

        labeled, num_features = ndimage.label(dilated)
        if num_features == 0:
            continue

        sizes = ndimage.sum(dilated, labeled, range(1, num_features + 1))

        # Top-N blobs by area, ignoring noise (< 500 px)
        candidates = sorted(
            [(i + 1, sizes[i]) for i in range(num_features) if sizes[i] >= 500],
            key=lambda x: x[1], reverse=True
        )[:max_blobs]

        frame_blobs = []
        for label_idx, _ in candidates:
            cy_f, cx_f = ndimage.center_of_mass(dilated, labeled, label_idx)
            frame_blobs.append((int(cx_f), int(cy_f)))

        # Greedy nearest-centroid matching to persistent IDs
        matched_ids = set()
        for cx, cy in frame_blobs:
            best_id, best_dist = None, MAX_DIST
            for aid, animal in tracked.items():
                if aid in matched_ids:
                    continue
                lx, ly = animal['last']
                d = ((cx - lx) ** 2 + (cy - ly) ** 2) ** 0.5
                if d < best_dist:
                    best_dist, best_id = d, aid

            if best_id is not None:
                matched_ids.add(best_id)
                tracked[best_id]['centroids'].append((cx, cy))
                tracked[best_id]['last'] = (cx, cy)
                tracked[best_id]['frames'].append({
                    'frame_index': frame_i,
                    'centroid': {'x': cx, 'y': cy},
                    'keypoints': _placeholder_keypoints(cx, cy),
                    'confidence': 0.85,
                })
            elif len(tracked) < max_blobs:
                aid = next_id
                next_id += 1
                tracked[aid] = {
                    'centroids': [(cx, cy)],
                    'last': (cx, cy),
                    'frames': [{
                        'frame_index': frame_i,
                        'centroid': {'x': cx, 'y': cy},
                        'keypoints': _placeholder_keypoints(cx, cy),
                        'confidence': 0.85,
                    }],
                }

    return {
        aid: {
            'total_frames': len(data['frames']),
            'frame_rate': sample_fps,
            'centroids': data['centroids'],
            'frames': data['frames'],
        }
        for aid, data in tracked.items()
    }


def _read_frames_sampled(video_path, sample_fps, max_frames, width, height):
    """Read frames at sample_fps fps using ffmpeg's fps filter."""
    try:
        cmd = [
            'ffmpeg', '-v', 'error',
            '-i', video_path,
            '-vf', f'fps={sample_fps}',
            '-vframes', str(max_frames + 1),
            '-f', 'rawvideo',
            '-pix_fmt', 'bgr24',
            'pipe:1',
        ]
        result = subprocess.run(cmd, capture_output=True, timeout=1200)
        raw = result.stdout
        frame_size = width * height * 3
        frames = []
        for i in range(len(raw) // frame_size):
            chunk = raw[i * frame_size:(i + 1) * frame_size]
            frames.append(np.frombuffer(chunk, dtype=np.uint8).reshape(height, width, 3))
        return frames
    except Exception:
        return []


def _placeholder_keypoints(cx, cy):
    """Generate approximate keypoint positions relative to a centroid.

    Positional estimates only, used for symmetry scoring until a trained
    YOLOv8-pose model is available.
    """
    return {
        'head':                {'x': cx,      'y': cy - 80, 'confidence': 0.85},
        'neck':                {'x': cx,      'y': cy - 60, 'confidence': 0.85},
        'spine_front':         {'x': cx - 30, 'y': cy - 20, 'confidence': 0.80},
        'spine_mid':           {'x': cx,      'y': cy,      'confidence': 0.85},
        'spine_rear':          {'x': cx + 30, 'y': cy - 20, 'confidence': 0.80},
        'tail_base':           {'x': cx + 60, 'y': cy,      'confidence': 0.75},
        'front_left_shoulder': {'x': cx - 40, 'y': cy - 10, 'confidence': 0.80},
        'front_left_knee':     {'x': cx - 45, 'y': cy + 30, 'confidence': 0.75},
        'front_left_hoof':     {'x': cx - 50, 'y': cy + 70, 'confidence': 0.70},
        'front_right_shoulder':{'x': cx - 40, 'y': cy - 10, 'confidence': 0.80},
        'front_right_knee':    {'x': cx - 35, 'y': cy + 30, 'confidence': 0.75},
        'front_right_hoof':    {'x': cx - 30, 'y': cy + 70, 'confidence': 0.70},
        'rear_left_hip':       {'x': cx + 40, 'y': cy - 10, 'confidence': 0.80},
        'rear_left_knee':      {'x': cx + 45, 'y': cy + 30, 'confidence': 0.75},
        'rear_left_hoof':      {'x': cx + 50, 'y': cy + 70, 'confidence': 0.70},
        'rear_right_hip':      {'x': cx + 40, 'y': cy - 10, 'confidence': 0.80},
        'rear_right_knee':     {'x': cx + 35, 'y': cy + 30, 'confidence': 0.75},
        'rear_right_hoof':     {'x': cx + 30, 'y': cy + 70, 'confidence': 0.70},
    }
