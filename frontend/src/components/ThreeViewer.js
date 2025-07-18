// components/ThreeViewer.js - Updated with Lesion Coordinate Support
import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { useAuth } from '../contexts/AuthContext';

// API configuration
const API_BASE_URL = 'http://localhost:5000/api';

// Simple orbit controls implementation
class SimpleOrbitControls {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;
    this.enabled = true;
    this.autoRotate = false;
    this.autoRotateSpeed = 2.0;
    
    // Internal state
    this.isMouseDown = false;
    this.mouseButton = -1;
    this.previousMousePosition = { x: 0, y: 0 };
    this.spherical = new THREE.Spherical();
    this.sphericalDelta = new THREE.Spherical();
    this.target = new THREE.Vector3();
    this.distance = 0;
    
    // Initialize
    this.init();
    this.update();
  }
  
  init() {
    // Calculate initial spherical coordinates
    const offset = new THREE.Vector3();
    offset.copy(this.camera.position).sub(this.target);
    this.spherical.setFromVector3(offset);
    this.distance = this.spherical.radius;
    
    // Add event listeners
    this.domElement.addEventListener('mousedown', this.onMouseDown.bind(this));
    this.domElement.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.domElement.addEventListener('mouseup', this.onMouseUp.bind(this));
    this.domElement.addEventListener('wheel', this.onMouseWheel.bind(this));
    this.domElement.addEventListener('contextmenu', this.onContextMenu.bind(this));
  }
  
  onMouseDown(event) {
    if (!this.enabled) return;
    
    this.isMouseDown = true;
    this.mouseButton = event.button;
    this.previousMousePosition = {
      x: event.clientX,
      y: event.clientY
    };
  }
  
  onMouseMove(event) {
    if (!this.enabled || !this.isMouseDown) return;
    
    const deltaX = event.clientX - this.previousMousePosition.x;
    const deltaY = event.clientY - this.previousMousePosition.y;
    
    if (this.mouseButton === 0) { // Left button - rotate
      this.sphericalDelta.theta -= deltaX * 0.01;
      this.sphericalDelta.phi -= deltaY * 0.01;
    } else if (this.mouseButton === 2) { // Right button - pan
      const panOffset = new THREE.Vector3();
      panOffset.copy(this.camera.up).multiplyScalar(deltaY * 0.1);
      panOffset.add(new THREE.Vector3().crossVectors(this.camera.up, this.camera.position).normalize().multiplyScalar(-deltaX * 0.1));
      this.target.add(panOffset);
    }
    
    this.previousMousePosition = {
      x: event.clientX,
      y: event.clientY
    };
  }
  
  onMouseUp() {
    this.isMouseDown = false;
    this.mouseButton = -1;
  }
  
  onMouseWheel(event) {
    if (!this.enabled) return;
    
    const scale = event.deltaY > 0 ? 1.1 : 0.9;
    this.distance *= scale;
    this.distance = Math.max(10, Math.min(500, this.distance));
  }
  
  onContextMenu(event) {
    event.preventDefault();
  }
  
  update() {
    if (this.autoRotate) {
      this.sphericalDelta.theta += this.autoRotateSpeed * 0.01;
    }
    
    // Apply deltas
    this.spherical.theta += this.sphericalDelta.theta;
    this.spherical.phi += this.sphericalDelta.phi;
    this.spherical.radius = this.distance;
    
    // Limit phi
    this.spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, this.spherical.phi));
    
    // Convert back to Cartesian coordinates
    const offset = new THREE.Vector3();
    offset.setFromSpherical(this.spherical);
    this.camera.position.copy(this.target).add(offset);
    this.camera.lookAt(this.target);
    
    // Reset deltas
    this.sphericalDelta.set(0, 0, 0);
  }
  
  dispose() {
    this.domElement.removeEventListener('mousedown', this.onMouseDown);
    this.domElement.removeEventListener('mousemove', this.onMouseMove);
    this.domElement.removeEventListener('mouseup', this.onMouseUp);
    this.domElement.removeEventListener('wheel', this.onMouseWheel);
    this.domElement.removeEventListener('contextmenu', this.onContextMenu);
  }
}

