from flask import Flask, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager

db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()


def create_app():
    app = Flask(__name__)
    app.config.from_object('app.config.Config')

    # Initialize extensions — CORS first so it covers all responses including errors
    CORS(app,
         origins=["http://localhost:3000"],
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

    # Ensure upload folder exists
    import os
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

    # Register blueprints
    from app.routes.auth import auth_bp
    from app.routes.cattle import cattle_bp
    from app.routes.video import video_bp
    from app.routes.analysis import analysis_bp

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(cattle_bp, url_prefix='/api/cattle')
    app.register_blueprint(video_bp, url_prefix='/api/videos')
    app.register_blueprint(analysis_bp, url_prefix='/api/analysis')

    # Create tables
    with app.app_context():
        from app import models  # noqa: F401
        db.create_all()

    return app
