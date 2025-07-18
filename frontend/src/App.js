// src/App.js - Updated with Mesh Normalization Support
import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';

// Authentication components
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './components/Login';
import Register from './components/Register';
import AdminDashboard from './components/AdminDashboard';

// Main application components
import Header from './components/Header';
import ControlPanel from './components/ControlPanel';
import VisualizationPanel from './components/VisualizationPanel';
import StatusBar from './components/StatusBar';
import AnalysisPanel from './components/AnalysisPanel';
import NormalizationPanel from './components/NormalizationPanel';
import ExportPanel from './components/ExportPanel';

// API configuration
const API_BASE_URL = 'http://localhost:5000/api';

// Main BrainOS Dashboard Component
const BrainOSDashboard = () => {
  const { user, logout, authenticatedFetch } = useAuth();
  
  // Initialize application state
  const [appState, setAppState] = useState({
    // File data
    brainFile: null,
    lesionFile: null,
    
    // Loading and UI state
    isLoading: false,
    showAnalysisPanel: false,
    showNormalizationPanel: false,
    showExportPanel: false,
    showPerformanceStats: false,
    
    // View mode
    viewMode: '3D',
    
    // Image processing parameters
    windowLevel: 40,
    windowWidth: 80,
    contrast: 1.0,
    brightness: 0,
    threshold: 128,
    blurValue: 0,
    
    // 2D Slice viewing parameters
    showCrosshair: true,
    showGrid: false,
    showMeasurements: false,
    zoomLevel: 1.0,
    panOffset: { x: 0, y: 0 },
    
    // Display options
    brainOpacity: 0.8,
    lesionOpacity: 0.9,
    brainColor: '#ff99cc',
    lesionColor: '#ff4d4d',
    colormap: 'gray',
    
    // 3D Visualization options
    meshThreshold: 0.1,
    regenerateMesh: 0,
    
    // Normalization state (intensity - deprecated)
    normalizationApplied: false,
    normalizationMethod: null,
    
    // NEW: Mesh Normalization state
    meshNormalizationApplied: false,
    meshNormalizationMethod: null,
    meshNormalizationParams: null,
    meshNormalizationStats: null,
    
    // Action triggers
    takeScreenshot: 0,
    exportData: 0,
    clearMeasurements: 0,
    clearCache: 0,
    clearMeshNormalization: 0,
    
    // Performance
    performanceStats: null,
    
    // Status and messages
    statusMessage: `Welcome ${user?.prenom || 'User'} - Load a NIFTI file to begin`,
    errorMessage: null
  });

  // Update a single parameter in app state
  const updateParameter = (key, value) => {
    console.log(`Updating parameter: ${key} = ${value}`);
    setAppState(prevState => ({
      ...prevState,
      [key]: value
    }));
  };

  // Handle file upload with authentication
  const handleFileUpload = async (file, fileType) => {
    try {
      setAppState(prevState => ({
        ...prevState,
        isLoading: true,
        statusMessage: `Uploading ${fileType} file...`,
        errorMessage: null,
        // Reset mesh normalization when new file is loaded
        meshNormalizationApplied: false,
        meshNormalizationMethod: null,
        meshNormalizationParams: null,
        meshNormalizationStats: null
      }));

      console.log('🔄 Starting file upload:', file.name, 'Type:', fileType);

      // Create FormData for file upload
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', fileType);

      // Use authenticatedFetch for proper CORS and auth headers
      const response = await authenticatedFetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        console.log('✅ Upload successful:', data);
        
        // Update state with file information
        const fileKey = fileType === 'brain' ? 'brainFile' : 'lesionFile';
        setAppState(prevState => ({
          ...prevState,
          [fileKey]: data.file_info,
          isLoading: false,
          statusMessage: `${fileType.charAt(0).toUpperCase() + fileType.slice(1)} file loaded successfully`,
          errorMessage: null,
          normalizationApplied: false,
          normalizationMethod: null,
          // Keep mesh normalization reset
          meshNormalizationApplied: false,
          meshNormalizationMethod: null,
          meshNormalizationParams: null,
          meshNormalizationStats: null
        }));

        // Show trial reminder if applicable
        if (data.trial_status && data.trial_status.days_remaining <= 2) {
          setAppState(prevState => ({
            ...prevState,
            statusMessage: `${prevState.statusMessage} - ⚠️ ${data.trial_status.days_remaining} jours restants dans votre essai`
          }));
        }
      } else {
        throw new Error(data.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      setAppState(prevState => ({
        ...prevState,
        isLoading: false,
        statusMessage: 'Upload failed',
        errorMessage: error.message
      }));
    }
  };

  // Handle mesh normalization complete - NEW FUNCTION
  const handleMeshNormalizationComplete = useCallback((normalizationInfo) => {
    console.log('🔧 Mesh normalization completed:', normalizationInfo);
    
    setAppState(prevState => ({
      ...prevState,
      meshNormalizationApplied: true,
      meshNormalizationMethod: normalizationInfo.method,
      meshNormalizationParams: normalizationInfo.params,
      meshNormalizationStats: normalizationInfo.stats,
      statusMessage: `Mesh normalization applied: ${normalizationInfo.method === 'cartesian' ? 'Cartésienne' : 'Sphérique'}`,
      regenerateMesh: Date.now() // Trigger mesh regeneration
    }));
  }, []);

  // Handle intensity normalization complete (deprecated but kept for compatibility)
  const handleNormalizationComplete = useCallback((normalizationInfo) => {
    setAppState(prevState => ({
      ...prevState,
      normalizationApplied: true,
      normalizationMethod: normalizationInfo.method,
      statusMessage: `Intensity normalization applied: ${normalizationInfo.method}`,
      regenerateMesh: Date.now()
    }));
  }, []);

  // Clear mesh normalization - NEW FUNCTION
  useEffect(() => {
    if (appState.clearMeshNormalization > 0) {
      console.log('🗑️ Clearing mesh normalization...');
      
      setAppState(prevState => ({
        ...prevState,
        meshNormalizationApplied: false,
        meshNormalizationMethod: null,
        meshNormalizationParams: null,
        meshNormalizationStats: null,
        statusMessage: 'Mesh normalization cleared - using original mesh',
        regenerateMesh: Date.now()
      }));
    }
  }, [appState.clearMeshNormalization]);

  // Clear cache
  useEffect(() => {
    if (appState.clearCache > 0) {
      authenticatedFetch(`${API_BASE_URL}/performance/clear_cache`, { 
        method: 'POST'
      })
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            updateParameter('statusMessage', 'Cache cleared successfully');
          }
        })
        .catch(error => {
          console.error('Clear cache error:', error);
        });
    }
  }, [appState.clearCache, authenticatedFetch]);

  // Get performance stats
  useEffect(() => {
    if (appState.showPerformanceStats) {
      authenticatedFetch(`${API_BASE_URL}/performance/stats`)
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            updateParameter('performanceStats', data.stats);
          }
        })
        .catch(error => {
          console.error('Performance stats error:', error);
        });
    }
  }, [appState.showPerformanceStats, authenticatedFetch]);

  // Reset application to initial state
  const handleReset = () => {
    setAppState({
      // File data
      brainFile: null,
      lesionFile: null,
      
      // Loading and UI state
      isLoading: false,
      showAnalysisPanel: false,
      showNormalizationPanel: false,
      showExportPanel: false,
      showPerformanceStats: false,
      
      // View mode
      viewMode: '3D',
      
      // Image processing
      windowLevel: 40,
      windowWidth: 80,
      contrast: 1.0,
      brightness: 0,
      threshold: 128,
      blurValue: 0,
      
      // 2D viewing
      showCrosshair: true,
      showGrid: false,
      showMeasurements: false,
      zoomLevel: 1.0,
      panOffset: { x: 0, y: 0 },
      
      // Display
      brainOpacity: 0.8,
      lesionOpacity: 0.9,
      brainColor: '#ff99cc',
      lesionColor: '#ff4d4d',
      colormap: 'gray',
      
      // 3D visualization
      meshThreshold: 0.1,
      regenerateMesh: 0,
      
      // Normalization (intensity - deprecated)
      normalizationApplied: false,
      normalizationMethod: null,
      
      // Mesh normalization
      meshNormalizationApplied: false,
      meshNormalizationMethod: null,
      meshNormalizationParams: null,
      meshNormalizationStats: null,
      
      // Action triggers
      takeScreenshot: 0,
      exportData: 0,
      clearMeasurements: 0,
      clearCache: 0,
      clearMeshNormalization: 0,
      
      // Performance
      performanceStats: null,
      
      // Status
      statusMessage: 'Application reset - Load a NIFTI file to begin',
      errorMessage: null
    });
  };

  return (
    <div className="app">
      <Header 
        appState={appState}
        onReset={handleReset}
        user={user}
        onLogout={logout}
      />
      
      <div className="app-content">
        <ControlPanel 
          appState={appState}
          onFileUpload={handleFileUpload}
          onParameterUpdate={updateParameter}
        />
        <VisualizationPanel 
          appState={appState}
          onParameterUpdate={updateParameter}
        />
      </div>
      
      <StatusBar 
        appState={appState}
        user={user}
      />
      
      {/* Analysis Panel */}
      <AnalysisPanel
        appState={appState}
        isVisible={appState.showAnalysisPanel}
        onClose={() => updateParameter('showAnalysisPanel', false)}
      />
      
      {/* Normalization Panel - Updated for Mesh Geometry */}
      <NormalizationPanel
        appState={appState}
        isVisible={appState.showNormalizationPanel}
        onClose={() => updateParameter('showNormalizationPanel', false)}
        onNormalizationComplete={handleMeshNormalizationComplete}
      />
      
      {/* Export Panel */}
      <ExportPanel
        appState={appState}
        isVisible={appState.showExportPanel}
        onClose={() => updateParameter('showExportPanel', false)}
      />
      
      {/* Performance Stats Modal */}
      {appState.showPerformanceStats && appState.performanceStats && (
        <div className="performance-modal" style={{
          position: 'fixed',
          top: '20%',
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#2c3e50',
          border: '2px solid #3498db',
          borderRadius: '10px',
          padding: '20px',
          zIndex: 1500,
          minWidth: '300px',
          color: 'white'
        }}>
          <h3 style={{ margin: '0 0 15px 0' }}>📈 Performance Statistics</h3>
          <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
            <div>Cache Entries: {appState.performanceStats.cache_entries}</div>
            <div>Cache Memory: {appState.performanceStats.cache_memory_mb.toFixed(2)} MB</div>
            <div>Loaded Files: {appState.performanceStats.loaded_files}</div>
            <div>Max File Size: {appState.performanceStats.max_file_size_mb} MB</div>
            {appState.meshNormalizationApplied && (
              <>
                <hr style={{ margin: '10px 0', border: '1px solid #34495e' }} />
                <div style={{ color: '#27ae60' }}>
                  <strong>Mesh Normalization Active:</strong><br/>
                  Method: {appState.meshNormalizationMethod === 'cartesian' ? 'Cartésienne' : 'Sphérique'}
                </div>
              </>
            )}
          </div>
          <button
            onClick={() => updateParameter('showPerformanceStats', false)}
            style={{
              marginTop: '15px',
              background: '#3498db',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '8px 16px',
              cursor: 'pointer',
              width: '100%'
            }}
          >
            Close
          </button>
        </div>
      )}
      
      {/* Loading overlay */}
      {appState.isLoading && (
        <div className="loading-overlay">
          <div className="loading-content">
            <div className="loading-spinner"></div>
            <h3>Loading...</h3>
            <p>{appState.statusMessage}</p>
          </div>
        </div>
      )}
      
      {/* Error overlay */}
      {appState.errorMessage && (
        <div className="error-overlay" onClick={() => updateParameter('errorMessage', null)}>
          <div className="error-content">
            <h3>Error</h3>
            <p>{appState.errorMessage}</p>
            <button onClick={() => updateParameter('errorMessage', null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Auth wrapper component
const AuthWrapper = () => {
  const { user, loading, isAuthenticated, isAdmin, login } = useAuth();

  // Show loading while checking authentication
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: '#1a1a1a',
        color: 'white'
      }}>
        <div>
          <h2>Loading BrainOS...</h2>
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route 
        path="/login" 
        element={
          isAuthenticated() ? (
            isAdmin() ? <Navigate to="/admin-dashboard" replace /> : <Navigate to="/dashboard" replace />
          ) : (
            <Login onLogin={login} />
          )
        } 
      />
      <Route 
        path="/register" 
        element={
          isAuthenticated() ? (
            isAdmin() ? <Navigate to="/admin-dashboard" replace /> : <Navigate to="/dashboard" replace />
          ) : (
            <Register />
          )
        } 
      />
      
      {/* Protected routes */}
      <Route 
        path="/dashboard" 
        element={
          <ProtectedRoute requireTrial={true}>
            <BrainOSDashboard />
          </ProtectedRoute>
        } 
      />
      
      {/* Admin routes */}
      <Route 
        path="/admin-dashboard" 
        element={
          <ProtectedRoute requireAdmin={true}>
            <AdminDashboard />
          </ProtectedRoute>
        } 
      />
      
      {/* Default redirect based on authentication */}
      <Route 
        path="/" 
        element={
          isAuthenticated() ? (
            isAdmin() ? <Navigate to="/admin-dashboard" replace /> : <Navigate to="/dashboard" replace />
          ) : (
            <Navigate to="/login" replace />
          )
        } 
      />
      
      {/* Catch all route */}
      <Route 
        path="*" 
        element={
          isAuthenticated() ? (
            isAdmin() ? <Navigate to="/admin-dashboard" replace /> : <Navigate to="/dashboard" replace />
          ) : (
            <Navigate to="/login" replace />
          )
        } 
      />
    </Routes>
  );
};

// Main App Component with Authentication
function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <AuthWrapper />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;