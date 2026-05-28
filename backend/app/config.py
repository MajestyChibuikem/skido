import os
from datetime import timedelta

basedir = os.path.abspath(os.path.dirname(__file__))
is_vercel = os.environ.get('VERCEL') == '1'


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

    # JWT Configuration
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'jwt-dev-secret')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=15)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)
    JWT_TOKEN_LOCATION = ['headers']
