# app.py - Flask Backend with Normalization, Export & Performance Features
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
import nibabel as nib
import numpy as np
import tempfile
import json
from werkzeug.utils import secure_filename
import traceback
from skimage import measure
from scipy.ndimage import gaussian_filter
from scipy import ndimage
import io
import gzip
import threading
from functools import lru_cache
import time

# Check if trimesh is available
try:
    import trimesh
    TRIMESH_AVAILABLE = True
except ImportError:
    print("Warning: trimesh not installed. Mesh export will be limited.")
    TRIMESH_AVAILABLE = False

def convert_numpy_types(obj):
    """Recursively convert numpy types to Python native types"""
    if isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.floating):
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, dict):
        return {key: convert_numpy_types(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [convert_numpy_types(item) for item in obj]
    elif isinstance(obj, tuple):
        return tuple(convert_numpy_types(item) for item in obj)
    else:
        return obj

app = Flask(__name__)
CORS(app)  # Enable CORS for React frontend

# Configuration
app.config['MAX_CONTENT_LENGTH'] = 500 * 1024 * 1024  # 500MB max file size
app.config['UPLOAD_FOLDER'] = tempfile.mkdtemp()

# Store uploaded files temporarily with caching
uploaded_files = {}
processing_cache = {}
cache_lock = threading.Lock()

# Allowed file extensions
ALLOWED_EXTENSIONS = {'nii', 'gz'}

def allowed_file(filename):
    """Check if file extension is allowed"""
    if '.' not in filename:
        return False
    
    if filename.lower().endswith('.nii.gz'):
        return True
    
    extension = filename.rsplit('.', 1)[1].lower()
    return extension in ALLOWED_EXTENSIONS

def extract_basic_info(nii_img, data):
    """Extract basic information from NIFTI file"""
    header = nii_img.header
    zooms = header.get_zooms()
    shape = data.shape
    
    # Calculate statistics
    non_zero_data = data[data != 0]
    
    info = {
        'shape': list(shape),
        'zooms': list(zooms[:3]),
        'physical_dimensions': [float(shape[i] * zooms[i]) for i in range(3)],
        'data_type': str(data.dtype),
        'min_value': float(np.min(data)),
        'max_value': float(np.max(data)),
        'mean_value': float(np.mean(data)),
        'std_value': float(np.std(data)),
        'non_zero_count': int(np.sum(data != 0)),
        'total_voxels': int(data.size),
        'non_zero_mean': float(np.mean(non_zero_data)) if non_zero_data.size > 0 else 0.0
    }
    
    return convert_numpy_types(info)

# Normalization algorithms
class NormalizationMethods:
    @staticmethod
    def min_max_normalization(data, new_min=0, new_max=1):
        """Min-Max normalization to scale data to [new_min, new_max]"""
        data_min = np.min(data)
        data_max = np.max(data)
        if data_max - data_min == 0:
            return np.full_like(data, new_min)
        normalized = (data - data_min) / (data_max - data_min)
        return normalized * (new_max - new_min) + new_min
    
    @staticmethod
    def z_score_normalization(data):
        """Z-score normalization (standardization)"""
        mean = np.mean(data)
        std = np.std(data)
        if std == 0:
            return np.zeros_like(data)
        return (data - mean) / std
    
    @staticmethod
    def robust_normalization(data, percentile_min=5, percentile_max=95):
        """Robust normalization using percentiles"""
        p_min = np.percentile(data, percentile_min)
        p_max = np.percentile(data, percentile_max)
        if p_max - p_min == 0:
            return np.zeros_like(data)
        clipped = np.clip(data, p_min, p_max)
        return (clipped - p_min) / (p_max - p_min)
    
    @staticmethod
    def histogram_equalization(data, nbins=256):
        """Histogram equalization for contrast enhancement"""
        # Flatten the data
        flat_data = data.flatten()
        
        # Calculate histogram
        hist, bins = np.histogram(flat_data, bins=nbins)
        
        # Calculate CDF
        cdf = hist.cumsum()
        cdf = cdf / cdf[-1]  # Normalize
        
        # Interpolate
        interp_values = np.interp(flat_data, bins[:-1], cdf)
        
        return interp_values.reshape(data.shape)

@lru_cache(maxsize=32)
def generate_mesh_from_data_cached(data_hash, shape, threshold_level=0.5, smoothing=1.0):
    """Cached version of mesh generation for performance"""
    # Retrieve data from cache
    with cache_lock:
        if data_hash in processing_cache:
            data = processing_cache[data_hash]['data']
        else:
            return None, None, {}
    
    return generate_mesh_from_data(data, threshold_level, smoothing)

def generate_mesh_from_data(data, threshold_level=0.5, smoothing=1.0):
    """Generate 3D mesh from NIFTI data using marching cubes algorithm"""
    try:
        print(f"Generating mesh from data with shape: {data.shape}")
        print(f"Data range: [{np.min(data):.2f}, {np.max(data):.2f}]")
        
        # Apply smoothing to reduce noise
        if smoothing > 0:
            smoothed_data = gaussian_filter(data.astype(float), sigma=smoothing)
        else:
            smoothed_data = data.astype(float)
        
        # Determine threshold
        data_max = np.max(smoothed_data)
        data_min = np.min(smoothed_data)
        
        if data_max == data_min:
            print("Warning: Data has no variation")
            return None, None, {}
        
        actual_threshold = data_min + (data_max - data_min) * threshold_level
        print(f"Using threshold: {actual_threshold:.2f}")
        
        # Check if there's enough data above threshold
        voxels_above_threshold = np.sum(smoothed_data > actual_threshold)
        print(f"Voxels above threshold: {voxels_above_threshold}")
        
        if voxels_above_threshold < 100:
            print("Warning: Too few voxels above threshold")
            return None, None, {}
        
        # Generate mesh using marching cubes with step size for performance
        print("Running marching cubes algorithm...")
        step_size = 1  # Increase for faster but lower quality mesh
        vertices, faces, normals, _ = measure.marching_cubes(
            smoothed_data[::step_size, ::step_size, ::step_size], 
            level=actual_threshold,
            spacing=(step_size, step_size, step_size),
            step_size=1
        )
        
        # Scale vertices back if we used step size
        if step_size > 1:
            vertices *= step_size
        
        print(f"Generated mesh: {len(vertices)} vertices, {len(faces)} faces")
        
        mesh_stats = {
            'vertex_count': int(len(vertices)),
            'face_count': int(len(faces)),
            'threshold_used': float(actual_threshold),
            'data_range': [float(data_min), float(data_max)],
            'voxels_above_threshold': int(voxels_above_threshold),
            'smoothing_sigma': float(smoothing)
        }
        
        return vertices, faces, convert_numpy_types(mesh_stats)
        
    except Exception as e:
        print(f"Error generating mesh: {str(e)}")
        traceback.print_exc()
        return None, None, {}

def prepare_mesh_for_frontend(vertices, faces, nii_img):
    """Prepare mesh data for frontend consumption"""
    if vertices is None or faces is None:
        return None
    
    try:
        # Get voxel spacing from NIFTI header
        zooms = nii_img.header.get_zooms()[:3]
        
        # Scale vertices by voxel spacing
        scaled_vertices = vertices * np.array(zooms)
        
        # Center the mesh at origin
        centroid = np.mean(scaled_vertices, axis=0)
        centered_vertices = scaled_vertices - centroid
        
        # Calculate bounds
        min_bounds = np.min(centered_vertices, axis=0)
        max_bounds = np.max(centered_vertices, axis=0)
        
        mesh_data = {
            'vertices': centered_vertices.tolist(),
            'faces': faces.tolist(),
            'centroid': centroid.tolist(),
            'voxel_spacing': list(zooms),
            'bounds': {
                'min': min_bounds.tolist(),
                'max': max_bounds.tolist()
            }
        }
        
        return convert_numpy_types(mesh_data)
        
    except Exception as e:
        print(f"Error preparing mesh: {str(e)}")
        return None

@app.route('/', methods=['GET'])
def index():
    """Root endpoint"""
    return jsonify({
        'status': 'healthy',
        'message': 'BrainOS Flask API is running',
        'version': '1.0',
        'endpoints': [
            '/api/health',
            '/api/upload',
            '/api/analysis/<file_id>',
            '/api/normalize/<file_id>',
            '/api/mesh/<file_id>',
            '/api/slice/<file_id>/<view_type>/<slice_index>',
            '/api/export/mesh/<file_id>',
            '/api/export/volume/<file_id>'
        ]
    })

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'healthy', 'message': 'Flask backend is running'})

