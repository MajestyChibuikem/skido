import os
from flask import current_app


def get_video_path(filename):
    """Get the full path for a video file."""
    return os.path.join(current_app.config['UPLOAD_FOLDER'], filename)


def delete_video_file(file_path):
    """Delete a video file from disk."""
    if os.path.exists(file_path):
        os.remove(file_path)
        return True
    return False
