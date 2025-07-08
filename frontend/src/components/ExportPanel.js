// components/ExportPanel.js - Simple Robust Export Panel
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const API_BASE_URL = 'http://localhost:5000/api';

const ExportPanel = ({ appState, isVisible, onClose }) => {
  const { authenticatedFetch } = useAuth();
  const [exportType, setExportType] = useState('mesh');
  const [meshParameters, setMeshParameters] = useState({
    threshold: 0.3, // Higher default threshold for smaller meshes
    smoothing: 1.0
  });
  const [volumeCompression, setVolumeCompression] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState(null);
  const [selectedFile, setSelectedFile] = useState('brain');

  const handleMeshExport = async () => {
    try {
      setIsExporting(true);
      setExportStatus('Génération du mesh STL...');

      const fileId = selectedFile === 'brain' 
        ? appState.brainFile?.file_id 
        : appState.lesionFile?.file_id;

      if (!fileId) {
        throw new Error('Aucun fichier sélectionné');
      }

      console.log(`Starting mesh export for ${fileId} with threshold ${meshParameters.threshold}`);

      // Skip mesh size check - go directly to export with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
        setExportStatus('❌ Timeout: Le mesh est trop volumineux. Essayez un seuil plus élevé (40-50%).');
      }, 120000); // 2 minute timeout

      try {
        const url = `${API_BASE_URL}/export/mesh/${fileId}?` +
          `threshold=${meshParameters.threshold}&` +
          `smoothing=${meshParameters.smoothing}&` +
          `format=stl`;

        console.log('Fetching mesh export from:', url);

        const response = await authenticatedFetch(url, {
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Export failed:', response.status, errorText);
          throw new Error(`Export failed: ${response.status}`);
        }

        // Get filename
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = `brain_mesh_${Date.now()}.stl`;
        if (contentDisposition) {
          const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
          if (matches && matches[1]) {
            filename = matches[1].replace(/['"]/g, '');
          }
        }

        console.log('Download starting for file:', filename);

        // Download the file
        const blob = await response.blob();
        const fileSizeMB = (blob.size / 1024 / 1024).toFixed(2);
        
        console.log(`File downloaded: ${fileSizeMB} MB`);

        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(downloadUrl);

        setExportStatus(`✅ Export réussi! ${filename} (${fileSizeMB} MB)`);
        setTimeout(() => setExportStatus(null), 5000);

      } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          console.log('Export aborted due to timeout');
          return; // Status already set by timeout handler
        }
        throw error;
      }

    } catch (error) {
      console.error('Mesh export error:', error);
      setExportStatus(`❌ Erreur: ${error.message}`);
      setTimeout(() => setExportStatus(null), 8000);
    } finally {
      setIsExporting(false);
    }
  };

  const handleVolumeExport = async () => {
    try {
      setIsExporting(true);
      setExportStatus('Export du volume...');

      const fileId = selectedFile === 'brain' 
        ? appState.brainFile?.file_id 
        : appState.lesionFile?.file_id;

      if (!fileId) {
        throw new Error('Aucun fichier sélectionné');
      }

      const url = `${API_BASE_URL}/export/volume/${fileId}?compress=${volumeCompression}`;
      
      const response = await authenticatedFetch(url);

      if (!response.ok) {
        throw new Error(`Export failed: ${response.status}`);
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = volumeCompression ? `volume_${Date.now()}.nii.gz` : `volume_${Date.now()}.nii`;
      if (contentDisposition) {
        const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
        if (matches && matches[1]) {
          filename = matches[1].replace(/['"]/g, '');
        }
      }

      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);

      const fileSizeMB = (blob.size / 1024 / 1024).toFixed(2);
      setExportStatus(`✅ Export réussi! ${filename} (${fileSizeMB} MB)`);
      setTimeout(() => setExportStatus(null), 5000);
    } catch (error) {
      console.error('Volume export error:', error);
      setExportStatus(`❌ Erreur: ${error.message}`);
      setTimeout(() => setExportStatus(null), 8000);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExport = () => {
    if (exportType === 'mesh') {
      handleMeshExport();
    } else {
      handleVolumeExport();
    }
  };

  // Force cancel export
  const cancelExport = () => {
    setIsExporting(false);
    setExportStatus('❌ Export annulé par l\'utilisateur');
    setTimeout(() => setExportStatus(null), 3000);
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
        <h3 style={{ margin: 0 }}>💾 Export des Données</h3>
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

      {/* Content */}
      <div style={{
        flex: 1,
        padding: '20px',
        overflow: 'auto'
      }}>
        {/* File Selection */}
        <div style={{
          background: '#34495e',
          padding: '15px',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#3498db' }}>Sélection du Fichier</h4>
          <select
            value={selectedFile}
            onChange={(e) => setSelectedFile(e.target.value)}
            disabled={isExporting}
            style={{
              background: '#2c3e50',
              color: 'white',
              border: '1px solid #3498db',
              borderRadius: '4px',
              padding: '8px',
              width: '100%'
            }}
          >
            {appState.brainFile && (
              <option value="brain">Cerveau - {appState.brainFile.filename}</option>
            )}
            {appState.lesionFile && (
              <option value="lesion">Lésions - {appState.lesionFile.filename}</option>
            )}
          </select>
        </div>

        {/* Export Type Selection */}
        <div style={{
          background: '#34495e',
          padding: '15px',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#3498db' }}>Type d'Export</h4>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => setExportType('mesh')}
              disabled={isExporting}
              style={{
                flex: 1,
                padding: '10px',
                background: exportType === 'mesh' ? '#3498db' : '#34495e',
                color: 'white',
                border: '1px solid #3498db',
                borderRadius: '4px',
                cursor: isExporting ? 'not-allowed' : 'pointer'
              }}
            >
              🔷 Mesh 3D
            </button>
            <button
              onClick={() => setExportType('volume')}
              disabled={isExporting}
              style={{
                flex: 1,
                padding: '10px',
                background: exportType === 'volume' ? '#3498db' : '#34495e',
                color: 'white',
                border: '1px solid #3498db',
                borderRadius: '4px',
                cursor: isExporting ? 'not-allowed' : 'pointer'
              }}
            >
              📊 Volume NIFTI
            </button>
          </div>
        </div>

        {/* Export Options */}
        {exportType === 'mesh' ? (
          <>
            {/* STL Format Info */}
            <div style={{
              background: '#34495e',
              padding: '15px',
              borderRadius: '8px',
              marginBottom: '20px'
            }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#3498db' }}>Format d'Export</h4>
              <div style={{
                background: '#3498db',
                padding: '10px',
                borderRadius: '4px',
                textAlign: 'center'
              }}>
                <div style={{ fontWeight: 'bold', fontSize: '16px' }}>STL</div>
                <div style={{ fontSize: '12px', marginTop: '2px', color: '#ecf0f1' }}>
                  Format standard pour l'impression 3D
                </div>
              </div>
            </div>

            {/* Mesh Parameters */}
            <div style={{
              background: '#34495e',
              padding: '15px',
              borderRadius: '8px',
              marginBottom: '20px'
            }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#3498db' }}>Paramètres du Mesh</h4>
              
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>
                  Seuil: {(meshParameters.threshold * 100).toFixed(0)}%
                  <span style={{ fontSize: '12px', color: '#f39c12', marginLeft: '10px' }}>
                    (Plus élevé = fichier plus petit)
                  </span>
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="0.8"
                  step="0.05"
                  value={meshParameters.threshold}
                  disabled={isExporting}
                  onChange={(e) => setMeshParameters(prev => ({
                    ...prev,
                    threshold: parseFloat(e.target.value)
                  }))}
                  style={{ width: '100%' }}
                />
                <div style={{ fontSize: '12px', color: '#bdc3c7', marginTop: '5px' }}>
                  Recommandé: 30-50% pour des meshes de taille raisonnable
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px' }}>
                  Lissage: {meshParameters.smoothing.toFixed(1)}
                </label>
                <input
                  type="range"
                  min="0"
                  max="3"
                  step="0.1"
                  value={meshParameters.smoothing}
                  disabled={isExporting}
                  onChange={(e) => setMeshParameters(prev => ({
                    ...prev,
                    smoothing: parseFloat(e.target.value)
                  }))}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ 
                marginTop: '15px', 
                padding: '10px', 
                background: '#f39c12', 
                borderRadius: '4px',
                fontSize: '12px' 
              }}>
                <strong>💡 Conseils:</strong>
                <br />• Seuil bas (10-20%) = Mesh détaillé mais volumineux
                <br />• Seuil élevé (30-50%) = Mesh plus simple et rapide à exporter
                <br />• Si l'export prend trop de temps, augmentez le seuil
              </div>
            </div>
          </>
        ) : (
          /* Volume Options */
          <div style={{
            background: '#34495e',
            padding: '15px',
            borderRadius: '8px',
            marginBottom: '20px'
          }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#3498db' }}>Options du Volume</h4>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input
                type="checkbox"
                checked={volumeCompression}
                disabled={isExporting}
                onChange={(e) => setVolumeCompression(e.target.checked)}
              />
              Compression (.nii.gz)
            </label>
            <div style={{ fontSize: '12px', color: '#bdc3c7', marginTop: '5px' }}>
              La compression réduit la taille du fichier sans perte de données
            </div>
          </div>
        )}

        {/* Export Status */}
        {exportStatus && (
          <div style={{
            background: exportStatus.includes('❌') ? 'rgba(231, 76, 60, 0.2)' : 
                       exportStatus.includes('⚠️') ? 'rgba(243, 156, 18, 0.2)' :
                       'rgba(39, 174, 96, 0.2)',
            border: `1px solid ${
              exportStatus.includes('❌') ? '#e74c3c' : 
              exportStatus.includes('⚠️') ? '#f39c12' :
              '#27ae60'
            }`,
            padding: '15px',
            borderRadius: '5px',
            color: exportStatus.includes('❌') ? '#e74c3c' : 
                   exportStatus.includes('⚠️') ? '#f39c12' :
                   '#27ae60',
            marginBottom: '20px',
            textAlign: 'center'
          }}>
            {exportStatus}
          </div>
        )}

        {/* Export Buttons */}
        <div style={{ textAlign: 'center', display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button
            onClick={handleExport}
            disabled={isExporting || (!appState.brainFile && !appState.lesionFile)}
            style={{
              background: isExporting ? '#7f8c8d' : '#27ae60',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '12px 30px',
              fontSize: '16px',
              cursor: isExporting ? 'not-allowed' : 'pointer',
              transition: 'background 0.3s'
            }}
          >
            {isExporting ? 'Export en cours...' : `Exporter le ${exportType === 'mesh' ? 'Mesh' : 'Volume'}`}
          </button>

          {isExporting && (
            <button
              onClick={cancelExport}
              style={{
                background: '#e74c3c',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                padding: '12px 20px',
                fontSize: '16px',
                cursor: 'pointer'
              }}
            >
              ❌ Annuler
            </button>
          )}
        </div>
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
        Les fichiers exportés conservent les transformations et normalisations appliquées
      </div>
    </div>
  );
};

export default ExportPanel;