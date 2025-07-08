# auth.py - Authentication routes for BrainOS (COMPLETELY FIXED VERSION)
from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from datetime import datetime, timedelta
from database import db, User, UserStatus, UserRole, ActivityLog
import re

auth_bp = Blueprint('auth', __name__)

def validate_email(email):
    """Validate email format"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def validate_phone(phone):
    """Validate phone number (basic validation)"""
    pattern = r'^[+]?[0-9\s\-()]{8,15}$'
    return re.match(pattern, phone.replace(' ', '').replace('-', '')) is not None

def log_activity(user_id, action, details=None, ip_address=None):
    """Log user activity"""
    try:
        log = ActivityLog(
            user_id=user_id,
            action=action,
            details=details,
            ip_address=ip_address
        )
        db.session.add(log)
        db.session.commit()
        print(f"📝 Activity logged: {action} for user {user_id}")
    except Exception as e:
        print(f"⚠️ Failed to log activity: {e}")
        db.session.rollback()

@auth_bp.route('/register', methods=['POST'])
def register():
    """Register new doctor account"""
    try:
        data = request.get_json()
        print(f"📝 Registration attempt for: {data.get('email')}")
        
        # Validate required fields
        required_fields = ['email', 'password', 'nom', 'prenom', 'titre', 
                          'specialite', 'telephone', 'affiliation']
        
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'Le champ {field} est requis'}), 400
        
        # Validate email
        if not validate_email(data['email']):
            return jsonify({'error': 'Format d\'email invalide'}), 400
        
        # Check if email already exists
        if User.query.filter_by(email=data['email']).first():
            return jsonify({'error': 'Cet email est déjà enregistré'}), 400
        
        # Validate phone
        if not validate_phone(data['telephone']):
            return jsonify({'error': 'Numéro de téléphone invalide'}), 400
        
        # Validate password strength
        if len(data['password']) < 8:
            return jsonify({'error': 'Le mot de passe doit contenir au moins 8 caractères'}), 400
        
        # Create new user
        user = User(
            email=data['email'].lower(),
            nom=data['nom'],
            prenom=data['prenom'],
            titre=data['titre'],
            specialite=data['specialite'],
            telephone=data['telephone'],
            affiliation=data['affiliation']
        )
        user.set_password(data['password'])
        
        db.session.add(user)
        db.session.commit()
        
        # Log activity
        log_activity(user.id, 'REGISTRATION', 'New account created', request.remote_addr)
        
        print(f"✅ User registered successfully: {user.email}")
        
        return jsonify({
            'success': True,
            'message': 'Compte créé avec succès. En attente d\'approbation par l\'administrateur.',
            'user': user.to_dict()
        }), 201
        
    except Exception as e:
        print(f"❌ Registration error: {str(e)}")
        db.session.rollback()
        return jsonify({'error': f'Erreur lors de la création du compte: {str(e)}'}), 500

@auth_bp.route('/login', methods=['POST'])
def login():
    """Login user"""
    try:
        data = request.get_json()
        print(f"🔐 Login attempt for: {data.get('email')}")
        
        if not data.get('email') or not data.get('password'):
            return jsonify({'error': 'Email et mot de passe requis'}), 400
        
        # Find user
        user = User.query.filter_by(email=data['email'].lower()).first()
        
        if not user or not user.check_password(data['password']):
            print(f"❌ Invalid credentials for: {data.get('email')}")
            return jsonify({'error': 'Email ou mot de passe incorrect'}), 401
        
        # Check user status
        if user.status == UserStatus.PENDING:
            print(f"⏳ Account pending for: {user.email}")
            return jsonify({'error': 'Votre compte est en attente d\'approbation'}), 403
        
        if user.status == UserStatus.REJECTED:
            print(f"❌ Account rejected for: {user.email}")
            return jsonify({'error': 'Votre compte a été rejeté'}), 403
        
        # Check trial status for doctors
        if user.role == UserRole.DOCTOR and not user.is_trial_active():
            print(f"⏰ Trial expired for: {user.email}")
            return jsonify({'error': 'Votre période d\'essai a expiré'}), 403
        
        # Update last login
        user.last_login = datetime.utcnow()
        db.session.commit()
        
        # Create JWT token with STRING identity (CRITICAL FIX)
        access_token = create_access_token(
            identity=str(user.id),  # ⭐ CRITICAL: Must be string for Flask-JWT-Extended
            expires_delta=timedelta(hours=24),
            additional_claims={
                'role': user.role.value,
                'email': user.email
            }
        )
        
        # Log activity
        log_activity(user.id, 'LOGIN', 'Successful login', request.remote_addr)
        
        print(f"✅ Login successful for: {user.email} (Role: {user.role.value})")
        print(f"🎫 Token created for user ID: {user.id}")
        
        return jsonify({
            'success': True,
            'access_token': access_token,
            'user': user.to_dict()
        }), 200
        
    except Exception as e:
        print(f"❌ Login error: {str(e)}")
        return jsonify({'error': f'Erreur de connexion: {str(e)}'}), 500

@auth_bp.route('/profile', methods=['GET'])
@jwt_required()
def get_profile():
    """Get current user profile"""
    try:
        user_id_str = get_jwt_identity()
        user_id = int(user_id_str)  # Convert back to int for database query
        print(f"👤 Profile request for user ID: {user_id}")
        
        user = User.query.get(user_id)
        
        if not user:
            print(f"❌ User not found for ID: {user_id}")
            return jsonify({'error': 'Utilisateur non trouvé'}), 404
        
        print(f"✅ Profile retrieved for: {user.email}")
        
        return jsonify({
            'success': True,
            'user': user.to_dict(include_sensitive=True)
        }), 200
        
    except Exception as e:
        print(f"❌ Profile error: {str(e)}")
        return jsonify({'error': f'Erreur: {str(e)}'}), 500

@auth_bp.route('/profile', methods=['PUT'])
@jwt_required()
def update_profile():
    """Update user profile"""
    try:
        user_id_str = get_jwt_identity()
        user_id = int(user_id_str)
        print(f"🔄 Profile update for user ID: {user_id}")
        
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'Utilisateur non trouvé'}), 404
        
        data = request.get_json()
        
        # Update allowed fields
        allowed_fields = ['telephone', 'affiliation', 'specialite']
        for field in allowed_fields:
            if field in data:
                setattr(user, field, data[field])
        
        # Validate phone if updated
        if 'telephone' in data and not validate_phone(data['telephone']):
            return jsonify({'error': 'Numéro de téléphone invalide'}), 400
        
        db.session.commit()
        
        log_activity(user_id, 'PROFILE_UPDATE', 'Profile updated', request.remote_addr)
        print(f"✅ Profile updated for: {user.email}")
        
        return jsonify({
            'success': True,
            'message': 'Profil mis à jour',
            'user': user.to_dict()
        }), 200
        
    except Exception as e:
        print(f"❌ Profile update error: {str(e)}")
        db.session.rollback()
        return jsonify({'error': f'Erreur: {str(e)}'}), 500

@auth_bp.route('/change-password', methods=['POST'])
@jwt_required()
def change_password():
    """Change user password"""
    try:
        user_id_str = get_jwt_identity()
        user_id = int(user_id_str)
        print(f"🔒 Password change for user ID: {user_id}")
        
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'Utilisateur non trouvé'}), 404
        
        data = request.get_json()
        
        if not data.get('old_password') or not data.get('new_password'):
            return jsonify({'error': 'Ancien et nouveau mot de passe requis'}), 400
        
        # Check old password
        if not user.check_password(data['old_password']):
            return jsonify({'error': 'Mot de passe actuel incorrect'}), 401
        
        # Validate new password
        if len(data['new_password']) < 8:
            return jsonify({'error': 'Le nouveau mot de passe doit contenir au moins 8 caractères'}), 400
        
        # Update password
        user.set_password(data['new_password'])
        db.session.commit()
        
        # Log activity
        log_activity(user_id, 'PASSWORD_CHANGE', 'Password changed', request.remote_addr)
        print(f"✅ Password changed for: {user.email}")
        
        return jsonify({
            'success': True,
            'message': 'Mot de passe mis à jour avec succès'
        }), 200
        
    except Exception as e:
        print(f"❌ Password change error: {str(e)}")
        db.session.rollback()
        return jsonify({'error': f'Erreur: {str(e)}'}), 500

# Admin routes
@auth_bp.route('/admin/users', methods=['GET'])
@jwt_required()
def get_all_users():
    """Get all users (admin only)"""
    try:
        user_id_str = get_jwt_identity()
        user_id = int(user_id_str)
        admin = User.query.get(user_id)
        
        print(f"👥 Admin users request from user ID: {user_id}")
        
        if not admin or admin.role != UserRole.ADMIN:
            print(f"❌ Unauthorized access attempt from user ID: {user_id}")
            return jsonify({'error': 'Accès non autorisé'}), 403
        
        # Get filter parameters
        status = request.args.get('status')
        print(f"📋 Fetching users with status filter: {status}")
        
        query = User.query
        if status:
            try:
                query = query.filter_by(status=UserStatus(status))
            except ValueError:
                return jsonify({'error': f'Statut invalide: {status}'}), 400
        
        users = query.order_by(User.created_at.desc()).all()
        
        print(f"✅ Found {len(users)} users")
        
        return jsonify({
            'success': True,
            'users': [user.to_dict() for user in users]
        }), 200
        
    except Exception as e:
        print(f"❌ Get users error: {str(e)}")
        return jsonify({'error': f'Erreur: {str(e)}'}), 500

@auth_bp.route('/admin/users/<int:user_id>/approve', methods=['POST'])
@jwt_required()
def approve_user(user_id):
    """Approve user account (admin only)"""
    try:
        admin_id_str = get_jwt_identity()
        admin_id = int(admin_id_str)
        admin = User.query.get(admin_id)
        
        print(f"✅ User approval request: Admin {admin_id} approving user {user_id}")
        
        if not admin or admin.role != UserRole.ADMIN:
            return jsonify({'error': 'Accès non autorisé'}), 403
        
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'Utilisateur non trouvé'}), 404
        
        if user.status != UserStatus.PENDING:
            return jsonify({'error': 'L\'utilisateur n\'est pas en attente d\'approbation'}), 400
        
        # Approve user
        user.approve(admin_id)
        db.session.commit()
        
        # Log activity
        log_activity(admin_id, 'USER_APPROVED', f'Approved user {user.email}', request.remote_addr)
        log_activity(user.id, 'ACCOUNT_APPROVED', 'Account approved by admin', request.remote_addr)
        
        print(f"✅ User {user.email} approved by admin {admin.email}")
        
        # TODO: Send approval email to user
        
        return jsonify({
            'success': True,
            'message': 'Utilisateur approuvé',
            'user': user.to_dict()
        }), 200
        
    except Exception as e:
        print(f"❌ User approval error: {str(e)}")
        db.session.rollback()
        return jsonify({'error': f'Erreur: {str(e)}'}), 500

@auth_bp.route('/admin/users/<int:user_id>/reject', methods=['POST'])
@jwt_required()
def reject_user(user_id):
    """Reject user account (admin only)"""
    try:
        admin_id_str = get_jwt_identity()
        admin_id = int(admin_id_str)
        admin = User.query.get(admin_id)
        
        print(f"❌ User rejection request: Admin {admin_id} rejecting user {user_id}")
        
        if not admin or admin.role != UserRole.ADMIN:
            return jsonify({'error': 'Accès non autorisé'}), 403
        
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'Utilisateur non trouvé'}), 404
        
        if user.status != UserStatus.PENDING:
            return jsonify({'error': 'L\'utilisateur n\'est pas en attente d\'approbation'}), 400
        
        # Reject user
        user.status = UserStatus.REJECTED
        db.session.commit()
        
        # Log activity
        log_activity(admin_id, 'USER_REJECTED', f'Rejected user {user.email}', request.remote_addr)
        
        print(f"❌ User {user.email} rejected by admin {admin.email}")
        
        return jsonify({
            'success': True,
            'message': 'Utilisateur rejeté'
        }), 200
        
    except Exception as e:
        print(f"❌ User rejection error: {str(e)}")
        db.session.rollback()
        return jsonify({'error': f'Erreur: {str(e)}'}), 500

@auth_bp.route('/admin/stats', methods=['GET'])
@jwt_required()
def get_admin_stats():
    """Get admin dashboard statistics"""
    try:
        admin_id_str = get_jwt_identity()
        admin_id = int(admin_id_str)
        admin = User.query.get(admin_id)
        
        print(f"📊 Admin stats request from user ID: {admin_id}")
        
        if not admin or admin.role != UserRole.ADMIN:
            print(f"❌ Unauthorized stats access from user ID: {admin_id}")
            return jsonify({'error': 'Accès non autorisé'}), 403
        
        stats = {
            'total_users': User.query.filter_by(role=UserRole.DOCTOR).count(),
            'pending_users': User.query.filter_by(status=UserStatus.PENDING).count(),
            'approved_users': User.query.filter_by(status=UserStatus.APPROVED, role=UserRole.DOCTOR).count(),
            'active_trials': User.query.filter(
                User.status == UserStatus.APPROVED,
                User.role == UserRole.DOCTOR,
                User.trial_ends_at > datetime.utcnow()
            ).count(),
            'recent_activities': []
        }
        
        # Get recent activities
        recent_logs = ActivityLog.query.order_by(ActivityLog.timestamp.desc()).limit(10).all()
        for log in recent_logs:
            stats['recent_activities'].append({
                'user_email': log.user.email,
                'action': log.action,
                'timestamp': log.timestamp.isoformat(),
                'details': log.details
            })
        
        print(f"✅ Stats compiled: {stats['total_users']} total users, {stats['pending_users']} pending")
        
        return jsonify({
            'success': True,
            'stats': stats
        }), 200
        
    except Exception as e:
        print(f"❌ Admin stats error: {str(e)}")
        return jsonify({'error': f'Erreur: {str(e)}'}), 500