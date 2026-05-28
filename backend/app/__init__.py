import os

from flask import Flask, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from sqlalchemy.exc import SQLAlchemyError
from werkzeug.exceptions import HTTPException

db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()


def create_app():
    app = Flask(__name__)
    app.config.from_object('app.config.Config')

    # Initialize extensions — CORS first so it covers all responses including errors
    default_origins = ','.join([
        'http://localhost:3000',
        'https://skido-one.vercel.app',
        'https://frontend-nine-sand-72.vercel.app',
        'https://backend-theta-eight-96.vercel.app',
    ])
    allowed_origins = os.environ.get('CORS_ORIGINS', default_origins).split(',')
    CORS(app,
         origins=allowed_origins,
         supports_credentials=True,
         allow_headers=["Content-Type", "Authorization"],
         methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)

    # JWT error handlers — must return proper JSON so CORS headers are attached
    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        return jsonify({'error': 'Token has expired'}), 401

    @jwt.invalid_token_loader
    def invalid_token_callback(error):
        return jsonify({'error': 'Invalid token'}), 401

    @jwt.unauthorized_loader
    def missing_token_callback(error):
        return jsonify({'error': 'Missing authorization token'}), 401

    @app.errorhandler(413)
    def payload_too_large(error):
        return jsonify({'error': 'Uploaded file is too large'}), 413

    @app.errorhandler(SQLAlchemyError)
    def database_error(error):
        db.session.rollback()
        return jsonify({'error': 'Database operation failed'}), 500

    @app.errorhandler(HTTPException)
    def http_error(error):
        return jsonify({'error': error.description}), error.code

    @app.errorhandler(Exception)
    def unhandled_error(error):
        app.logger.exception("Unhandled error: %s", error)
        return jsonify({'error': 'Server error'}), 500

    # Ensure upload folder exists
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

    # Register blueprints
    from app.routes.auth import auth_bp
    from app.routes.cattle import cattle_bp
    from app.routes.video import video_bp
    from app.routes.analysis import analysis_bp
    from app.routes.recordings import recordings_bp

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(cattle_bp, url_prefix='/api/cattle')
    app.register_blueprint(video_bp, url_prefix='/api/videos')
    app.register_blueprint(analysis_bp, url_prefix='/api/analysis')
    app.register_blueprint(recordings_bp, url_prefix='/api/recordings')

    @app.route('/')
    def index():
        return jsonify({'status': 'ok', 'service': 'skido-api'})

    @app.route('/api/health')
    def health():
        db_uri = app.config['SQLALCHEMY_DATABASE_URI']
        database = 'postgres' if db_uri.startswith('postgresql') else 'sqlite'
        return jsonify({'status': 'ok', 'database': database})

    # Create tables
    with app.app_context():
        from app import models  # noqa: F401
        db.create_all()

    return app
