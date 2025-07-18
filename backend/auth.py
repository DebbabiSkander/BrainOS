# auth.py - Authentication routes for BrainOS (CLEAN FINAL VERSION)
from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from datetime import datetime, timedelta
from database import db, User, UserStatus, UserRole, ActivityLog, UploadedFile
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

def check_user_access(user):
    """Check if user can access the system"""
    if user.role == UserRole.ADMIN:
        return True, "Admin access"
    
    if user.status == UserStatus.APPROVED:
        return True, "Approved user - unlimited access"
    
    if user.status == UserStatus.TRIAL:
        if user.is_trial_active():
            return True, f"Trial access - {user.days_remaining()} days, {user.uploads_remaining()} uploads remaining"
        else:
            # Trial expired, move to pending
            user.status = UserStatus.PENDING
            db.session.commit()
            return False, "Période d'essai expirée. Votre compte est en attente d'approbation administrateur."
    
    if user.status == UserStatus.PENDING:
        return False, "Votre compte est en attente d'approbation administrateur."
    
    if user.status == UserStatus.REJECTED:
        return False, "Votre compte a été rejeté. Contactez l'administrateur."
    
    if user.status == UserStatus.SUSPENDED:
        return False, "Votre compte a été suspendu. Contactez l'administrateur."
    
    return False, f"Statut de compte inconnu: {user.status.value}"

@auth_bp.route('/register', methods=['POST'])
def register():
    """Register new doctor account with immediate trial access"""
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
        
        # Create new user with TRIAL status (immediate access)
        user = User(
            email=data['email'].lower(),
            nom=data['nom'],
            prenom=data['prenom'],
            titre=data['titre'],
            specialite=data['specialite'],
            telephone=data['telephone'],
            affiliation=data['affiliation'],
            status=UserStatus.TRIAL,  # Start with trial status
            trial_starts_at=datetime.utcnow(),
            trial_ends_at=datetime.utcnow() + timedelta(days=7)
        )
        user.set_password(data['password'])
        
        db.session.add(user)
        db.session.commit()
        
        # Log activity
        log_activity(user.id, 'REGISTRATION', 'New trial account created', request.remote_addr)
        
        # Create access token immediately
        access_token = create_access_token(
            identity=str(user.id),
            expires_delta=timedelta(hours=24),
            additional_claims={
                'role': user.role.value,
                'email': user.email
            }
        )
        
        print(f"✅ User registered with immediate trial access: {user.email}")
        
        return jsonify({
            'success': True,
            'message': 'Compte créé avec succès! Vous avez accès immédiat pour 7 jours avec 2 téléchargements maximum.',
            'access_token': access_token,
            'user': user.to_dict(),
            'trial_info': {
                'days_remaining': user.days_remaining(),
                'uploads_remaining': user.uploads_remaining(),
                'message': f"Période d'essai: 7 jours, {user.trial_max_uploads} téléchargements maximum"
            }
        }), 201
        
    except Exception as e:
        print(f"❌ Registration error: {str(e)}")
        db.session.rollback()
        return jsonify({'error': f'Erreur lors de la création du compte: {str(e)}'}), 500

@auth_bp.route('/login', methods=['POST'])
def login():
    """Login user with updated status checking"""
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
        
        # Check user status and access
        can_access, status_message = check_user_access(user)
        
        if not can_access:
            print(f"🚫 Access denied for {user.email}: {status_message}")
            return jsonify({
                'error': status_message,
                'status': user.status.value,
                'user_info': user.to_dict()
            }), 403
        
        # Update last login
        user.last_login = datetime.utcnow()
        db.session.commit()
        
        # Create JWT token
        access_token = create_access_token(
            identity=str(user.id),
            expires_delta=timedelta(hours=24),
            additional_claims={
                'role': user.role.value,
                'email': user.email
            }
        )
        
        # Log activity
        log_activity(user.id, 'LOGIN', f'Successful login - {status_message}', request.remote_addr)
        
        print(f"✅ Login successful for: {user.email} (Status: {user.status.value})")
        
        response_data = {
            'success': True,
            'access_token': access_token,
            'user': user.to_dict(),
            'status_message': status_message
        }
        
        # Add specific trial information
        if user.status == UserStatus.TRIAL:
            response_data['trial_warning'] = {
                'days_remaining': user.days_remaining(),
                'uploads_remaining': user.uploads_remaining(),
                'message': f"Période d'essai - {user.days_remaining()} jours et {user.uploads_remaining()} téléchargements restants"
            }
        elif user.status == UserStatus.PENDING:
            response_data['pending_message'] = "Votre période d'essai est terminée. En attente d'approbation administrateur."
        
        return jsonify(response_data), 200
        
    except Exception as e:
        print(f"❌ Login error: {str(e)}")
        return jsonify({'error': f'Erreur de connexion: {str(e)}'}), 500

