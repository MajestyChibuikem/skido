import os

from flask import Blueprint, current_app, request, jsonify
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    get_jwt,
    jwt_required,
    get_jwt_identity,
)
from app import db
from app.models import User

auth_bp = Blueprint('auth', __name__)


def _normalize_email(email):
    return email.strip().lower()


def _using_ephemeral_vercel_db():
    return (
        os.environ.get('VERCEL') == '1'
        and current_app.config['SQLALCHEMY_DATABASE_URI'].startswith('sqlite:////tmp/')
    )


def _create_tokens(user):
    claims = {'email': user.email, 'name': user.name}
    return {
        'access_token': create_access_token(identity=str(user.id), additional_claims=claims),
        'refresh_token': create_refresh_token(identity=str(user.id), additional_claims=claims),
    }


def _auth_response(user):
    return {
        'user': user.to_dict(),
        **_create_tokens(user),
    }


@auth_bp.route('/signup', methods=['POST'])
def signup():
    data = request.get_json() or {}

    if not data or not data.get('email') or not data.get('password') or not data.get('name'):
        return jsonify({'error': 'Name, email, and password are required'}), 400

    email = _normalize_email(data['email'])
    name = data['name'].strip()

    if len(data['password']) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'Email already registered'}), 409

    user = User(email=email, name=name)
    user.set_password(data['password'])
    db.session.add(user)
    db.session.commit()

    return jsonify(_auth_response(user)), 201


@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json() or {}

    if not data or not data.get('email') or not data.get('password'):
        return jsonify({'error': 'Email and password are required'}), 400

    email = _normalize_email(data['email'])
    user = User.query.filter_by(email=email).first()
    if not user and _using_ephemeral_vercel_db():
        user = User(email=email, name=email.split('@')[0])
        user.set_password(data['password'])
        db.session.add(user)
        db.session.commit()

    if not user or not user.check_password(data['password']):
        return jsonify({'error': 'Invalid email or password'}), 401

    return jsonify(_auth_response(user)), 200


@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    identity = get_jwt_identity()
    user = User.query.get(int(identity))
    if not user and _using_ephemeral_vercel_db():
        claims = get_jwt()
        email = claims.get('email')
        name = claims.get('name') or (email.split('@')[0] if email else None)
        if email and name:
            user = User(email=email, name=name)
            user.set_password(os.urandom(24).hex())
            db.session.add(user)
            db.session.commit()

    if not user:
        return jsonify({'error': 'User not found'}), 404

    return jsonify(_auth_response(user)), 200


@auth_bp.route('/logout', methods=['POST'])
def logout():
    return jsonify({'message': 'Logged out'}), 200


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def me():
    identity = get_jwt_identity()
    user = User.query.get(int(identity))
    if not user and _using_ephemeral_vercel_db():
        claims = get_jwt()
        email = claims.get('email')
        name = claims.get('name') or (email.split('@')[0] if email else None)
        if email and name:
            user = User(email=email, name=name)
            user.set_password(os.urandom(24).hex())
            db.session.add(user)
            db.session.commit()

    if not user:
        return jsonify({'error': 'User not found'}), 404
    return jsonify(user.to_dict()), 200
