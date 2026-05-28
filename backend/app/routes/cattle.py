from flask import Blueprint, request, jsonify
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from app import db
from app.models import Cattle

cattle_bp = Blueprint('cattle', __name__)


@cattle_bp.route('', methods=['GET'])
def list_cattle():
    cattle = Cattle.query.order_by(Cattle.date_added.desc()).all()
    return jsonify([c.to_dict() for c in cattle])


@cattle_bp.route('', methods=['POST'])
def create_cattle():
    data = request.get_json() or {}

    if not data or not data.get('name'):
        return jsonify({'error': 'Name is required'}), 400

    cattle = Cattle(
        name=data['name'].strip(),
        tag=data.get('tag') or None,
        breed=data.get('breed'),
        notes=data.get('notes'),
    )
    try:
        db.session.add(cattle)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({'error': 'A cattle record with this tag already exists'}), 409
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': 'Could not save cattle record'}), 500

    return jsonify(cattle.to_dict()), 201


@cattle_bp.route('/<int:cattle_id>', methods=['GET'])
def get_cattle(cattle_id):
    cattle = db.session.get(Cattle, cattle_id)
    if not cattle:
        return jsonify({'error': 'Cattle not found'}), 404
    return jsonify(cattle.to_dict())


@cattle_bp.route('/<int:cattle_id>', methods=['PUT'])
def update_cattle(cattle_id):
    cattle = db.session.get(Cattle, cattle_id)
    if not cattle:
        return jsonify({'error': 'Cattle not found'}), 404

    data = request.get_json() or {}
    if data.get('name'):
        cattle.name = data['name']
    if 'tag' in data:
        cattle.tag = data['tag']
    if 'breed' in data:
        cattle.breed = data['breed']
    if 'notes' in data:
        cattle.notes = data['notes']

    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({'error': 'A cattle record with this tag already exists'}), 409
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': 'Could not update cattle record'}), 500
    return jsonify(cattle.to_dict())


@cattle_bp.route('/<int:cattle_id>', methods=['DELETE'])
def delete_cattle(cattle_id):
    cattle = db.session.get(Cattle, cattle_id)
    if not cattle:
        return jsonify({'error': 'Cattle not found'}), 404

    try:
        db.session.delete(cattle)
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': 'Could not delete cattle record'}), 500
    return jsonify({'message': 'Cattle deleted successfully'})
