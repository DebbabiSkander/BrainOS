# database.py - Updated Database models for new trial system
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash, check_password_hash
import enum

db = SQLAlchemy()

class UserStatus(enum.Enum):
    TRIAL = "trial"           # New: User in trial period (7 days, 2 uploads max)
    PENDING = "pending"       # User awaiting admin approval after trial
    APPROVED = "approved"     # Admin approved - unlimited access
    REJECTED = "rejected"     # Admin rejected
    SUSPENDED = "suspended"   # Trial expired or exceeded limits

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
    titre = db.Column(db.String(50), nullable=False)
    specialite = db.Column(db.String(100), nullable=False)
    telephone = db.Column(db.String(20), nullable=False)
    affiliation = db.Column(db.String(200), nullable=False)
    
    # Account Status
    role = db.Column(db.Enum(UserRole), default=UserRole.DOCTOR, nullable=False)
    status = db.Column(db.Enum(UserStatus), default=UserStatus.TRIAL, nullable=False)
    
    # Trial Management
    trial_uploads_count = db.Column(db.Integer, default=0, nullable=False)
    trial_max_uploads = db.Column(db.Integer, default=2, nullable=False)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    trial_starts_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    trial_ends_at = db.Column(db.DateTime)
    approved_at = db.Column(db.DateTime)
    last_login = db.Column(db.DateTime)
    
    # Admin who approved
    approved_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    
    # Relationships
    activity_logs = db.relationship('ActivityLog', backref='user', lazy='dynamic')
    uploaded_files = db.relationship('UploadedFile', backref='user', lazy='dynamic')
    
    def __init__(self, **kwargs):
        super(User, self).__init__(**kwargs)
        # Set trial period when user is created
        if not self.trial_ends_at:
            self.trial_ends_at = datetime.utcnow() + timedelta(days=7)
    
    def set_password(self, password):
        """Hash and set password"""
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        """Check if password matches"""
        return check_password_hash(self.password_hash, password)
    
    def can_upload(self):
        """Check if user can upload files"""
        if self.role == UserRole.ADMIN:
            return True, "Admin access"
        
        if self.status == UserStatus.APPROVED:
            return True, "Approved user"
        
        if self.status == UserStatus.TRIAL:
            # Check if trial is still active
            if not self.is_trial_active():
                self.status = UserStatus.SUSPENDED
                db.session.commit()
                return False, "Trial period expired"
            
            # Check upload limit
            if self.trial_uploads_count >= self.trial_max_uploads:
                self.status = UserStatus.SUSPENDED
                db.session.commit()
                return False, f"Trial upload limit reached ({self.trial_max_uploads} uploads maximum)"
            
            return True, f"Trial access ({self.trial_uploads_count}/{self.trial_max_uploads} uploads used)"
        
        return False, f"Account status: {self.status.value}"
    
    def increment_upload_count(self):
        """Increment upload counter for trial users"""
        if self.status == UserStatus.TRIAL:
            self.trial_uploads_count += 1
            
            # Check if user has reached limit
            if self.trial_uploads_count >= self.trial_max_uploads:
                self.status = UserStatus.PENDING  # Move to pending for admin approval
            
            db.session.commit()
    
    def approve(self, admin_id):
        """Approve user for unlimited access"""
        self.status = UserStatus.APPROVED
        self.approved_at = datetime.utcnow()
        self.approved_by = admin_id
    
    def reject(self):
        """Reject user account"""
        self.status = UserStatus.REJECTED
    
    def is_trial_active(self):
        """Check if trial period is still active"""
        if self.status not in [UserStatus.TRIAL, UserStatus.PENDING]:
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
    
    def uploads_remaining(self):
        """Get uploads remaining in trial"""
        if self.status == UserStatus.APPROVED or self.role == UserRole.ADMIN:
            return -1  # Use -1 instead of Infinity for JSON compatibility
        if self.status == UserStatus.TRIAL:
            return max(0, self.trial_max_uploads - self.trial_uploads_count)
        return 0
    
    def get_trial_status(self):
        """Get detailed trial status"""
        return {
            'status': self.status.value,
            'days_remaining': self.days_remaining(),
            'uploads_used': self.trial_uploads_count,
            'uploads_remaining': self.uploads_remaining(),
            'trial_active': self.is_trial_active(),
            'can_upload': self.can_upload()[0],
            'upload_message': self.can_upload()[1]
        }
    
    def to_dict(self, include_sensitive=False):
        """Convert user to dictionary - JSON safe version"""
        # Get trial status safely
        try:
            trial_status = self.get_trial_status()
        except:
            trial_status = {
                'days_remaining': 0,
                'trial_active': False,
                'can_upload': False,
                'upload_message': 'Status unavailable'
            }
        
        # Convert uploads_remaining to JSON-safe value
        uploads_remaining = self.uploads_remaining()
        if uploads_remaining == -1:  # Unlimited access
            uploads_remaining_display = "unlimited"
            uploads_remaining_count = -1
        else:
            uploads_remaining_display = str(uploads_remaining)
            uploads_remaining_count = uploads_remaining
        
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
            
            # Trial information - JSON safe
            'trial_uploads_count': getattr(self, 'trial_uploads_count', 0),
            'trial_max_uploads': getattr(self, 'trial_max_uploads', 2),
            'days_remaining': trial_status['days_remaining'],
            'uploads_remaining': uploads_remaining_count,  # Numeric value (-1 for unlimited)
            'uploads_remaining_display': uploads_remaining_display,  # "unlimited" or number
            'is_trial_active': trial_status['trial_active'],
            'can_upload': trial_status['can_upload'],
            'upload_message': trial_status['upload_message']
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
    file_type = db.Column(db.String(50), nullable=False)
    file_size = db.Column(db.Integer)
    upload_date = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    
    # Analysis metadata
    shape = db.Column(db.String(50))
    voxel_spacing = db.Column(db.String(50))
    
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
        
        # Check if admin user already exists
        admin = User.query.filter_by(email='admin@brainos.com').first()
        if not admin:
            # Create default admin user
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
                print(f"⚠️ Admin user creation failed: {e}")
        else:
            print("✅ Admin user already exists: admin@brainos.com")
            
        print("✅ Database initialization completed successfully!")