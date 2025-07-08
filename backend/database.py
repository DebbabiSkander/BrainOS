# database.py - Database models and setup for BrainOS (FIXED VERSION)
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash, check_password_hash
import enum

db = SQLAlchemy()

class UserStatus(enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"

class UserRole(enum.Enum):
    ADMIN = "admin"
    DOCTOR = "doctor"

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    
    # Personal Information
    nom = db.Column(db.String(100), nullable=False)
    prenom = db.Column(db.String(100), nullable=False)
    titre = db.Column(db.String(50), nullable=False)  # Dr., Prof., etc.
    specialite = db.Column(db.String(100), nullable=False)
    telephone = db.Column(db.String(20), nullable=False)
    affiliation = db.Column(db.String(200), nullable=False)  # Hospital/Clinic
    
    # Account Status
    role = db.Column(db.Enum(UserRole), default=UserRole.DOCTOR, nullable=False)
    status = db.Column(db.Enum(UserStatus), default=UserStatus.PENDING, nullable=False)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    approved_at = db.Column(db.DateTime)
    trial_ends_at = db.Column(db.DateTime)
    last_login = db.Column(db.DateTime)
    
    # Admin who approved
    approved_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    
    # Relationships
    activity_logs = db.relationship('ActivityLog', backref='user', lazy='dynamic')
    uploaded_files = db.relationship('UploadedFile', backref='user', lazy='dynamic')
    
    def set_password(self, password):
        """Hash and set password"""
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        """Check if password matches"""
        return check_password_hash(self.password_hash, password)
    
    def approve(self, admin_id):
        """Approve user and set trial period"""
        self.status = UserStatus.APPROVED
        self.approved_at = datetime.utcnow()
        self.approved_by = admin_id
        self.trial_ends_at = datetime.utcnow() + timedelta(days=7)
    
    def is_trial_active(self):
        """Check if trial period is still active"""
        if self.status != UserStatus.APPROVED:
            return False
        if not self.trial_ends_at:
            return False
        return datetime.utcnow() < self.trial_ends_at
    
    def days_remaining(self):
        """Get days remaining in trial"""
        if not self.is_trial_active():
            return 0
        delta = self.trial_ends_at - datetime.utcnow()
        return max(0, delta.days)
    
    def to_dict(self, include_sensitive=False):
        """Convert user to dictionary"""
        data = {
            'id': self.id,
            'email': self.email,
            'nom': self.nom,
            'prenom': self.prenom,
            'titre': self.titre,
            'specialite': self.specialite,
            'telephone': self.telephone,
            'affiliation': self.affiliation,
            'role': self.role.value,
            'status': self.status.value,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'approved_at': self.approved_at.isoformat() if self.approved_at else None,
            'trial_ends_at': self.trial_ends_at.isoformat() if self.trial_ends_at else None,
            'days_remaining': self.days_remaining() if self.is_trial_active() else 0,
            'is_trial_active': self.is_trial_active()
        }
        
        if include_sensitive:
            data['last_login'] = self.last_login.isoformat() if self.last_login else None
            
        return data

class ActivityLog(db.Model):
    __tablename__ = 'activity_logs'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    action = db.Column(db.String(100), nullable=False)
    details = db.Column(db.Text)
    ip_address = db.Column(db.String(45))
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

class UploadedFile(db.Model):
    __tablename__ = 'uploaded_files'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    filename = db.Column(db.String(255), nullable=False)
    original_filename = db.Column(db.String(255), nullable=False)
    file_type = db.Column(db.String(50), nullable=False)  # brain/lesion
    file_size = db.Column(db.Integer)  # in bytes
    upload_date = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    
    # Analysis metadata
    shape = db.Column(db.String(50))  # e.g., "512x512x30"
    voxel_spacing = db.Column(db.String(50))  # e.g., "0.5x0.5x1.0"
    
    def to_dict(self):
        return {
            'id': self.id,
            'filename': self.filename,
            'original_filename': self.original_filename,
            'file_type': self.file_type,
            'file_size': self.file_size,
            'upload_date': self.upload_date.isoformat() if self.upload_date else None,
            'shape': self.shape,
            'voxel_spacing': self.voxel_spacing
        }

def init_db(app):
    """Initialize database with app"""
    db.init_app(app)
    
    with app.app_context():
        # Create tables
        db.create_all()
        
        # Check if admin user already exists BEFORE trying to create it
        admin = User.query.filter_by(email='admin@brainos.com').first()
        if not admin:
            # Create default admin user only if it doesn't exist
            admin = User(
                email='admin@brainos.com',
                nom='Admin',
                prenom='System',
                titre='Admin',
                specialite='System Administration',
                telephone='0000000000',
                affiliation='BrainOS',
                role=UserRole.ADMIN,
                status=UserStatus.APPROVED
            )
            admin.set_password('admin123')  # Change this in production!
            admin.approved_at = datetime.utcnow()
            
            try:
                db.session.add(admin)
                db.session.commit()
                print("✅ Default admin user created: admin@brainos.com / admin123")
            except Exception as e:
                db.session.rollback()
                print(f"⚠️ Admin user creation failed (may already exist): {e}")
        else:
            print("✅ Admin user already exists: admin@brainos.com")
            
        print("✅ Database initialization completed successfully!")