# app_auth.py - Add this to your existing app.py

# Additional imports needed
from flask_jwt_extended import JWTManager, jwt_required, get_jwt_identity
from datetime import datetime
import os

# Import database and auth modules
from database import db, init_db, User, UploadedFile
from auth import auth_bp

# Add to your Flask app configuration
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///brainos.db'  # Or use PostgreSQL/MySQL
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=24)

# Initialize extensions
jwt = JWTManager(app)
init_db(app)

# Register auth blueprint
app.register_blueprint(auth_bp, url_prefix='/api/auth')

# Update your existing upload route to require authentication
@app.route('/api/upload', methods=['POST'])
@jwt_required()
def upload_file():
    """Upload and process NIFTI file (authenticated)"""
    try:
        # Get current user
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        if not user or not user.is_trial_active():
            return jsonify({'error': 'Accès non autorisé ou période d\'essai expirée'}), 403
        
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        file_type = request.form.get('type', 'brain')
        
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'error': 'Invalid file type. Only .nii and .nii.gz files allowed'}), 400
        
        # Save file with user prefix
        original_filename = secure_filename(file.filename)
        filename = f"user_{user_id}_{int(time.time())}_{original_filename}"
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        # Load and process NIFTI file
        nii_img = nib.load(filepath)
        data = nii_img.get_fdata()
        
        # Handle 4D data
        if data.ndim == 4:
            print(f"4D data detected, taking first volume. Shape: {data.shape}")
            data = data[:, :, :, 0]
        elif data.ndim < 3:
            return jsonify({'error': 'File must have at least 3 dimensions'}), 400
        
        # Convert to float32 for memory efficiency
        data = data.astype(np.float32)
        
        # Extract basic information
        info = extract_basic_info(nii_img, data)
        info['filename'] = filename
        info['file_type'] = file_type
        info['file_id'] = filename
        
        # Store file info in database
        uploaded_file = UploadedFile(
            user_id=user_id,
            filename=filename,
            original_filename=original_filename,
            file_type=file_type,
            file_size=os.path.getsize(filepath),
            shape=f"{data.shape[0]}x{data.shape[1]}x{data.shape[2]}",
            voxel_spacing=f"{info['zooms'][0]:.2f}x{info['zooms'][1]:.2f}x{info['zooms'][2]:.2f}"
        )
        db.session.add(uploaded_file)
        db.session.commit()
        
        # Store the data with caching
        data_hash = hash(data.tobytes())
        with cache_lock:
            uploaded_files[filename] = {
                'data': data,
                'nii_img': nii_img,
                'info': info,
                'data_hash': data_hash,
                'user_id': user_id
            }
            processing_cache[data_hash] = {'data': data}
        
        # Clean up original file (keep processed data in memory)
        os.remove(filepath)
        
        return jsonify({
            'success': True,
            'message': f'{file_type.capitalize()} file uploaded successfully',
            'file_info': info,
            'days_remaining': user.days_remaining()
        })
        
    except Exception as e:
        print(f"Upload error: {str(e)}")
        traceback.print_exc()
        return jsonify({
            'error': f'Error processing file: {str(e)}'
        }), 500

# Add middleware to check file access
@app.route('/api/analysis/<file_id>')
@jwt_required()
def get_analysis_authenticated(file_id):
    """Get analysis with authentication check"""
    user_id = get_jwt_identity()
    
    # Check if user has access to this file
    if file_id in uploaded_files:
        file_data = uploaded_files[file_id]
        if file_data.get('user_id') != user_id:
            # Check if user is admin
            user = User.query.get(user_id)
            if not user or user.role != UserRole.ADMIN:
                return jsonify({'error': 'Accès non autorisé à ce fichier'}), 403
    
    # Call your existing analysis function
    return get_analysis(file_id)

# Add user files endpoint
@app.route('/api/user/files', methods=['GET'])
@jwt_required()
def get_user_files():
    """Get all files uploaded by current user"""
    try:
        user_id = get_jwt_identity()
        files = UploadedFile.query.filter_by(user_id=user_id).order_by(UploadedFile.upload_date.desc()).all()
        
        return jsonify({
            'success': True,
            'files': [f.to_dict() for f in files]
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Update requirements.txt to include:
# Flask-SQLAlchemy==3.0.5
# Flask-JWT-Extended==4.5.2