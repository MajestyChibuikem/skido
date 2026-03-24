import os
import uuid
from flask import Blueprint, request, jsonify, current_app, send_from_directory
from werkzeug.utils import secure_filename
from app import db
from app.models import Video, Cattle

video_bp = Blueprint('video', __name__)


def allowed_file(filename):
    return '.' in filename and \
        filename.rsplit('.', 1)[1].lower() in current_app.config['ALLOWED_EXTENSIONS']


@video_bp.route('/upload', methods=['POST'])
def upload_video():
    if 'video' not in request.files:
        return jsonify({'error': 'No video file provided'}), 400

    file = request.files['video']
    cattle_id = request.form.get('cattle_id')

    if not cattle_id:
        return jsonify({'error': 'cattle_id is required'}), 400

    cattle = db.session.get(Cattle, int(cattle_id))
    if not cattle:
        return jsonify({'error': 'Cattle not found'}), 404

    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    if not allowed_file(file.filename):
        return jsonify({'error': 'File type not allowed'}), 400

    # Generate unique filename
    original_filename = secure_filename(file.filename)
    ext = original_filename.rsplit('.', 1)[1].lower()
    unique_filename = f"{uuid.uuid4().hex}.{ext}"
    file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], unique_filename)

    file.save(file_path)

    video = Video(
        cattle_id=int(cattle_id),
        filename=unique_filename,
        original_filename=original_filename,
        file_path=file_path,
    )
    db.session.add(video)
    db.session.commit()

    return jsonify(video.to_dict()), 201


@video_bp.route('/<int:video_id>', methods=['GET'])
def get_video(video_id):
    video = db.session.get(Video, video_id)
    if not video:
        return jsonify({'error': 'Video not found'}), 404
    return jsonify(video.to_dict())


@video_bp.route('/<int:video_id>/stream', methods=['GET'])
def stream_video(video_id):
    video = db.session.get(Video, video_id)
    if not video:
        return jsonify({'error': 'Video not found'}), 404
    return send_from_directory(
        current_app.config['UPLOAD_FOLDER'],
        video.filename,
    )


@video_bp.route('/cattle/<int:cattle_id>', methods=['GET'])
def list_cattle_videos(cattle_id):
    cattle = db.session.get(Cattle, cattle_id)
    if not cattle:
        return jsonify({'error': 'Cattle not found'}), 404

    videos = Video.query.filter_by(cattle_id=cattle_id).order_by(Video.upload_date.desc()).all()
    return jsonify([v.to_dict() for v in videos])


@video_bp.route('/<int:video_id>', methods=['DELETE'])
def delete_video(video_id):
    video = db.session.get(Video, video_id)
    if not video:
        return jsonify({'error': 'Video not found'}), 404

    # Remove file from disk
    if os.path.exists(video.file_path):
        os.remove(video.file_path)

    db.session.delete(video)
    db.session.commit()
    return jsonify({'message': 'Video deleted successfully'})
