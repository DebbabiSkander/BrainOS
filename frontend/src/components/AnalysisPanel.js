// components/AnalysisPanel.js - Statistical Analysis Component with Authentication
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext'; // Import useAuth

// API configuration
const API_BASE_URL = 'http://localhost:5000/api';

const AnalysisPanel = ({ appState, isVisible, onClose }) => {
  const { authenticatedFetch } = useAuth(); // Get authenticatedFetch from context
  const [analysisData, setAnalysisData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedFile, setSelectedFile] = useState('brain');

  // Load analysis data
  const loadAnalysis = async (fileId) => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Loading analysis for file:', fileId);
      
      // Use authenticatedFetch instead of regular fetch
      const response = await authenticatedFetch(`${API_BASE_URL}/analysis/${fileId}`);
      
      // Check if response is JSON
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        // If not JSON, it might be an HTML error page
        const text = await response.text();
        console.error('Non-JSON response:', text);
        throw new Error('Server returned non-JSON response. Check if backend is running.');
      }
      
      const data = await response.json();
      
      if (data.success) {
        setAnalysisData(data.analysis);
      } else {
        throw new Error(data.error || 'Failed to load analysis');
      }
    } catch (error) {
      console.error('Analysis error:', error);
      if (error.message.includes('Failed to fetch')) {
        setError('Cannot connect to server. Please ensure the Flask backend is running on http://localhost:5000');
      } else {
        setError(`Failed to load analysis: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Load analysis when panel opens or file selection changes
  useEffect(() => {
    if (!isVisible) return;
    
    const fileData = selectedFile === 'brain' ? appState.brainFile : appState.lesionFile;
    
    if (!fileData || !fileData.file_id) {
      console.log('No file data available for analysis');
      setError('No file selected for analysis');
      return;
    }
    
    // The file_id should be the filename as that's what's used as the key in the backend
    const fileId = fileData.file_id || fileData.filename;
    
    console.log('Loading analysis for:', {
      selectedFile,
      fileId,
      fileData
    });
    
    if (fileId) {
      loadAnalysis(fileId);
    }
  }, [isVisible, selectedFile, appState.brainFile, appState.lesionFile, appState.normalizationApplied, authenticatedFetch]);

  // Debug function to list available files
  const debugListFiles = async () => {
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/files`);
      const data = await response.json();
      console.log('Available files:', data);
      alert(`Available files:\n${JSON.stringify(data.files, null, 2)}`);
    } catch (e) {
      console.error('Failed to fetch file list:', e);
    }
  };

  if (!isVisible) return null;

  return (
    <div style={{
      position: 'fixed',
      top: '10%',
      left: '10%',
      width: '80%',
      height: '80%',
      background: '#2c3e50',
      border: '2px solid #3498db',
      borderRadius: '10px',
      zIndex: 2000,
      display: 'flex',
      flexDirection: 'column',
      color: 'white'
    }}>
      {/* Header */}
      <div style={{
        background: '#34495e',
        padding: '15px',
        borderRadius: '8px 8px 0 0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h3 style={{ margin: 0 }}>📊 Analyse Statistique</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <select
            value={selectedFile}
            onChange={(e) => setSelectedFile(e.target.value)}
            style={{
              background: '#2c3e50',
              color: 'white',
              border: '1px solid #3498db',
              borderRadius: '4px',
              padding: '5px'
            }}
          >
            {appState.brainFile && (
              <option value="brain">Cerveau - {appState.brainFile.filename}</option>
            )}
            {appState.lesionFile && (
              <option value="lesion">Lésions - {appState.lesionFile.filename}</option>
            )}
          </select>
          <button
            onClick={onClose}
            style={{
              background: '#e74c3c',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '8px 12px',
              cursor: 'pointer'
            }}
          >
            ✕ Fermer
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        padding: '20px',
        overflow: 'auto'
      }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '50px' }}>
            <div className="loading-spinner" style={{ 
              width: '40px', 
              height: '40px', 
              margin: '0 auto 20px' 
            }}></div>
            <p>Chargement de l'analyse...</p>
          </div>
        )}

        {error && (
          <div style={{
            background: 'rgba(231, 76, 60, 0.2)',
            padding: '15px',
            borderRadius: '5px',
            color: '#e74c3c',
            marginBottom: '20px'
          }}>
            {error}
            <div style={{ marginTop: '10px', fontSize: '12px' }}>
              <button
                onClick={debugListFiles}
                style={{
                  background: '#3498db',
                  color: 'white',
                  border: 'none',
                  padding: '5px 10px',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  fontSize: '11px'
                }}
              >
                Debug: List Available Files
              </button>
            </div>
          </div>
        )}

        {analysisData && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {/* Normalization Status */}
            {analysisData.normalization_info && (
              <div style={{
                gridColumn: '1 / -1',
                background: analysisData.normalization_info.applied ? '#27ae60' : '#34495e',
                padding: '15px',
                borderRadius: '8px',
                marginBottom: '10px'
              }}>
                <h4 style={{ margin: '0 0 10px 0', color: 'white' }}>
                  🔧 État de Normalisation
                </h4>
                {analysisData.normalization_info.applied ? (
                  <div>
                    <div><strong>Méthode appliquée:</strong> {analysisData.normalization_info.method}</div>
                    {analysisData.normalization_info.params && Object.keys(analysisData.normalization_info.params).length > 0 && (
                      <div><strong>Paramètres:</strong> {JSON.stringify(analysisData.normalization_info.params)}</div>
                    )}
                  </div>
                ) : (
                  <div>Aucune normalisation appliquée</div>
                )}
              </div>
            )}

            {/* Volume Analysis */}
            <div style={{
              background: '#34495e',
              padding: '15px',
              borderRadius: '8px'
            }}>
              <h4 style={{ margin: '0 0 15px 0', color: '#3498db' }}>📏 Analyse Volumétrique</h4>
              <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
                <div><strong>Volume total:</strong> {(analysisData.volume_analysis.total_volume_mm3 / 1000).toFixed(2)} cm³</div>
                <div><strong>Volume tissu:</strong> {(analysisData.volume_analysis.tissue_volume_mm3 / 1000).toFixed(2)} cm³</div>
                <div><strong>Pourcentage tissu:</strong> {analysisData.volume_analysis.tissue_percentage.toFixed(1)}%</div>
                <div><strong>Voxels totaux:</strong> {analysisData.volume_analysis.total_voxels.toLocaleString()}</div>
                <div><strong>Voxels tissu:</strong> {analysisData.volume_analysis.tissue_voxels.toLocaleString()}</div>
                <div><strong>Résolution voxel:</strong> {analysisData.volume_analysis.voxel_volume_mm3.toFixed(3)} mm³</div>
              </div>
            </div>

            {/* Intensity Statistics */}
            <div style={{
              background: '#34495e',
              padding: '15px',
              borderRadius: '8px'
            }}>
              <h4 style={{ margin: '0 0 15px 0', color: '#3498db' }}>📈 Statistiques d'Intensité</h4>
              <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
                <div><strong>Min global:</strong> {analysisData.intensity_statistics.global_min.toFixed(2)}</div>
                <div><strong>Max global:</strong> {analysisData.intensity_statistics.global_max.toFixed(2)}</div>
                <div><strong>Moyenne globale:</strong> {analysisData.intensity_statistics.global_mean.toFixed(2)}</div>
                <div><strong>Écart-type global:</strong> {analysisData.intensity_statistics.global_std.toFixed(2)}</div>
                <hr style={{ margin: '10px 0', border: '1px solid #2c3e50' }} />
                <div><strong>Moyenne tissu:</strong> {analysisData.intensity_statistics.tissue_mean.toFixed(2)}</div>
                <div><strong>Écart-type tissu:</strong> {analysisData.intensity_statistics.tissue_std.toFixed(2)}</div>
              </div>
            </div>

            {/* Percentiles */}
            {analysisData.intensity_statistics.percentiles && (
              <div style={{
                background: '#34495e',
                padding: '15px',
                borderRadius: '8px'
              }}>
                <h4 style={{ margin: '0 0 15px 0', color: '#3498db' }}>📊 Percentiles</h4>
                <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
                  <div><strong>5e percentile:</strong> {analysisData.intensity_statistics.percentiles.p5.toFixed(2)}</div>
                  <div><strong>25e percentile:</strong> {analysisData.intensity_statistics.percentiles.p25.toFixed(2)}</div>
                  <div><strong>Médiane (50e):</strong> {analysisData.intensity_statistics.percentiles.p50.toFixed(2)}</div>
                  <div><strong>75e percentile:</strong> {analysisData.intensity_statistics.percentiles.p75.toFixed(2)}</div>
                  <div><strong>95e percentile:</strong> {analysisData.intensity_statistics.percentiles.p95.toFixed(2)}</div>
                </div>
              </div>
            )}

            {/* Histogram Visualization */}
            {analysisData.histogram_data && analysisData.histogram_data.bins.length > 0 && (
              <div style={{
                background: '#34495e',
                padding: '15px',
                borderRadius: '8px'
              }}>
                <h4 style={{ margin: '0 0 15px 0', color: '#3498db' }}>📊 Histogramme</h4>
                <div style={{
                  height: '200px',
                  display: 'flex',
                  alignItems: 'end',
                  justifyContent: 'space-between',
                  background: '#2c3e50',
                  padding: '10px',
                  borderRadius: '4px'
                }}>
                  {analysisData.histogram_data.counts.map((count, index) => {
                    const maxCount = Math.max(...analysisData.histogram_data.counts);
                    const height = (count / maxCount) * 160;
                    return (
                      <div
                        key={index}
                        style={{
                          background: '#3498db',
                          width: `${Math.max(100 / analysisData.histogram_data.counts.length - 1, 2)}%`,
                          height: `${height}px`,
                          margin: '0 1px'
                        }}
                        title={`Bin ${index}: ${count} voxels`}
                      />
                    );
                  })}
                </div>
                <div style={{ 
                  fontSize: '12px', 
                  color: '#bdc3c7', 
                  marginTop: '5px',
                  textAlign: 'center'
                }}>
                  Distribution des intensités (hors zéros)
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        background: '#34495e',
        padding: '10px 15px',
        borderRadius: '0 0 8px 8px',
        fontSize: '12px',
        color: '#bdc3c7',
        textAlign: 'center'
      }}>
        Analyse générée automatiquement • Données en temps réel
        {analysisData?.normalization_info?.applied && ' • Données normalisées'}
      </div>
    </div>
  );
};

export default AnalysisPanel;