@auth_bp.route('/profile', methods=['GET'])
@jwt_required()
def get_profile():
    """Get current user profile with updated trial info"""
    try:
        user_id_str = get_jwt_identity()
        user_id = int(user_id_str)
        print(f"👤 Profile request for user ID: {user_id}")
        
        user = User.query.get(user_id)
        
        if not user:
            print(f"❌ User not found for ID: {user_id}")
            return jsonify({'error': 'Utilisateur non trouvé'}), 404
        
        print(f"✅ Profile retrieved for: {user.email}")
        
        return jsonify({
            'success': True,
            'user': user.to_dict(include_sensitive=True),
            'trial_status': user.get_trial_status()
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
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'Utilisateur non trouvé'}), 404
        
        data = request.get_json()
        
        if not data.get('old_password') or not data.get('new_password'):
            return jsonify({'error': 'Ancien et nouveau mot de passe requis'}), 400
        
        if not user.check_password(data['old_password']):
            return jsonify({'error': 'Mot de passe actuel incorrect'}), 401
        
        if len(data['new_password']) < 8:
            return jsonify({'error': 'Le nouveau mot de passe doit contenir au moins 8 caractères'}), 400
        
        user.set_password(data['new_password'])
        db.session.commit()
        
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

@auth_bp.route('/trial-status', methods=['GET'])
@jwt_required()
def get_trial_status():
    """Get detailed trial status for current user"""
    try:
        user_id_str = get_jwt_identity()
        user_id = int(user_id_str)
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'Utilisateur non trouvé'}), 404
        
        trial_status = user.get_trial_status()
        
        return jsonify({
            'success': True,
            'trial_status': trial_status,
            'user_status': user.status.value,
            'message': trial_status['upload_message']
        }), 200
        
    except Exception as e:
        print(f"❌ Trial status error: {str(e)}")
        return jsonify({'error': f'Erreur: {str(e)}'}), 500

@auth_bp.route('/request-approval', methods=['POST'])
@jwt_required()
def request_approval():
    """Request admin approval after trial"""
    try:
        user_id_str = get_jwt_identity()
        user_id = int(user_id_str)
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'Utilisateur non trouvé'}), 404
        
        if user.status == UserStatus.TRIAL and (not user.is_trial_active() or user.uploads_remaining() == 0):
            user.status = UserStatus.PENDING
            db.session.commit()
            
            log_activity(user_id, 'APPROVAL_REQUEST', 'User requested admin approval', request.remote_addr)
            
            return jsonify({
                'success': True,
                'message': 'Demande d\'approbation envoyée. Un administrateur examinera votre demande.',
                'user': user.to_dict()
            }), 200
        
        return jsonify({'error': 'Demande d\'approbation non nécessaire'}), 400
        
    except Exception as e:
        print(f"❌ Approval request error: {str(e)}")
        db.session.rollback()
        return jsonify({'error': f'Erreur: {str(e)}'}), 500

# Admin routes
@auth_bp.route('/admin/users', methods=['GET'])
@jwt_required()
def get_all_users():
    """Get all users with updated filtering"""
    try:
        user_id_str = get_jwt_identity()
        user_id = int(user_id_str)
        admin = User.query.get(user_id)
        
        if not admin or admin.role != UserRole.ADMIN:
            return jsonify({'error': 'Accès non autorisé'}), 403
        
        # Get filter parameters
        status = request.args.get('status')
        
        query = User.query.filter(User.role == UserRole.DOCTOR)  # Exclude admins
        if status:
            try:
                query = query.filter_by(status=UserStatus(status))
            except ValueError:
                return jsonify({'error': f'Statut invalide: {status}'}), 400
        
        users = query.order_by(User.created_at.desc()).all()
        
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
    """Approve user for unlimited access"""
    try:
        admin_id_str = get_jwt_identity()
        admin_id = int(admin_id_str)
        admin = User.query.get(admin_id)
        
        if not admin or admin.role != UserRole.ADMIN:
            return jsonify({'error': 'Accès non autorisé'}), 403
        
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'Utilisateur non trouvé'}), 404
        
        if user.status not in [UserStatus.TRIAL, UserStatus.PENDING, UserStatus.SUSPENDED]:
            return jsonify({'error': 'L\'utilisateur ne peut pas être approuvé dans son état actuel'}), 400
        
        # Approve user
        user.approve(admin_id)
        db.session.commit()
        
        # Log activity
        log_activity(admin_id, 'USER_APPROVED', f'Approved user {user.email}', request.remote_addr)
        log_activity(user.id, 'ACCOUNT_APPROVED', 'Account approved by admin - unlimited access granted', request.remote_addr)
        
        print(f"✅ User {user.email} approved by admin {admin.email}")
        
        return jsonify({
            'success': True,
            'message': 'Utilisateur approuvé - accès illimité accordé',
            'user': user.to_dict()
        }), 200
        
    except Exception as e:
        print(f"❌ User approval error: {str(e)}")
        db.session.rollback()
        return jsonify({'error': f'Erreur: {str(e)}'}), 500

