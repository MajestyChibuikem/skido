import os
from datetime import timedelta

basedir = os.path.abspath(os.path.dirname(__file__))
is_vercel = os.environ.get('VERCEL') == '1'

# Render and other hosted Linux environments often do not allow writes to the
# default user config directories used by ML/plotting libraries.
if os.name != 'nt':
    os.environ.setdefault('YOLO_CONFIG_DIR', '/tmp/Ultralytics')
    os.environ.setdefault('MPLCONFIGDIR', '/tmp/matplotlib')


class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-secret-key')

    # Database — Railway provides DATABASE_URL; fix postgres:// → postgresql+psycopg:// for SQLAlchemy + psycopg3
    _default_sqlite_path = '/tmp/skido.db' if is_vercel else os.path.join(basedir, '..', 'skido.db')
    _db_url = os.environ.get('DATABASE_URL', 'sqlite:///' + _default_sqlite_path)
    if _db_url.startswith('postgres://'):
        _db_url = _db_url.replace('postgres://', 'postgresql+psycopg://', 1)
    elif _db_url.startswith('postgresql://'):
        _db_url = _db_url.replace('postgresql://', 'postgresql+psycopg://', 1)
    SQLALCHEMY_DATABASE_URI = _db_url
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    _default_upload_folder = '/tmp/uploads' if is_vercel else os.path.join(basedir, '..', 'uploads')
    UPLOAD_FOLDER = os.environ.get('UPLOAD_FOLDER', _default_upload_folder)
    MAX_CONTENT_LENGTH = int(os.environ.get('MAX_CONTENT_LENGTH', 100 * 1024 * 1024))  # 100MB default
    ALLOWED_EXTENSIONS = {'mp4', 'avi', 'mov', 'mkv', 'webm'}

    # Herd recording analysis is CPU-heavy. Keep production defaults bounded so
    # a long recording cannot monopolize the web worker indefinitely.
    TRACK_SAMPLE_FPS = float(os.environ.get('TRACK_SAMPLE_FPS', 1))
    TRACK_MAX_DURATION_SECONDS = int(os.environ.get('TRACK_MAX_DURATION_SECONDS', 120))
    TRACK_MAX_ANIMALS = int(os.environ.get('TRACK_MAX_ANIMALS', 12))
    TRACK_MIN_FRAMES = int(os.environ.get('TRACK_MIN_FRAMES', 3))

    # JWT Configuration
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'jwt-dev-secret')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=15)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)
    JWT_TOKEN_LOCATION = ['headers']
