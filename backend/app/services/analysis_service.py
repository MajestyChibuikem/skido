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


def create_demo_recording_results(recording, snapshots_dir=None):
    """Demo mode: create result row without any snapshot (frontend shows placeholder)."""
    score, status = _demo_prediction_from_name(recording.original_filename or recording.filename)
    animal = DetectedAnimal(
        recording_id=recording.id,
        animal_index=1,
        lameness_score=score,
        status=status,
        analyzed_at=datetime.now(timezone.utc),
        snapshot_filename=None,
        snapshot_confidence=None,
        snapshot_frame_sec=None,
    )
    recording.status = 'done'
    db.session.add(animal)
    db.session.commit()


def run_analysis(video):
    """Run the full analysis pipeline on a single-animal video."""
    if _is_vercel_without_ml():
        lameness_score, status = _demo_prediction_from_name(
            video.original_filename or video.filename
        )
        result = AnalysisResult(
            video_id=video.id,
            lameness_score=lameness_score,
            status=status,
            pose_data={'mode': 'demo'},
            analyzed_at=datetime.now(timezone.utc),
        )
        db.session.add(result)
        db.session.commit()
        return result

    from app.ml.pose_estimator import extract_pose_keypoints
    from app.ml.gait_analyzer import analyze_gait

    pose_data = extract_pose_keypoints(video.file_path)
    lameness_score, status = analyze_gait(pose_data)

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
    """Background job: track animals in a herd recording and classify each.

    Selects the best-quality frame per animal (highest confidence × bbox area),
    draws a real OpenCV detection overlay, and stores the annotated JPEG.
    """
    with app.app_context():
        from app.models import Recording
        recording = db.session.get(Recording, recording_id)
        if not recording:
            return

        recording.status = 'processing'
        db.session.commit()
        logger.info("recording %d: analysis started", recording_id)

        try:
            import time
            from flask import current_app

            if _is_vercel_without_ml():
                create_demo_recording_results(recording, current_app.config['UPLOAD_FOLDER'])
                return

            from app.ml.pose_estimator import track_multiple_blobs, annotate_snapshot
            from app.ml.gait_analyzer import analyze_gait

            snapshots_dir = current_app.config['UPLOAD_FOLDER']

            t0 = time.time()
            animals_data = track_multiple_blobs(
                recording.file_path,
                snapshots_dir=snapshots_dir,
            )
            logger.info(
                "recording %d: tracking done in %.1fs — %d animals",
                recording_id, time.time() - t0, len(animals_data),
            )

            for animal_id, pose_data in animals_data.items():
                lameness_score, status = analyze_gait(pose_data, frame_rate=1)

                snapshot_filename  = pose_data.get('snapshot_filename')
                snapshot_bbox      = pose_data.get('snapshot_bbox')
                snapshot_confidence = pose_data.get('snapshot_confidence')
                snapshot_frame_sec  = pose_data.get('snapshot_frame_sec')

                if snapshot_filename and snapshot_bbox:
                    try:
                        annotate_snapshot(
                            snapshots_dir,
                            snapshot_filename,
                            snapshot_bbox,
                            status,
                            animal_id,
                            confidence=snapshot_confidence,
                            frame_sec=snapshot_frame_sec,
                        )
                    except Exception as ann_exc:
                        logger.warning(
                            "recording %d animal %d: annotation failed — %s",
                            recording_id, animal_id, ann_exc,
                        )

                    # Upload annotated JPEG to Cloudinary; fall back to local filename.
                    from app.storage import upload_snapshot
                    local_path = os.path.join(snapshots_dir, snapshot_filename)
                    public_id = snapshot_filename.rsplit('.', 1)[0]
                    cloud_url = upload_snapshot(local_path, public_id)
                    if cloud_url:
                        snapshot_filename = cloud_url
                        try:
                            os.remove(local_path)
                        except OSError:
                            pass

                animal = DetectedAnimal(
                    recording_id=recording.id,
                    animal_index=animal_id,
                    lameness_score=lameness_score,
                    status=status,
                    analyzed_at=datetime.now(timezone.utc),
                    snapshot_filename=snapshot_filename,
                    snapshot_confidence=snapshot_confidence,
                    snapshot_frame_sec=snapshot_frame_sec,
                )
                db.session.add(animal)
                logger.info(
                    "recording %d animal %d: score=%.1f status=%s conf=%s t=%ss",
                    recording_id, animal_id, lameness_score, status,
                    snapshot_confidence, snapshot_frame_sec,
                )

            recording.status = 'done'
            db.session.commit()

        except Exception as exc:
            logger.exception("recording %d: analysis failed — %s", recording_id, exc)
            db.session.rollback()
            recording.status = 'failed'
            db.session.commit()
