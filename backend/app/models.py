from datetime import datetime, timezone
import bcrypt
from app import db


class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    cattle = db.relationship('Cattle', backref='owner', lazy=True)

    def set_password(self, password):
        self.password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

    def check_password(self, password):
        return bcrypt.checkpw(password.encode(), self.password_hash.encode())

    def to_dict(self):
        return {
            'id': self.id,
            'email': self.email,
            'name': self.name,
            'created_at': self.created_at.isoformat(),
        }


class Cattle(db.Model):
    __tablename__ = 'cattle'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    name = db.Column(db.String(100), nullable=False)
    tag = db.Column(db.String(50), unique=True)
    breed = db.Column(db.String(100))
    date_added = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    notes = db.Column(db.Text)

    videos = db.relationship('Video', backref='cattle', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'tag': self.tag,
            'breed': self.breed,
            'date_added': self.date_added.isoformat(),
            'notes': self.notes,
            'video_count': len(self.videos),
        }


class Video(db.Model):
    __tablename__ = 'videos'

    id = db.Column(db.Integer, primary_key=True)
    cattle_id = db.Column(db.Integer, db.ForeignKey('cattle.id'), nullable=False)
    filename = db.Column(db.String(255), nullable=False)
    original_filename = db.Column(db.String(255))
    file_path = db.Column(db.String(500), nullable=False)
    upload_date = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    duration = db.Column(db.Float)

    analysis = db.relationship('AnalysisResult', backref='video', uselist=False, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'cattle_id': self.cattle_id,
            'filename': self.filename,
            'original_filename': self.original_filename,
            'upload_date': self.upload_date.isoformat(),
            'duration': self.duration,
            'has_analysis': self.analysis is not None,
        }


class AnalysisResult(db.Model):
    __tablename__ = 'analysis_results'

    id = db.Column(db.Integer, primary_key=True)
    video_id = db.Column(db.Integer, db.ForeignKey('videos.id'), nullable=False)
    lameness_score = db.Column(db.Float)  # 0-10 scale
    status = db.Column(db.String(20), default='pending')  # pending, normal, suspected, confirmed
    pose_data = db.Column(db.JSON)
    analyzed_at = db.Column(db.DateTime)
    notes = db.Column(db.Text)

    def to_dict(self):
        return {
            'id': self.id,
            'video_id': self.video_id,
            'lameness_score': self.lameness_score,
            'status': self.status,
            'pose_data': self.pose_data,
            'analyzed_at': self.analyzed_at.isoformat() if self.analyzed_at else None,
            'notes': self.notes,
        }
