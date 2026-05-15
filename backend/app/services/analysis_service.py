from datetime import datetime, timezone
from app import db
from app.models import AnalysisResult, DetectedAnimal
from app.ml.pose_estimator import extract_pose_keypoints, track_multiple_blobs
from app.ml.gait_analyzer import analyze_gait


def run_analysis(video):
    """Run the full analysis pipeline on a video.

    1. Extract pose keypoints from video frames
    2. Analyze gait patterns from keypoints
    3. Store and return the result
    """
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
            animals_data = track_multiple_blobs(recording.file_path)

            for animal_id, pose_data in animals_data.items():
                lameness_score, status = analyze_gait(pose_data, frame_rate=1)
                animal = DetectedAnimal(
                    recording_id=recording.id,
                    animal_index=animal_id,
                    lameness_score=lameness_score,
                    status=status,
                    analyzed_at=datetime.now(timezone.utc),
                )
                db.session.add(animal)

            recording.status = 'done'
            db.session.commit()
        except Exception:
            db.session.rollback()
            recording.status = 'failed'
            db.session.commit()