const ThreeViewer = ({ appState, onParameterUpdate }) => {
  const { authenticatedFetch } = useAuth(); 
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const animationIdRef = useRef(null);
  const brainMeshRef = useRef(null);
  const lesionMeshRef = useRef(null);
  
  const [brainMeshData, setBrainMeshData] = useState(null);
  const [lesionMeshData, setLesionMeshData] = useState(null);
  const [lesionCoordinates, setLesionCoordinates] = useState(null); // NEW: For lesion coordinates
  const [loadingMeshes, setLoadingMeshes] = useState(false);
  const [meshError, setMeshError] = useState(null);
  const [autoRotate, setAutoRotate] = useState(false);
  const [showWireframe, setShowWireframe] = useState(false);

  // Initialize Three.js scene
  useEffect(() => {
    if (!mountRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    sceneRef.current = scene;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      45,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(100, 100, 100);
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      preserveDrawingBuffer: true // For screenshots
    });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    mountRef.current.appendChild(renderer.domElement);

    // Controls setup
    const controls = new SimpleOrbitControls(camera, renderer.domElement);
    controlsRef.current = controls;

    // Lighting setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight1.position.set(10, 10, 10);
    directionalLight1.castShadow = true;
    scene.add(directionalLight1);

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.3);
    directionalLight2.position.set(-10, -10, -10);
    scene.add(directionalLight2);

    // Axes helper
    const axesHelper = new THREE.AxesHelper(50);
    scene.add(axesHelper);

    // Grid helper
    const gridHelper = new THREE.GridHelper(200, 20, 0x444444, 0x222222);
    scene.add(gridHelper);

    // Animation loop
    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);
      
      if (controlsRef.current) {
        controlsRef.current.autoRotate = autoRotate;
        controlsRef.current.update();
      }
      
      renderer.render(scene, camera);
    };
    animate();

    // Handle resize
    const handleResize = () => {
      if (mountRef.current) {
        const width = mountRef.current.clientWidth;
        const height = mountRef.current.clientHeight;
        
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
      }
    };

    window.addEventListener('resize', handleResize);

    // Cleanup function
    return () => {
      window.removeEventListener('resize', handleResize);
      
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      
      if (controlsRef.current) {
        controlsRef.current.dispose();
      }
      
      if (rendererRef.current && mountRef.current) {
        mountRef.current.removeChild(rendererRef.current.domElement);
        rendererRef.current.dispose();
      }
    };
  }, [autoRotate]);

  // Load mesh/coordinate data from backend
  const loadMeshData = useCallback(async (fileId, fileType) => {
    try {
      setLoadingMeshes(true);
      setMeshError(null);
      
      const threshold = fileType === 'brain' ? (appState.meshThreshold || 0.1) : 0.05;
      
      console.log(`Loading ${fileType} data with threshold: ${threshold}`);
      
      const response = await authenticatedFetch(
        `${API_BASE_URL}/mesh/${fileId}?threshold=${threshold}&smoothing=1.0&use_cache=true`
      );
      
      const data = await response.json();
      
      if (data.success) {
        // Check if this is lesion coordinate data or mesh data
        if (data.data_type === 'lesion_coordinates') {
          console.log(`${fileType} coordinates loaded:`, data.lesion_stats);
          setLesionCoordinates(data.lesion_data);
          setLesionMeshData(null); // Clear any existing mesh data
        } else {
          // Regular mesh data (brain)
          if (fileType === 'brain') {
            setBrainMeshData(data.mesh_data);
            console.log(`${fileType} mesh loaded:`, data.mesh_stats);
          } else {
            setLesionMeshData(data.mesh_data);
            console.log(`${fileType} mesh loaded:`, data.mesh_stats);
          }
        }
      } else {
        throw new Error(data.error || `Failed to load ${fileType} data`);
      }
    } catch (error) {
      console.error(`Error loading ${fileType} data:`, error);
      setMeshError(`Failed to load ${fileType} data: ${error.message}`);
    } finally {
      setLoadingMeshes(false);
    }
  }, [appState.meshThreshold, authenticatedFetch]);

  // Create lesion spheres from coordinate data
  const createLesionSpheres = useCallback((coordinateData, color, opacity) => {
    if (!coordinateData || !coordinateData.coordinates || coordinateData.coordinates.length === 0) {
      return null;
    }

    try {
      const coordinates = coordinateData.coordinates;
      console.log(`Creating lesion spheres for ${coordinates.length} lesions`);
      
      // Create a group to hold all lesion spheres
      const lesionGroup = new THREE.Group();
      
      // Create sphere geometry (reuse for all lesions)
      const sphereGeometry = new THREE.SphereGeometry(1.5, 8, 6); // Small sphere, low detail for performance
      
      // Create material
      const sphereMaterial = new THREE.MeshPhongMaterial({
        color: new THREE.Color(color),
        opacity: opacity,
        transparent: opacity < 1.0,
        shininess: 100,
        specular: 0x222222
      });
      
      // Limit the number of spheres for performance (take every nth lesion if too many)
      const maxSpheres = 5000; // Limit for performance
      const step = Math.max(1, Math.ceil(coordinates.length / maxSpheres));
      
      let sphereCount = 0;
      for (let i = 0; i < coordinates.length; i += step) {
        const coord = coordinates[i];
        if (coord && coord.length >= 3) {
          const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
          sphere.position.set(coord[0], coord[1], coord[2]);
          lesionGroup.add(sphere);
          sphereCount++;
        }
      }
      
      console.log(`Created ${sphereCount} lesion spheres (from ${coordinates.length} coordinates)`);
      
      return lesionGroup;
    } catch (error) {
      console.error('Error creating lesion spheres:', error);
      return null;
    }
  }, []);

  // Create mesh from data
  const createMesh = useCallback((meshData, color, opacity, wireframe = false) => {
    if (!meshData || !meshData.vertices || !meshData.faces) {
      return null;
    }

    try {
      // Create geometry
      const geometry = new THREE.BufferGeometry();
      
      // Convert vertices to Float32Array
      const vertices = new Float32Array(meshData.vertices.flat());
      geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      
      // Convert faces to indices
      const indices = new Uint32Array(meshData.faces.flat());
      geometry.setIndex(new THREE.BufferAttribute(indices, 1));
      
      // Compute normals for proper lighting
      geometry.computeVertexNormals();
      
      // Create material
      const material = new THREE.MeshPhongMaterial({
        color: new THREE.Color(color),
        opacity: opacity,
        transparent: opacity < 1.0,
        wireframe: wireframe,
        side: THREE.DoubleSide,
        shininess: 100,
        specular: 0x222222
      });
      
      // Create mesh
      const mesh = new THREE.Mesh(geometry, material);
      
      console.log(`Created mesh with ${vertices.length/3} vertices and ${indices.length/3} faces`);
      
      return mesh;
    } catch (error) {
      console.error('Error creating mesh:', error);
      return null;
    }
  }, []);

  // Update brain mesh
  useEffect(() => {
    if (!sceneRef.current) return;

    // Remove existing brain mesh
    if (brainMeshRef.current) {
      sceneRef.current.remove(brainMeshRef.current);
      brainMeshRef.current.geometry.dispose();
      brainMeshRef.current.material.dispose();
      brainMeshRef.current = null;
    }

    // Create new brain mesh
    if (brainMeshData && appState.viewMode === '3D') {
      const mesh = createMesh(
        brainMeshData, 
        appState.brainColor, 
        appState.brainOpacity,
        showWireframe
      );
      
      if (mesh) {
        sceneRef.current.add(mesh);
        brainMeshRef.current = mesh;
      }
    }
  }, [brainMeshData, appState.brainColor, appState.brainOpacity, appState.viewMode, showWireframe, createMesh]);

  // Update lesion mesh/spheres
  useEffect(() => {
    if (!sceneRef.current) return;

    // Remove existing lesion mesh
    if (lesionMeshRef.current) {
      sceneRef.current.remove(lesionMeshRef.current);
      
      // Dispose of geometry and materials
      if (lesionMeshRef.current.geometry) {
        lesionMeshRef.current.geometry.dispose();
      }
      if (lesionMeshRef.current.material) {
        if (Array.isArray(lesionMeshRef.current.material)) {
          lesionMeshRef.current.material.forEach(material => material.dispose());
        } else {
          lesionMeshRef.current.material.dispose();
        }
      }
      
      // If it's a group (lesion spheres), dispose of all children
      if (lesionMeshRef.current.children) {
        lesionMeshRef.current.children.forEach(child => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) child.material.dispose();
        });
      }
      
      lesionMeshRef.current = null;
    }

    // Create new lesion visualization
    if (appState.viewMode === '3D') {
      let lesionObject = null;
      
      // Check if we have coordinate data (new system)
      if (lesionCoordinates) {
        lesionObject = createLesionSpheres(
          lesionCoordinates,
          appState.lesionColor,
          appState.lesionOpacity
        );
        console.log('Created lesion spheres from coordinates');
      }
      // Fallback to mesh data (old system)
      else if (lesionMeshData) {
        lesionObject = createMesh(
          lesionMeshData,
          appState.lesionColor,
          appState.lesionOpacity,
          showWireframe
        );
        console.log('Created lesion mesh from mesh data');
      }
      
      if (lesionObject) {
        sceneRef.current.add(lesionObject);
        lesionMeshRef.current = lesionObject;
      }
    }
  }, [lesionCoordinates, lesionMeshData, appState.lesionColor, appState.lesionOpacity, appState.viewMode, showWireframe, createMesh, createLesionSpheres]);

  // Load brain mesh when brain file is available
  useEffect(() => {
    if (appState.brainFile && appState.brainFile.file_id) {
      loadMeshData(appState.brainFile.file_id, 'brain');
    } else {
      setBrainMeshData(null);
    }
  }, [appState.brainFile, appState.regenerateMesh, loadMeshData]);

  // Load lesion data when lesion file is available
  useEffect(() => {
    if (appState.lesionFile && appState.lesionFile.file_id) {
      loadMeshData(appState.lesionFile.file_id, 'lesion');
    } else {
      setLesionMeshData(null);
      setLesionCoordinates(null); // Clear lesion coordinates too
    }
  }, [appState.lesionFile, appState.regenerateMesh, loadMeshData]);

  // Handle camera reset
  useEffect(() => {
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(100, 100, 100);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.distance = cameraRef.current.position.length();
    }
  }, [appState.regenerateMesh]);

  // Handle screenshots
  useEffect(() => {
    if (appState.takeScreenshot > 0 && rendererRef.current) {
      try {
        const canvas = rendererRef.current.domElement;
        const link = document.createElement('a');
        link.download = `brainos_3d_view_${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        
        if (onParameterUpdate) {
          onParameterUpdate('statusMessage', 'Screenshot saved successfully');
        }
      } catch (error) {
        console.error('Screenshot error:', error);
        if (onParameterUpdate) {
          onParameterUpdate('statusMessage', 'Screenshot failed');
        }
      }
    }
  }, [appState.takeScreenshot, onParameterUpdate]);

  // Show 2D message for non-3D modes
  if (appState.viewMode !== '3D') {
    return (
      <div style={{ 
        width: '100%', 
        height: '100%', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        color: '#666',
        flexDirection: 'column',
        background: '#111'
      }}>
        <h3>2D Slice View Mode</h3>
        <p>Current mode: {appState.viewMode}</p>
        <p>Switch to 3D mode to see mesh visualization</p>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* 3D Controls Overlay */}
      <div style={{
        position: 'absolute',
        top: '10px',
        left: '10px',
        zIndex: 1000,
        background: 'rgba(0,0,0,0.8)',
        padding: '12px',
        borderRadius: '8px',
        color: 'white',
        fontSize: '13px',
        border: '1px solid #3498db'
      }}>
        <h4 style={{ margin: '0 0 10px 0', color: '#3498db' }}>🎛️ 3D Controls</h4>
        
        <div style={{ marginBottom: '8px' }}>
          <label style={{ display: 'flex', alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={autoRotate}
              onChange={(e) => setAutoRotate(e.target.checked)}
              style={{ marginRight: '8px' }}
            />
            🔄 Auto Rotate
          </label>
        </div>
        
        <div style={{ marginBottom: '8px' }}>
          <label style={{ display: 'flex', alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={showWireframe}
              onChange={(e) => setShowWireframe(e.target.checked)}
              style={{ marginRight: '8px' }}
            />
            🔲 Wireframe
          </label>
        </div>
        
        <div style={{ marginBottom: '10px', fontSize: '11px', color: '#bbb' }}>
          <div>🖱️ Left: Rotate</div>
          <div>🖱️ Right: Pan</div>
          <div>🎯 Wheel: Zoom</div>
        </div>
      </div>

      {/* Loading indicator */}
      {loadingMeshes && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 1000,
          background: 'rgba(0,0,0,0.9)',
          padding: '25px',
          borderRadius: '12px',
          color: 'white',
          textAlign: 'center',
          border: '2px solid #3498db'
        }}>
          <div style={{ 
            width: '40px', 
            height: '40px', 
            margin: '0 auto 15px',
            border: '4px solid #444',
            borderTop: '4px solid #3498db',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          <h3 style={{ margin: '0 0 10px 0' }}>🧠 Loading Data</h3>
          <p style={{ margin: '0', fontSize: '14px', opacity: 0.8 }}>
            Processing brain and lesion data...
          </p>
        </div>
      )}

      {/* Error message */}
      {meshError && (
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          zIndex: 1000,
          background: 'rgba(231, 76, 60, 0.95)',
          padding: '12px',
          borderRadius: '8px',
          color: 'white',
          fontSize: '13px',
          maxWidth: '300px',
          border: '1px solid #c0392b'
        }}>
          <strong>❌ Error:</strong><br />
          {meshError}
        </div>
      )}

      {/* Info overlay */}
      <div style={{
        position: 'absolute',
        bottom: '10px',
        left: '10px',
        zIndex: 1000,
        background: 'rgba(0,0,0,0.8)',
        padding: '12px',
        borderRadius: '8px',
        color: 'white',
        fontSize: '12px',
        border: '1px solid #34495e'
      }}>
        <div style={{ marginBottom: '5px', color: '#3498db', fontWeight: 'bold' }}>
          📊 Data Info
        </div>
        {brainMeshData && (
          <div>🧠 Brain: {brainMeshData.vertices.length.toLocaleString()} vertices</div>
        )}
        {lesionCoordinates && (
          <div>🔴 Lesions: {lesionCoordinates.coordinates.length.toLocaleString()} coordinates</div>
        )}
        {lesionMeshData && !lesionCoordinates && (
          <div>🔴 Lesion: {lesionMeshData.vertices.length.toLocaleString()} vertices</div>
        )}
        {appState.meshNormalizationApplied && (
          <div>⚡ Mesh Normalized: {appState.meshNormalizationMethod}</div>
        )}
        {(!brainMeshData && !lesionMeshData && !lesionCoordinates) && (
          <div style={{ color: '#95a5a6' }}>No data loaded</div>
        )}
      </div>

      {/* Three.js mount point */}
      <div 
        ref={mountRef} 
        style={{ 
          width: '100%', 
          height: '100%',
          cursor: 'grab'
        }}
        onMouseDown={(e) => e.target.style.cursor = 'grabbing'}
        onMouseUp={(e) => e.target.style.cursor = 'grab'}
      />
      
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default ThreeViewer;