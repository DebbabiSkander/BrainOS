// components/VisualizationPanel.js
import React from 'react';
import ThreeViewer from './ThreeViewer';
import SliceViewer from './SliceViewer';

const VisualizationPanel = ({ appState, onParameterUpdate }) => {
  const is3DMode = appState.viewMode === '3D';
  const is2DMode = appState.viewMode.startsWith('2D-');

  return (
    <div className="visualization-panel">
      <div className="visualization-content">
        {!appState.brainFile ? (
          <div className="placeholder-message">
            <h3>🧠 BrainOS Visualisation</h3>
            <p>Chargez un fichier NIFTI pour commencer la visualisation</p>
            <p style={{ fontSize: '14px', color: '#888', marginTop: '10px' }}>
              Formats supportés: .nii, .nii.gz
            </p>
          </div>
        ) : is3DMode ? (
          <ThreeViewer appState={appState} />
        ) : is2DMode ? (
          <SliceViewer appState={appState} onParameterUpdate={onParameterUpdate} />
        ) : (
          <div className="placeholder-message">
            <h3>Mode de visualisation non supporté</h3>
            <p>Veuillez sélectionner un mode de vue valide</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default VisualizationPanel;