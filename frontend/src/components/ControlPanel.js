// components/ControlPanel.js - Enhanced Control Panel with Mesh Normalization Info
import React from 'react';

const ControlPanel = ({ appState, onFileUpload, onParameterUpdate }) => {
  const handleFileChange = (event, fileType) => {
    const file = event.target.files[0];
    if (file) {
      onFileUpload(file, fileType);
    }
  };

  return (
    <div className="control-panel">
      {/* File Loading Section */}
      <div className="control-group">
        <div className="control-group-title">Chargement des Données</div>
        
        <label className="file-input-label">
          <input
            type="file"
            accept=".nii,.nii.gz"
            onChange={(e) => handleFileChange(e, 'brain')}
            disabled={appState.isLoading}
          />
          Charger Cerveau (.nii)
        </label>
        
        {appState.brainFile && (
          <div className="file-info">
            <div className="file-info-title">Cerveau chargé:</div>
            <div className="file-info-details">
              <div>📁 {appState.brainFile.filename}</div>
              <div>📏 Dimensions: {appState.brainFile.shape.join(' × ')}</div>
              <div>🔍 Résolution: {appState.brainFile.zooms.map(z => z.toFixed(2)).join(' × ')} mm</div>
              <div>📊 Type: {appState.brainFile.data_type}</div>
              <div>📈 Plage: [{appState.brainFile.min_value.toFixed(1)}, {appState.brainFile.max_value.toFixed(1)}]</div>
              <div>🧮 Voxels non-nuls: {appState.brainFile.non_zero_count?.toLocaleString() || 'N/A'}</div>
              
              {/* Mesh Normalization Status */}
              {appState.meshNormalizationApplied && (
                <div style={{
                  marginTop: '8px',
                  padding: '6px',
                  background: 'rgba(39, 174, 96, 0.2)',
                  borderRadius: '4px',
                  border: '1px solid #27ae60'
                }}>
                  <div style={{ fontSize: '12px', color: '#27ae60', fontWeight: 'bold' }}>
                    🔧 Normalisation Géométrique Active
                  </div>
                  <div style={{ fontSize: '11px', color: '#bdc3c7' }}>
                    Type: {appState.meshNormalizationMethod === 'cartesian' ? '📦 Cartésienne' : '🌐 Sphérique'}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        
        <label className="file-input-label">
          <input
            type="file"
            accept=".nii,.nii.gz"
            onChange={(e) => handleFileChange(e, 'lesion')}
            disabled={appState.isLoading || !appState.brainFile}
          />
          Charger Lésions (.nii)
        </label>
        
        {appState.lesionFile && (
          <div className="file-info">
            <div className="file-info-title">Lésions chargées:</div>
            <div className="file-info-details">
              <div>📁 {appState.lesionFile.filename}</div>
              <div>📏 Dimensions: {appState.lesionFile.shape.join(' × ')}</div>
              <div>🔍 Résolution: {appState.lesionFile.zooms.map(z => z.toFixed(2)).join(' × ')} mm</div>
              <div>📊 Type: {appState.lesionFile.data_type}</div>
              <div>🧮 Voxels non-nuls: {appState.lesionFile.non_zero_count?.toLocaleString() || 'N/A'}</div>
            </div>
          </div>
        )}
      </div>

      {/* View Mode Section */}
      <div className="control-group">
        <div className="control-group-title">Mode de Vue</div>
        
        <div className="form-row">
          <label>Mode:</label>
          <select 
            value={appState.viewMode} 
            onChange={(e) => onParameterUpdate('viewMode', e.target.value)}
            disabled={!appState.brainFile}
          >
            <option value="3D">3D Multiplanaire</option>
            <option value="2D-axial">2D Axiale</option>
            <option value="2D-coronal">2D Coronale</option>
            <option value="2D-sagittal">2D Sagittale</option>
          </select>
        </div>
      </div>

      {/* Image Controls Section */}
      <div className="control-group">
        <div className="control-group-title">Contrôles Image</div>
        
        <div className="form-row">
          <label>Niveau: {appState.windowLevel || 40}</label>
        </div>
        <input
          type="range"
          min="-1000"
          max="1000"
          step="10"
          value={appState.windowLevel || 40}
          onChange={(e) => onParameterUpdate('windowLevel', parseFloat(e.target.value))}
          disabled={!appState.brainFile}
        />
        
        <div className="form-row">
          <label>Fenêtre: {appState.windowWidth || 80}</label>
        </div>
        <input
          type="range"
          min="1"
          max="2000"
          step="10"
          value={appState.windowWidth || 80}
          onChange={(e) => onParameterUpdate('windowWidth', parseFloat(e.target.value))}
          disabled={!appState.brainFile}
        />
        
        <div className="form-row">
          <label>Contraste: {(appState.contrast || 1.0).toFixed(1)}</label>
        </div>
        <input
          type="range"
          min="0.1"
          max="3.0"
          step="0.1"
          value={appState.contrast || 1.0}
          onChange={(e) => onParameterUpdate('contrast', parseFloat(e.target.value))}
          disabled={!appState.brainFile}
        />
        
        <div className="form-row">
          <label>Luminosité: {appState.brightness || 0}</label>
        </div>
        <input
          type="range"
          min="-100"
          max="100"
          step="5"
          value={appState.brightness || 0}
          onChange={(e) => onParameterUpdate('brightness', parseInt(e.target.value))}
          disabled={!appState.brainFile}
        />
        
        <div className="form-row">
          <label>Colormap:</label>
          <select 
            value={appState.colormap} 
            onChange={(e) => onParameterUpdate('colormap', e.target.value)}
            disabled={!appState.brainFile}
          >
            <option value="gray">Gris</option>
            <option value="jet">Jet</option>
            <option value="hot">Chaud</option>
            <option value="rainbow">Arc-en-ciel</option>
            <option value="viridis">Viridis</option>
          </select>
        </div>

        <button
          onClick={() => {
            onParameterUpdate('windowLevel', 40);
            onParameterUpdate('windowWidth', 80);
            onParameterUpdate('contrast', 1.0);
            onParameterUpdate('brightness', 0);
          }}
          disabled={!appState.brainFile}
          className="button-small"
          style={{ width: '100%', marginTop: '10px' }}
        >
          Réinitialiser Image
        </button>
      </div>

      {/* 3D Visualization Controls */}
      {appState.brainFile && appState.viewMode === '3D' && (
        <div className="control-group">
          <div className="control-group-title">Visualisation 3D</div>
          
          <div className="form-row">
            <label>Seuil Mesh: {((appState.meshThreshold || 0.1) * 100).toFixed(0)}%</label>
          </div>
          <input
            type="range"
            min="0.01"
            max="0.5"
            step="0.01"
            value={appState.meshThreshold || 0.1}
            onChange={(e) => onParameterUpdate('meshThreshold', parseFloat(e.target.value))}
            disabled={!appState.brainFile}
          />
          
          {/* Mesh Normalization Status Display */}
          {appState.meshNormalizationApplied && (
            <div style={{
              background: 'rgba(39, 174, 96, 0.1)',
              border: '1px solid #27ae60',
              borderRadius: '4px',
              padding: '8px',
              margin: '10px 0',
              fontSize: '12px'
            }}>
              <div style={{ fontWeight: 'bold', color: '#27ae60', marginBottom: '4px' }}>
                🔧 Mesh Normalisé
              </div>
              <div style={{ color: '#bdc3c7' }}>
                Type: {appState.meshNormalizationMethod === 'cartesian' ? '📦 Cartésienne' : '🌐 Sphérique'}
              </div>
              {appState.meshNormalizationStats && (
                <div style={{ marginTop: '4px', fontSize: '11px' }}>
                  <div>Vertices: {appState.meshNormalizationStats.after?.vertex_count || 'N/A'}</div>
                  <div>Volume: {appState.meshNormalizationStats.after?.volume_estimation?.toFixed(2) || 'N/A'} mm³</div>
                </div>
              )}
              <button
                onClick={() => onParameterUpdate('clearMeshNormalization', Date.now())}
                style={{
                  background: '#e74c3c',
                  color: 'white',
                  border: 'none',
                  borderRadius: '3px',
                  padding: '4px 8px',
                  fontSize: '10px',
                  cursor: 'pointer',
                  marginTop: '5px'
                }}
              >
                Supprimer Normalisation
              </button>
            </div>
          )}
          
          <button
            onClick={() => onParameterUpdate('regenerateMesh', Date.now())}
            disabled={!appState.brainFile}
            className="button-small"
            style={{ width: '100%', marginTop: '10px' }}
          >
            Régénérer Mesh
          </button>
        </div>
      )}

      {/* Opacity Controls */}
      <div className="control-group">
        <div className="control-group-title">Opacité</div>
        
        <div className="form-row">
          <label>Cerveau: {(appState.brainOpacity || 0.8).toFixed(1)}</label>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={appState.brainOpacity || 0.8}
          onChange={(e) => onParameterUpdate('brainOpacity', parseFloat(e.target.value))}
          disabled={!appState.brainFile}
        />
        
        <div className="form-row">
          <label>Lésions: {(appState.lesionOpacity || 0.9).toFixed(1)}</label>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={appState.lesionOpacity || 0.9}
          onChange={(e) => onParameterUpdate('lesionOpacity', parseFloat(e.target.value))}
          disabled={!appState.lesionFile}
        />
      </div>

      {/* 2D Analysis Tools */}
      {appState.brainFile && appState.viewMode.startsWith('2D-') && (
        <div className="control-group">
          <div className="control-group-title">Outils d'Analyse 2D</div>
          
          <div className="form-row">
            <label>
              <input
                type="checkbox"
                checked={appState.showCrosshair || false}
                onChange={(e) => onParameterUpdate('showCrosshair', e.target.checked)}
                style={{ marginRight: '5px' }}
              />
              Réticule
            </label>
          </div>
          
          <div className="form-row">
            <label>
              <input
                type="checkbox"
                checked={appState.showGrid || false}
                onChange={(e) => onParameterUpdate('showGrid', e.target.checked)}
                style={{ marginRight: '5px' }}
              />
              Grille
            </label>
          </div>
          
          <div className="form-row">
            <label>
              <input
                type="checkbox"
                checked={appState.showMeasurements || false}
                onChange={(e) => onParameterUpdate('showMeasurements', e.target.checked)}
                style={{ marginRight: '5px' }}
              />
              Mesures
            </label>
          </div>

          <button
            onClick={() => onParameterUpdate('clearMeasurements', Date.now())}
            disabled={!appState.brainFile || !appState.showMeasurements}
            className="button-small"
            style={{ width: '100%', marginTop: '5px' }}
          >
            Effacer Mesures
          </button>
          
          <div className="form-row" style={{ marginTop: '10px' }}>
            <label>Zoom: {appState.zoomLevel.toFixed(1)}x</label>
          </div>
          <input
            type="range"
            min="0.5"
            max="5.0"
            step="0.1"
            value={appState.zoomLevel}
            onChange={(e) => onParameterUpdate('zoomLevel', parseFloat(e.target.value))}
            disabled={!appState.brainFile}
          />
        </div>
      )}

      {/* Measurement Info */}
      {appState.brainFile && appState.viewMode.startsWith('2D-') && appState.showMeasurements && (
        <div className="control-group">
          <div className="control-group-title">📊 Mesures Info</div>
          
          <div className="measurement-info" style={{
            background: 'rgba(52, 73, 94, 0.5)',
            padding: '10px',
            borderRadius: '4px',
            fontSize: '12px',
            lineHeight: '1.6'
          }}>
            <div style={{ marginBottom: '5px' }}>
              <strong>📏 Distance (M1-M2):</strong><br/>
              Cliquez et glissez pour mesurer
            </div>
            <div>
              <strong>📐 Zone:</strong><br/>
              Cliquez plusieurs points,<br/>
              double-cliquez pour terminer
            </div>
            <hr style={{ margin: '10px 0', border: '1px solid #2c3e50' }} />
            <div style={{ color: '#bdc3c7' }}>
              Les mesures sont affichées en mm et mm²
            </div>
          </div>
        </div>
      )}

      {/* Filter Controls */}
      <div className="control-group">
        <div className="control-group-title">Filtres</div>
        
        <div className="form-row">
          <label>Seuil: {appState.threshold || 128}</label>
        </div>
        <input
          type="range"
          min="0"
          max="255"
          step="1"
          value={appState.threshold || 128}
          onChange={(e) => onParameterUpdate('threshold', parseInt(e.target.value))}
          disabled={!appState.brainFile}
        />
        
        <div className="form-row">
          <label>Flou: {appState.blurValue || 0}</label>
        </div>
        <input
          type="range"
          min="0"
          max="50"
          step="1"
          value={appState.blurValue || 0}
          onChange={(e) => onParameterUpdate('blurValue', parseInt(e.target.value))}
          disabled={!appState.brainFile}
        />
      </div>

      {/* Color Controls */}
      <div className="control-group">
        <div className="control-group-title">Couleurs</div>
        
        <div className="form-row">
          <label>Cerveau:</label>
          <input
            type="color"
            value={appState.brainColor || '#ff99cc'}
            onChange={(e) => onParameterUpdate('brainColor', e.target.value)}
            disabled={!appState.brainFile}
          />
        </div>
        
        <div className="form-row">
          <label>Lésions:</label>
          <input
            type="color"
            value={appState.lesionColor || '#ff4d4d'}
            onChange={(e) => onParameterUpdate('lesionColor', e.target.value)}
            disabled={!appState.lesionFile}
          />
        </div>
      </div>

      {/* Analysis Tools */}
      {appState.brainFile && (
        <div className="control-group">
          <div className="control-group-title">Analyse Avancée</div>
          
          <button
            onClick={() => onParameterUpdate('showAnalysisPanel', true)}
            disabled={!appState.brainFile}
            className="button-primary"
            style={{ width: '100%', marginBottom: '10px' }}
          >
            📊 Ouvrir Analyse Statistique
          </button>
          
          <button
            onClick={() => onParameterUpdate('showNormalizationPanel', true)}
            disabled={!appState.brainFile}
            className="button-primary"
            style={{ 
              width: '100%', 
              marginBottom: '10px',
              background: appState.meshNormalizationApplied ? '#27ae60' : '#3498db'
            }}
          >
            🔧 Normalisation Géométrique
            {appState.meshNormalizationApplied && (
              <span style={{ fontSize: '10px', display: 'block' }}>
                (Active: {appState.meshNormalizationMethod === 'cartesian' ? 'Cartésienne' : 'Sphérique'})
              </span>
            )}
          </button>
          
          <button
            onClick={() => onParameterUpdate('showExportPanel', true)}
            disabled={!appState.brainFile}
            className="button-primary"
            style={{ width: '100%', marginBottom: '10px' }}
          >
            💾 Export Avancé
          </button>
          
          <button
            onClick={() => onParameterUpdate('exportData', Date.now())}
            disabled={!appState.brainFile}
            className="button-small"
            style={{ width: '100%', marginBottom: '5px' }}
          >
            📄 Exporter Mesures
          </button>
          
          <button
            onClick={() => onParameterUpdate('takeScreenshot', Date.now())}
            disabled={!appState.brainFile}
            className="button-small"
            style={{ width: '100%' }}
          >
            📸 Capture d'Écran
          </button>
        </div>
      )}
      
      {/* Performance Tools */}
      {appState.brainFile && (
        <div className="control-group">
          <div className="control-group-title">Performance</div>
          
          <button
            onClick={() => onParameterUpdate('showPerformanceStats', true)}
            className="button-small"
            style={{ width: '100%', marginBottom: '5px' }}
          >
            📈 Statistiques Performance
          </button>
          
          <button
            onClick={() => onParameterUpdate('clearCache', Date.now())}
            className="button-small"
            style={{ width: '100%' }}
          >
            🗑️ Vider le Cache
          </button>
        </div>
      )}
    </div>
  );
};

export default ControlPanel;