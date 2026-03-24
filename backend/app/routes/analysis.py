from flask import Blueprint, jsonify
from app import db
from app.models import Video, AnalysisResult, Cattle
from app.services.analysis_service import run_analysis

analysis_bp = Blueprint('analysis', __name__)


@analysis_bp.route('/<int:video_id>', methods=['POST'])
def trigger_analysis(video_id):
    video = db.session.get(Video, video_id)
    if not video:
        return jsonify({'error': 'Video not found'}), 404

    # Check if analysis already exists
    existing = AnalysisResult.query.filter_by(video_id=video_id).first()
    if existing:
        return jsonify({'error': 'Analysis already exists for this video', 'result': existing.to_dict()}), 409

    result = run_analysis(video)
    return jsonify(result.to_dict()), 201


@analysis_bp.route('/<int:video_id>', methods=['GET'])
def get_analysis(video_id):
    result = AnalysisResult.query.filter_by(video_id=video_id).first()
    if not result:
        return jsonify({'error': 'No analysis found for this video'}), 404
    return jsonify(result.to_dict())


@analysis_bp.route('/dashboard/stats', methods=['GET'])
def dashboard_stats():
    total_cattle = Cattle.query.count()
    total_videos = Video.query.count()
    total_analyses = AnalysisResult.query.count()
    suspected_cases = AnalysisResult.query.filter(
        AnalysisResult.status.in_(['suspected', 'confirmed'])
    ).count()
    normal_cases = AnalysisResult.query.filter_by(status='normal').count()

    return jsonify({
        'total_cattle': total_cattle,
        'total_videos': total_videos,
        'total_analyses': total_analyses,
        'suspected_cases': suspected_cases,
        'normal_cases': normal_cases,
    })
