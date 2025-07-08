// components/StatusBar.js - Enhanced Status Bar Component
import React from 'react';

const StatusBar = ({ appState }) => {
  return (
    <div className="status-bar">
      <div className="status-message">
        {appState.statusMessage}
        {appState.normalizationApplied && (
          <span style={{ 
            marginLeft: '10px', 
            color: '#27ae60',
            fontWeight: 'bold' 
          }}>
            [Normalisé: {appState.normalizationMethod}]
          </span>
        )}
      </div>
      <div className="status-info">
        {appState.brainFile && (
          <span>
            Cerveau: {appState.brainFile.shape.join('×')} | 
            Type: {appState.brainFile.data_type}
          </span>
        )}
        {appState.lesionFile && (
          <span>
            | Lésions: {appState.lesionFile.shape.join('×')}
          </span>
        )}
      </div>
    </div>
  );
};

export default StatusBar;