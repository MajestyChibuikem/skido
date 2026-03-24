from datetime import datetime, timezone
from app import db
from app.models import AnalysisResult
from app.ml.pose_estimator import extract_pose_keypoints
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
