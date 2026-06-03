import os
import uuid
import threading
from datetime import datetime, timedelta, timezone

from flask import Blueprint, request, jsonify, current_app, send_from_directory
from app import db
from app.models import Recording, DetectedAnimal
from app.services.analysis_service import create_demo_recording_results, run_recording_analysis

recordings_bp = Blueprint('recordings', __name__)

_ALLOWED = {'mp4', 'avi', 'mov', 'mkv', 'webm'}


def _allowed(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in _ALLOWED


def _start_recording_analysis(recording_id):
    app = current_app._get_current_object()
    t = threading.Thread(target=run_recording_analysis, args=(app, recording_id), daemon=True)
    t.start()


def _mark_stale_processing_recordings():
    stale_after = current_app.config['PROCESSING_STALE_SECONDS']
    cutoff = datetime.now(timezone.utc) - timedelta(seconds=stale_after)
    stale = Recording.query.filter(Recording.status.in_(['pending', 'processing'])).all()
    changed = False

    for recording in stale:
        uploaded_at = recording.upload_date
        if uploaded_at and uploaded_at.tzinfo is None:
            uploaded_at = uploaded_at.replace(tzinfo=timezone.utc)
        if uploaded_at and uploaded_at < cutoff:
            recording.status = 'failed'
            changed = True

    if changed:
        db.session.commit()


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

    _start_recording_analysis(recording.id)

    return jsonify(recording.to_dict()), 202


@recordings_bp.route('', methods=['GET'])
def list_recordings():
    _mark_stale_processing_recordings()
    recordings = Recording.query.order_by(Recording.upload_date.desc()).all()
    return jsonify([r.to_dict() for r in recordings])


@recordings_bp.route('/<int:recording_id>', methods=['GET'])
def get_recording(recording_id):
    _mark_stale_processing_recordings()
    recording = db.session.get(Recording, recording_id)
    if not recording:
        return jsonify({'error': 'Recording not found'}), 404
    return jsonify(recording.to_dict())


@recordings_bp.route('/<int:recording_id>/retry', methods=['POST'])
def retry_recording(recording_id):
    _mark_stale_processing_recordings()
    recording = db.session.get(Recording, recording_id)
    if not recording:
        return jsonify({'error': 'Recording not found'}), 404
    if recording.status in ('pending', 'processing'):
        return jsonify({'error': 'Analysis is already running', 'recording': recording.to_dict()}), 409
    if not os.path.exists(recording.file_path):
        return jsonify({'error': 'Original recording file is no longer available'}), 410

    DetectedAnimal.query.filter_by(recording_id=recording.id).delete()
    recording.status = 'pending'
    db.session.commit()

    if os.environ.get('VERCEL') == '1':
        create_demo_recording_results(recording, current_app.config['UPLOAD_FOLDER'])
        return jsonify(recording.to_dict()), 200

    _start_recording_analysis(recording.id)
    return jsonify(recording.to_dict()), 202


@recordings_bp.route('/snapshots/<path:filename>', methods=['GET'])
def get_snapshot(filename):
    """Serve a saved animal snapshot JPEG."""
    upload_folder = current_app.config['UPLOAD_FOLDER']
    return send_from_directory(upload_folder, filename)