@app.route('/api/upload', methods=['POST'])
def upload_file():
    """Upload and process NIFTI file"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        file_type = request.form.get('type', 'brain')
        
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'error': 'Invalid file type. Only .nii and .nii.gz files allowed'}), 400
        
        # Save file
        filename = secure_filename(file.filename)
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
        
        # Store the data with caching
        data_hash = hash(data.tobytes())
        with cache_lock:
            uploaded_files[filename] = {
                'data': data,
                'nii_img': nii_img,
                'info': info,
                'data_hash': data_hash
            }
            processing_cache[data_hash] = {'data': data}
        
        # Clean up
        os.remove(filepath)
        
        return jsonify({
            'success': True,
            'message': f'{file_type.capitalize()} file uploaded successfully',
            'file_info': info
        })
        
    except Exception as e:
        print(f"Upload error: {str(e)}")
        traceback.print_exc()
        return jsonify({
            'error': f'Error processing file: {str(e)}'
        }), 500

@app.route('/api/normalize/<file_id>', methods=['POST'])
def normalize_data(file_id):
    """Apply normalization to the data"""
    try:
        if file_id not in uploaded_files:
            return jsonify({'error': f'File {file_id} not found'}), 404
        
        # Get normalization parameters
        method = request.json.get('method', 'min_max')
        params = request.json.get('params', {})
        
        file_data = uploaded_files[file_id]
        data = file_data['data'].copy()
        
        # Apply normalization based on method
        if method == 'min_max':
            normalized_data = NormalizationMethods.min_max_normalization(
                data, 
                new_min=params.get('min', 0),
                new_max=params.get('max', 1)
            )
        elif method == 'z_score':
            normalized_data = NormalizationMethods.z_score_normalization(data)
        elif method == 'robust':
            normalized_data = NormalizationMethods.robust_normalization(
                data,
                percentile_min=params.get('percentile_min', 5),
                percentile_max=params.get('percentile_max', 95)
            )
        elif method == 'histogram':
            normalized_data = NormalizationMethods.histogram_equalization(
                data,
                nbins=params.get('nbins', 256)
            )
        else:
            return jsonify({'error': f'Unknown normalization method: {method}'}), 400
        
        # Update stored data
        file_data['normalized_data'] = normalized_data
        file_data['normalization_method'] = method
        file_data['normalization_params'] = params
        
        # Recalculate statistics
        info = extract_basic_info(file_data['nii_img'], normalized_data)
        
        return jsonify({
            'success': True,
            'message': f'Data normalized using {method} method',
            'statistics': info,
            'method': method,
            'params': params
        })
        
    except Exception as e:
        print(f"Normalization error: {str(e)}")
        traceback.print_exc()
        return jsonify({
            'error': f'Error normalizing data: {str(e)}'
        }), 500

@app.route('/api/mesh/<file_id>', methods=['GET'])
def get_mesh(file_id):
    """Generate and return 3D mesh data with caching"""
    try:
        if file_id not in uploaded_files:
            return jsonify({'error': f'File {file_id} not found'}), 404
        
        file_data = uploaded_files[file_id]
        data = file_data.get('normalized_data', file_data['data'])
        nii_img = file_data['nii_img']
        data_hash = file_data.get('data_hash')
        
        # Get parameters
        threshold = float(request.args.get('threshold', 0.1))
        smoothing = float(request.args.get('smoothing', 1.0))
        use_cache = request.args.get('use_cache', 'true').lower() == 'true'
        
        print(f"Generating mesh for {file_id} with threshold {threshold}, smoothing {smoothing}")
        
        # Try to use cached mesh if available
        if use_cache and data_hash:
            cache_key = f"{data_hash}_{threshold}_{smoothing}"
            with cache_lock:
                if cache_key in processing_cache and 'mesh' in processing_cache[cache_key]:
                    print("Using cached mesh")
                    cached_mesh = processing_cache[cache_key]['mesh']
                    return jsonify({
                        'success': True,
                        'mesh_data': cached_mesh['mesh_data'],
                        'mesh_stats': cached_mesh['mesh_stats'],
                        'file_info': file_data['info'],
                        'from_cache': True
                    })
        
        # Generate mesh
        vertices, faces, mesh_stats = generate_mesh_from_data(data, threshold, smoothing)
        
        if vertices is None:
            return jsonify({
                'error': 'Could not generate mesh from data',
                'message': 'Try adjusting the threshold or smoothing parameters'
            }), 400
        
        # Prepare mesh for frontend
        mesh_data = prepare_mesh_for_frontend(vertices, faces, nii_img)
        
        if mesh_data is None:
            return jsonify({
                'error': 'Failed to prepare mesh data'
            }), 500
        
        # Cache the result
        if use_cache and data_hash:
            cache_key = f"{data_hash}_{threshold}_{smoothing}"
            with cache_lock:
                if cache_key not in processing_cache:
                    processing_cache[cache_key] = {}
                processing_cache[cache_key]['mesh'] = {
                    'mesh_data': mesh_data,
                    'mesh_stats': mesh_stats
                }
        
        return jsonify({
            'success': True,
            'mesh_data': mesh_data,
            'mesh_stats': mesh_stats,
            'file_info': file_data['info'],
            'from_cache': False
        })
        
    except Exception as e:
        print(f"Mesh generation error: {str(e)}")
        traceback.print_exc()
        return jsonify({
            'error': f'Error generating mesh: {str(e)}'
        }), 500

@app.route('/api/export/mesh/<file_id>', methods=['GET'])
def export_mesh(file_id):
    """Export mesh in various formats (STL, OBJ, PLY)"""
    try:
        if file_id not in uploaded_files:
            return jsonify({'error': f'File {file_id} not found'}), 404
        
        file_data = uploaded_files[file_id]
        data = file_data.get('normalized_data', file_data['data'])
        nii_img = file_data['nii_img']
        
        # Get parameters
        threshold = float(request.args.get('threshold', 0.1))
        smoothing = float(request.args.get('smoothing', 1.0))
        format_type = request.args.get('format', 'stl').lower()
        
        # Generate mesh
        vertices, faces, mesh_stats = generate_mesh_from_data(data, threshold, smoothing)
        
        if vertices is None:
            return jsonify({
                'error': 'Could not generate mesh for export'
            }), 400
        
        # Scale vertices by voxel spacing
        zooms = nii_img.header.get_zooms()[:3]
        scaled_vertices = vertices * np.array(zooms)
        
        # Create trimesh object
        if TRIMESH_AVAILABLE:
            mesh = trimesh.Trimesh(vertices=scaled_vertices, faces=faces)
            
            # Export based on format
            export_data = None
            mimetype = 'application/octet-stream'
            extension = format_type
            
            if format_type == 'stl':
                export_data = mesh.export(file_type='stl')
                mimetype = 'model/stl'
            elif format_type == 'obj':
                export_data = mesh.export(file_type='obj')
                mimetype = 'model/obj'
            elif format_type == 'ply':
                export_data = mesh.export(file_type='ply')
                mimetype = 'model/ply'
            elif format_type == 'glb':
                export_data = mesh.export(file_type='glb')
                mimetype = 'model/gltf-binary'
            else:
                return jsonify({'error': f'Unsupported format: {format_type}'}), 400
        else:
            # Fallback for when trimesh is not available - create simple STL
            if format_type != 'stl':
                return jsonify({'error': 'Only STL format is available without trimesh library'}), 400
            
            # Create simple STL format manually
            export_data = create_simple_stl(scaled_vertices, faces)
            mimetype = 'model/stl'
            extension = 'stl'
        
        # Create filename
        base_filename = os.path.splitext(file_data['info']['filename'])[0]
        filename = f"{base_filename}_mesh.{extension}"
        
        # Return file
        return send_file(
            io.BytesIO(export_data),
            mimetype=mimetype,
            as_attachment=True,
            download_name=filename
        )
        
    except Exception as e:
        print(f"Mesh export error: {str(e)}")
        traceback.print_exc()
        return jsonify({
            'error': f'Error exporting mesh: {str(e)}'
        }), 500

@app.route('/api/export/volume/<file_id>', methods=['GET'])
def export_volume(file_id):
    """Export normalized volume data"""
    try:
        if file_id not in uploaded_files:
            return jsonify({'error': f'File {file_id} not found'}), 404
        
        file_data = uploaded_files[file_id]
        data = file_data.get('normalized_data', file_data['data'])
        nii_img = file_data['nii_img']
        
        # Create new NIfTI image with normalized data
        new_img = nib.Nifti1Image(data, nii_img.affine, nii_img.header)
        
        # Save to bytes
        file_bytes = io.BytesIO()
        nib.save(new_img, file_bytes)
        file_bytes.seek(0)
        
        # Compress if requested
        compress = request.args.get('compress', 'true').lower() == 'true'
        
        if compress:
            compressed = io.BytesIO()
            with gzip.GzipFile(fileobj=compressed, mode='wb') as gz:
                gz.write(file_bytes.read())
            compressed.seek(0)
            file_bytes = compressed
            extension = '.nii.gz'
            mimetype = 'application/gzip'
        else:
            extension = '.nii'
            mimetype = 'application/octet-stream'
        
        # Create filename
        base_filename = os.path.splitext(file_data['info']['filename'])[0]
        norm_method = file_data.get('normalization_method', 'original')
        filename = f"{base_filename}_{norm_method}{extension}"
        
        return send_file(
            file_bytes,
            mimetype=mimetype,
            as_attachment=True,
            download_name=filename
        )
        
    except Exception as e:
        print(f"Volume export error: {str(e)}")
        traceback.print_exc()
        return jsonify({
            'error': f'Error exporting volume: {str(e)}'
        }), 500

@app.route('/api/slice/<file_id>/<view_type>/<int:slice_index>', methods=['GET'])
def get_slice(file_id, view_type, slice_index):
    """Get a specific slice with performance optimization"""
    try:
        if file_id not in uploaded_files:
            return jsonify({'error': f'File {file_id} not found'}), 404
        
        file_data = uploaded_files[file_id]
        data = file_data.get('normalized_data', file_data['data'])
        
        # Cache key for slice data
        cache_key = f"slice_{file_id}_{view_type}_{slice_index}"
        
        # Check cache first
        with cache_lock:
            if cache_key in processing_cache:
                cached_response = processing_cache[cache_key]
                return jsonify(cached_response)
        
        # Extract slice based on view type
        if view_type == 'axial':
            max_slices = data.shape[2]
            if slice_index >= max_slices:
                return jsonify({'error': f'Slice index out of range. Max: {max_slices-1}'}), 400
            slice_data = data[:, :, slice_index]
        elif view_type == 'coronal':
            max_slices = data.shape[1]
            if slice_index >= max_slices:
                return jsonify({'error': f'Slice index out of range. Max: {max_slices-1}'}), 400
            slice_data = data[:, slice_index, :]
        elif view_type == 'sagittal':
            max_slices = data.shape[0]
            if slice_index >= max_slices:
                return jsonify({'error': f'Slice index out of range. Max: {max_slices-1}'}), 400
            slice_data = data[slice_index, :, :]
        else:
            return jsonify({'error': 'Invalid view type'}), 400
        
        # Apply orientation corrections
        if view_type == 'axial':
            slice_data = np.rot90(slice_data, k=1)
            slice_data = np.fliplr(slice_data)
        elif view_type == 'coronal':
            # Fixed coronal orientation - no vertical flip
            slice_data = np.rot90(slice_data, k=1)
            # Remove the flipud that was causing upside-down view
        elif view_type == 'sagittal':
            slice_data = np.rot90(slice_data, k=1)
            slice_data = np.flipud(slice_data)
        
        # Apply processing parameters
        apply_blur = request.args.get('blur', '0')
        blur_sigma = float(apply_blur) if apply_blur != '0' else 0
        
        if blur_sigma > 0:
            slice_data = gaussian_filter(slice_data, sigma=blur_sigma)
        
        # Calculate statistics
        slice_min = float(np.min(slice_data))
        slice_max = float(np.max(slice_data))
        slice_mean = float(np.mean(slice_data))
        slice_std = float(np.std(slice_data))
        
        # Normalize to 0-255 for display
        if slice_max > slice_min:
            slice_normalized = ((slice_data - slice_min) / (slice_max - slice_min) * 255).astype(np.uint8)
        else:
            slice_normalized = np.zeros_like(slice_data, dtype=np.uint8)
        
        response_data = {
            'success': True,
            'slice_data': slice_normalized.tolist(),
            'slice_shape': list(slice_data.shape),
            'slice_index': int(slice_index),
            'max_slices': int(max_slices),
            'statistics': {
                'min': slice_min,
                'max': slice_max,
                'mean': slice_mean,
                'std': slice_std
            },
            'view_type': view_type
        }
        
        # Cache the response
        with cache_lock:
            processing_cache[cache_key] = response_data
        
        return jsonify(response_data)
        
    except Exception as e:
        print(f"Slice error: {str(e)}")
        traceback.print_exc()
        return jsonify({
            'error': f'Error getting slice: {str(e)}'
        }), 500

@app.route('/api/performance/clear_cache', methods=['POST'])
def clear_cache():
    """Clear processing cache to free memory"""
    try:
        with cache_lock:
            processing_cache.clear()
        
        return jsonify({
            'success': True,
            'message': 'Cache cleared successfully'
        })
    except Exception as e:
        return jsonify({
            'error': f'Error clearing cache: {str(e)}'
        }), 500

@app.route('/api/performance/stats', methods=['GET'])
def get_performance_stats():
    """Get performance statistics"""
    try:
        with cache_lock:
            cache_size = len(processing_cache)
            memory_usage = sum(
                obj.get('data', np.array([])).nbytes 
                for obj in processing_cache.values()
            ) / (1024 * 1024)  # Convert to MB
        
        stats = {
            'cache_entries': cache_size,
            'cache_memory_mb': float(memory_usage),
            'loaded_files': len(uploaded_files),
            'max_file_size_mb': app.config['MAX_CONTENT_LENGTH'] / (1024 * 1024)
        }
        
        return jsonify({
            'success': True,
            'stats': stats
        })
    except Exception as e:
        return jsonify({
            'error': f'Error getting stats: {str(e)}'
        }), 500

def create_simple_stl(vertices, faces):
    """Create a simple ASCII STL file without trimesh"""
    stl_string = "solid mesh\n"
    
    for face in faces:
        # Get vertices for this face
        v1 = vertices[face[0]]
        v2 = vertices[face[1]]
        v3 = vertices[face[2]]
        
        # Calculate normal (simplified)
        edge1 = v2 - v1
        edge2 = v3 - v1
        normal = np.cross(edge1, edge2)
        normal = normal / np.linalg.norm(normal) if np.linalg.norm(normal) > 0 else normal
        
        stl_string += f"  facet normal {normal[0]} {normal[1]} {normal[2]}\n"
        stl_string += "    outer loop\n"
        stl_string += f"      vertex {v1[0]} {v1[1]} {v1[2]}\n"
        stl_string += f"      vertex {v2[0]} {v2[1]} {v2[2]}\n"
        stl_string += f"      vertex {v3[0]} {v3[1]} {v3[2]}\n"
        stl_string += "    endloop\n"
        stl_string += "  endfacet\n"
    
    stl_string += "endsolid mesh\n"
    return stl_string.encode('utf-8')

@app.route('/api/test', methods=['GET'])
def test_route():
    """Test route to verify routes are being added"""
    return jsonify({'message': 'Test route works!'})

@app.route('/api/analysis/<file_id>')
def analysis_route(file_id):
    """Get detailed analysis of the loaded data"""
    try:
        print(f"Analysis requested for file_id: {file_id}")
        print(f"Available files: {list(uploaded_files.keys())}")
        
        if file_id not in uploaded_files:
            return jsonify({
                'error': f'File {file_id} not found', 
                'available_files': list(uploaded_files.keys())
            }), 404
        
        file_data = uploaded_files[file_id]
        data = file_data.get('normalized_data', file_data['data'])
        nii_img = file_data['nii_img']
        
        # Get voxel spacing for volume calculations
        zooms = nii_img.header.get_zooms()[:3]
        voxel_volume = float(np.prod(zooms))
        
        # Calculate comprehensive statistics
        non_zero_mask = data != 0
        non_zero_data = data[non_zero_mask]
        
        # Volume measurements
        total_voxels = int(data.size)
        non_zero_voxels = int(np.sum(non_zero_mask))
        total_volume_mm3 = total_voxels * voxel_volume
        tissue_volume_mm3 = non_zero_voxels * voxel_volume
        
        # Intensity statistics
        stats = {
            'volume_analysis': {
                'total_voxels': total_voxels,
                'tissue_voxels': non_zero_voxels,
                'background_voxels': total_voxels - non_zero_voxels,
                'total_volume_mm3': float(total_volume_mm3),
                'tissue_volume_mm3': float(tissue_volume_mm3),
                'tissue_percentage': float(non_zero_voxels / total_voxels * 100) if total_voxels > 0 else 0,
                'voxel_volume_mm3': voxel_volume
            },
            'intensity_statistics': {
                'global_min': float(np.min(data)),
                'global_max': float(np.max(data)),
                'global_mean': float(np.mean(data)),
                'global_std': float(np.std(data)),
                'tissue_min': float(np.min(non_zero_data)) if non_zero_data.size > 0 else 0.0,
                'tissue_max': float(np.max(non_zero_data)) if non_zero_data.size > 0 else 0.0,
                'tissue_mean': float(np.mean(non_zero_data)) if non_zero_data.size > 0 else 0.0,
                'tissue_std': float(np.std(non_zero_data)) if non_zero_data.size > 0 else 0.0
            },
            'histogram_data': {
                'bins': [],
                'counts': []
            },
            'normalization_info': {
                'applied': file_data.get('normalization_method') is not None,
                'method': file_data.get('normalization_method', 'none'),
                'params': file_data.get('normalization_params', {})
            }
        }
        
        # Calculate histogram for non-zero data
        if non_zero_data.size > 0:
            hist_counts, hist_bins = np.histogram(non_zero_data, bins=50)
            stats['histogram_data'] = {
                'bins': hist_bins[:-1].tolist(),
                'counts': hist_counts.tolist()
            }
        
        # Calculate percentiles for tissue data
        if non_zero_data.size > 0:
            percentiles = [5, 25, 50, 75, 95]
            percentile_values = np.percentile(non_zero_data, percentiles)
            stats['intensity_statistics']['percentiles'] = {
                f'p{p}': float(v) for p, v in zip(percentiles, percentile_values)
            }
        
        return jsonify({
            'success': True,
            'analysis': convert_numpy_types(stats),
            'file_info': file_data['info']
        })
        
    except Exception as e:
        print(f"Analysis error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': f'Error performing analysis: {str(e)}'
        }), 500

@app.route('/api/files')
def files_route():
    """List all uploaded files for debugging"""
    try:
        file_list = []
        for file_id, file_data in uploaded_files.items():
            file_list.append({
                'file_id': file_id,
                'filename': file_data['info']['filename'],
                'shape': file_data['info']['shape'],
                'file_type': file_data['info']['file_type'],
                'normalized': file_data.get('normalization_method') is not None
            })
        
        return jsonify({
            'success': True,
            'files': file_list,
            'count': len(file_list)
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Error listing files: {str(e)}'
        }), 500
if __name__ == '__main__':
    print("Starting Flask backend with advanced features...")
    print(f"Upload folder: {app.config['UPLOAD_FOLDER']}")
    print("Available routes:")
    for rule in app.url_map.iter_rules():
        print(f"  {rule}")
    app.run(debug=True, host='0.0.0.0', port=5000)