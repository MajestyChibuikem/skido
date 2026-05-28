import os
import uuid
import threading

from flask import Blueprint, request, jsonify, current_app, send_from_directory
from app import db
from app.models import Recording
from app.services.analysis_service import create_demo_recording_results, run_recording_analysis

recordings_bp = Blueprint('recordings', __name__)

_ALLOWED = {'mp4', 'avi', 'mov', 'mkv', 'webm'}


def _allowed(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in _ALLOWED


@recordings_bp.route('/upload', methods=['POST'])
def upload_recording():
    if 'video' not in request.files:
        return jsonify({'error': 'No video file provided'}), 400

    file = request.files['video']
    if not file.filename or not _allowed(file.filename):
        return jsonify({'error': 'Invalid file type'}), 400

    ext = file.filename.rsplit('.', 1)[1].lower()
    filename = f"{uuid.uuid4().hex}.{ext}"
    file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
    file.save(file_path)

    recording = Recording(
        filename=filename,
        original_filename=file.filename,
        file_path=file_path,
        status='pending',
    )
    db.session.add(recording)
    db.session.commit()

    if os.environ.get('VERCEL') == '1':
        create_demo_recording_results(recording, current_app.config['UPLOAD_FOLDER'])
        return jsonify(recording.to_dict()), 201

    app = current_app._get_current_object()
    t = threading.Thread(target=run_recording_analysis, args=(app, recording.id), daemon=True)
    t.start()

    return jsonify(recording.to_dict()), 202


@recordings_bp.route('', methods=['GET'])
def list_recordings():
    recordings = Recording.query.order_by(Recording.upload_date.desc()).all()
    return jsonify([r.to_dict() for r in recordings])


@recordings_bp.route('/<int:recording_id>', methods=['GET'])
def get_recording(recording_id):
    recording = db.session.get(Recording, recording_id)
    if not recording:
        return jsonify({'error': 'Recording not found'}), 404
    return jsonify(recording.to_dict())


@recordings_bp.route('/snapshots/<path:filename>', methods=['GET'])
def get_snapshot(filename):
    """Serve a saved animal snapshot JPEG."""
    upload_folder = current_app.config['UPLOAD_FOLDER']
    return send_from_directory(upload_folder, filename)