@auth_bp.route('/admin/users/<int:user_id>/reject', methods=['POST'])
@jwt_required()
def reject_user(user_id):
    """Reject user account"""
    try:
        admin_id_str = get_jwt_identity()
        admin_id = int(admin_id_str)
        admin = User.query.get(admin_id)
        
        if not admin or admin.role != UserRole.ADMIN:
            return jsonify({'error': 'Accès non autorisé'}), 403
        
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'Utilisateur non trouvé'}), 404
        
        # Reject user
        user.reject()
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
    """Get admin dashboard statistics with updated status counts"""
    try:
        admin_id_str = get_jwt_identity()
        admin_id = int(admin_id_str)
        admin = User.query.get(admin_id)
        
        if not admin or admin.role != UserRole.ADMIN:
            return jsonify({'error': 'Accès non autorisé'}), 403
        
        stats = {
            'total_users': User.query.filter_by(role=UserRole.DOCTOR).count(),
            'trial_users': User.query.filter_by(status=UserStatus.TRIAL, role=UserRole.DOCTOR).count(),
            'pending_users': User.query.filter_by(status=UserStatus.PENDING, role=UserRole.DOCTOR).count(),
            'approved_users': User.query.filter_by(status=UserStatus.APPROVED, role=UserRole.DOCTOR).count(),
            'suspended_users': User.query.filter_by(status=UserStatus.SUSPENDED, role=UserRole.DOCTOR).count(),
            'active_trials': User.query.filter(
                User.status == UserStatus.TRIAL,
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
        
        return jsonify({
            'success': True,
            'stats': stats
        }), 200
        
    except Exception as e:
        print(f"❌ Admin stats error: {str(e)}")
        return jsonify({'error': f'Erreur: {str(e)}'}), 500

@auth_bp.route('/admin/users/<int:user_id>/delete', methods=['DELETE'])
@jwt_required()
def delete_user(user_id):
    """Delete user account (admin only)"""
    try:
        admin_id_str = get_jwt_identity()
        admin_id = int(admin_id_str)
        admin = User.query.get(admin_id)
        
        if not admin or admin.role != UserRole.ADMIN:
            return jsonify({'error': 'Accès non autorisé'}), 403
        
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'Utilisateur non trouvé'}), 404
        
        # Don't allow admin to delete themselves
        if user.id == admin.id:
            return jsonify({'error': 'Vous ne pouvez pas supprimer votre propre compte'}), 400
        
        # Don't allow deleting other admins
        if user.role == UserRole.ADMIN:
            return jsonify({'error': 'Impossible de supprimer un autre administrateur'}), 400
        
        user_email = user.email  # Store for logging
        
        # Delete related records first (cascade delete)
        try:
            # Delete activity logs
            ActivityLog.query.filter_by(user_id=user_id).delete()
            
            # Delete uploaded files records
            UploadedFile.query.filter_by(user_id=user_id).delete()
            
            # Delete the user
            db.session.delete(user)
            db.session.commit()
            
            # Log activity
            log_activity(admin_id, 'USER_DELETED', f'Deleted user {user_email}', request.remote_addr)
            
            print(f"🗑️ User {user_email} deleted by admin {admin.email}")
            
            return jsonify({
                'success': True,
                'message': f'Utilisateur {user_email} supprimé avec succès'
            }), 200
            
        except Exception as e:
            db.session.rollback()
            print(f"❌ Error deleting user records: {str(e)}")
            return jsonify({'error': 'Erreur lors de la suppression des données utilisateur'}), 500
        
    except Exception as e:
        print(f"❌ User deletion error: {str(e)}")
        db.session.rollback()
        return jsonify({'error': f'Erreur: {str(e)}'}), 500

# Health check for auth system
@auth_bp.route('/health', methods=['GET'])
def auth_health():
    """Health check for auth system"""
    try:
        # Simple health check
        user_count = User.query.count()
        return jsonify({
            'status': 'healthy',
            'auth_system': 'operational',
            'total_users': user_count,
            'timestamp': datetime.utcnow().isoformat()
        }), 200
    except Exception as e:
        return jsonify({
            'status': 'unhealthy',
            'error': str(e)
        }), 500