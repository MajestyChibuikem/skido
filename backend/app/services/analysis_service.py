import logging
import os
import uuid
from datetime import datetime, timezone
from app import db
from app.models import AnalysisResult, DetectedAnimal

logger = logging.getLogger(__name__)


def _is_vercel_without_ml():
    return os.environ.get('VERCEL') == '1'


def _demo_prediction_from_name(filename=''):
    name = (filename or '').lower()
    if 'lame' in name or os.path.basename(name).startswith('l '):
        return 7.6, 'suspected'
    return 1.8, 'normal'


def _write_demo_snapshot(recording, status, snapshots_dir):
    if not snapshots_dir:
        return None

    os.makedirs(snapshots_dir, exist_ok=True)
    color = '#e74c3c' if status in {'suspected', 'confirmed'} else '#65E4CF'
    label = 'Affected cow' if status in {'suspected', 'confirmed'} else 'Normal cow'
    filename = f"snapshot_{recording.id}_{uuid.uuid4().hex}.svg"
    path = os.path.join(snapshots_dir, filename)
    original = recording.original_filename or recording.filename

    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
  <rect width="960" height="540" fill="#101820"/>
  <rect x="40" y="40" width="880" height="460" rx="12" fill="#1f2933"/>
  <text x="480" y="88" fill="#dbe7e4" font-family="Arial, sans-serif" font-size="28" font-weight="700" text-anchor="middle">Detected animal snapshot</text>
  <text x="480" y="124" fill="#9fb3ad" font-family="Arial, sans-serif" font-size="18" text-anchor="middle">{original}</text>
  <ellipse cx="480" cy="312" rx="210" ry="88" fill="#6b5b4d"/>
  <circle cx="680" cy="274" r="48" fill="#6b5b4d"/>
  <rect x="326" y="378" width="28" height="72" rx="10" fill="#5a4a3f"/>
  <rect x="438" y="386" width="28" height="72" rx="10" fill="#5a4a3f"/>
  <rect x="548" y="386" width="28" height="72" rx="10" fill="#5a4a3f"/>
  <rect x="650" y="374" width="28" height="72" rx="10" fill="#5a4a3f"/>
  <path d="M286 300 C238 284 210 250 196 224" stroke="#6b5b4d" stroke-width="20" stroke-linecap="round" fill="none"/>
  <rect x="245" y="172" width="520" height="270" rx="18" fill="none" stroke="{color}" stroke-width="12"/>
  <rect x="245" y="132" width="250" height="46" rx="8" fill="{color}"/>
  <text x="370" y="162" fill="#ffffff" font-family="Arial, sans-serif" font-size="22" font-weight="700" text-anchor="middle">{label}</text>
</svg>
"""
    with open(path, 'w', encoding='utf-8') as f:
        f.write(svg)
    return filename


def create_demo_recording_results(recording, snapshots_dir=None):
    score, status = _demo_prediction_from_name(recording.original_filename or recording.filename)
    snapshot_filename = _write_demo_snapshot(recording, status, snapshots_dir)
    animal = DetectedAnimal(
        recording_id=recording.id,
        animal_index=1,
        lameness_score=score,
        status=status,
        analyzed_at=datetime.now(timezone.utc),
        snapshot_filename=snapshot_filename,
    )
    recording.status = 'done'
    db.session.add(animal)
    db.session.commit()


def run_analysis(video):
    """Run the full analysis pipeline on a video.

    1. Extract pose keypoints from video frames
    2. Analyze gait patterns from keypoints
    3. Store and return the result
    """
    if _is_vercel_without_ml():
        lameness_score, status = _demo_prediction_from_name(video.original_filename or video.filename)
        result = AnalysisResult(
            video_id=video.id,
            lameness_score=lameness_score,
            status=status,
            pose_data={'mode': 'demo', 'reason': 'ML dependencies are not installed on Vercel'},
            analyzed_at=datetime.now(timezone.utc),
        )
        db.session.add(result)
        db.session.commit()
        return result

    from app.ml.pose_estimator import extract_pose_keypoints
    from app.ml.gait_analyzer import analyze_gait

    # Step 1: Extract pose keypoints
    pose_data = extract_pose_keypoints(video.file_path)

    # Step 2: Analyze gait for lameness indicators
    lameness_score, status = analyze_gait(pose_data)

    # Step 3: Save result
    result = AnalysisResult(
        video_id=video.id,
        lameness_score=lameness_score,
        status=status,
        pose_data=pose_data,
        analyzed_at=datetime.now(timezone.utc),
    )
    db.session.add(result)
    db.session.commit()

    return result


def run_recording_analysis(app, recording_id):
    """Background job: track up to 3 animals in a herd recording and classify each.

    Must be called in a daemon thread.  Receives the Flask app object so it can
    push its own app context (background threads don't inherit one automatically).
    """
    with app.app_context():
        from app.models import Recording  # local import — avoids circular import at module load
        recording = db.session.get(Recording, recording_id)
        if not recording:
            return

        recording.status = 'processing'
        db.session.commit()

        try:
            import time
            from flask import current_app
            if _is_vercel_without_ml():
                create_demo_recording_results(recording, current_app.config['UPLOAD_FOLDER'])
                return

            from app.ml.pose_estimator import track_multiple_blobs
            from app.ml.gait_analyzer import analyze_gait

            snapshots_dir = current_app.config['UPLOAD_FOLDER']

            t0 = time.time()
            animals_data = track_multiple_blobs(
                recording.file_path,
                snapshots_dir=snapshots_dir,
            )
            elapsed = time.time() - t0
            logger.info(
                "recording %d: tracking done in %.1fs — %d animals detected",
                recording_id, elapsed, len(animals_data),
            )

            for animal_id, pose_data in animals_data.items():
                lameness_score, status = analyze_gait(pose_data, frame_rate=1)
                logger.info(
                    "recording %d animal %d: %d frames, score=%.1f status=%s",
                    recording_id, animal_id, pose_data['total_frames'], lameness_score, status,
                )

                # Annotate snapshot with correct color now that we know the status
                snapshot_filename = pose_data.get('snapshot_filename')
                snapshot_bbox = pose_data.get('snapshot_bbox')
                if snapshot_filename and snapshot_bbox:
                    try:
                        from app.ml.pose_estimator import annotate_snapshot
                        annotate_snapshot(
                            snapshots_dir, snapshot_filename,
                            snapshot_bbox, status, animal_id,
                        )
                    except Exception as ann_exc:
                        logger.warning(
                            "recording %d animal %d: snapshot annotation failed — %s",
                            recording_id, animal_id, ann_exc,
                        )

                animal = DetectedAnimal(
                    recording_id=recording.id,
                    animal_index=animal_id,
                    lameness_score=lameness_score,
                    status=status,
                    analyzed_at=datetime.now(timezone.utc),
                    snapshot_filename=snapshot_filename,
                )
                db.session.add(animal)

            recording.status = 'done'
            db.session.commit()
        except Exception as exc:
            logger.exception("recording %d: analysis failed — %s", recording_id, exc)
            db.session.rollback()
            recording.status = 'failed'
            db.session.commit()
