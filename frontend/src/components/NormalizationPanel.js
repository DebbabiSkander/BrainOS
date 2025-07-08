// components/NormalizationPanel.js - Data Normalization Component with Authentication
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext'; // Import useAuth

// API configuration
const API_BASE_URL = 'http://localhost:5000/api';

const NormalizationPanel = ({ appState, isVisible, onClose, onNormalizationComplete }) => {
  const { authenticatedFetch } = useAuth(); // Get authenticatedFetch from context
  const [selectedMethod, setSelectedMethod] = useState('min_max');
  const [parameters, setParameters] = useState({
    min: 0,
    max: 1,
    percentile_min: 5,
    percentile_max: 95,
    nbins: 256
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [selectedFile, setSelectedFile] = useState('brain');
  const [normalizationResult, setNormalizationResult] = useState(null);

  const normalizationMethods = {
    min_max: {
      name: 'Min-Max Normalization',
      description: 'Scales data to a fixed range [min, max]',
      params: ['min', 'max'],
      effect: 'Étend les valeurs entre une plage définie, améliore le contraste'
    },
    z_score: {
      name: 'Z-Score Normalization',
      description: 'Standardizes data to have mean=0 and std=1',
      params: [],
      effect: 'Centre les données autour de 0, utile pour la comparaison'
    },
    robust: {
      name: 'Robust Normalization',
      description: 'Uses percentiles to handle outliers',
      params: ['percentile_min', 'percentile_max'],
      effect: 'Élimine les valeurs extrêmes, améliore la visibilité des structures'
    },
    histogram: {
      name: 'Histogram Equalization',
      description: 'Enhances contrast using histogram equalization',
      params: ['nbins'],
      effect: 'Améliore dramatiquement le contraste, révèle les détails cachés'
    }
  };

  const handleParameterChange = (param, value) => {
    setParameters(prev => ({
      ...prev,
      [param]: parseFloat(value)
    }));
  };

  const handleNormalize = async () => {
    try {
      setIsProcessing(true);
      setError(null);
      setNormalizationResult(null);

      const fileId = selectedFile === 'brain' 
        ? appState.brainFile?.file_id 
        : appState.lesionFile?.file_id;

      if (!fileId) {
        throw new Error('No file selected');
      }

      // Prepare parameters based on selected method
      const methodParams = {};
      normalizationMethods[selectedMethod].params.forEach(param => {
        methodParams[param] = parameters[param];
      });

      // Use authenticatedFetch instead of regular fetch
      const response = await authenticatedFetch(`${API_BASE_URL}/normalize/${fileId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          method: selectedMethod,
          params: methodParams
        })
      });

      const data = await response.json();

      if (data.success) {
        setNormalizationResult({
          statistics: data.statistics,
          method: data.method,
          params: data.params
        });
        
        onNormalizationComplete({
          fileType: selectedFile,
          method: selectedMethod,
          statistics: data.statistics
        });
      } else {
        throw new Error(data.error || 'Normalization failed');
      }
    } catch (error) {
      console.error('Normalization error:', error);
      setError(error.message);
    } finally {
      setIsProcessing(false);
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
        <h3 style={{ margin: 0 }}>🔧 Normalisation des Données</h3>
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

        {/* Method Selection */}
        <div style={{
          background: '#34495e',
          padding: '15px',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#3498db' }}>Méthode de Normalisation</h4>
          {Object.entries(normalizationMethods).map(([key, method]) => (
            <div
              key={key}
              style={{
                background: selectedMethod === key ? '#3498db' : '#2c3e50',
                padding: '10px',
                borderRadius: '4px',
                marginBottom: '10px',
                cursor: 'pointer',
                transition: 'background 0.3s'
              }}
              onClick={() => setSelectedMethod(key)}
            >
              <div style={{ fontWeight: 'bold' }}>{method.name}</div>
              <div style={{ fontSize: '12px', marginTop: '5px', color: '#bdc3c7' }}>
                {method.description}
              </div>
              <div style={{ fontSize: '11px', marginTop: '3px', color: '#e74c3c', fontStyle: 'italic' }}>
                ➤ {method.effect}
              </div>
            </div>
          ))}
        </div>

        {/* Parameters */}
        {normalizationMethods[selectedMethod].params.length > 0 && (
          <div style={{
            background: '#34495e',
            padding: '15px',
            borderRadius: '8px',
            marginBottom: '20px'
          }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#3498db' }}>Paramètres</h4>
            {normalizationMethods[selectedMethod].params.map(param => (
              <div key={param} style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>
                  {param.replace(/_/g, ' ').charAt(0).toUpperCase() + param.slice(1).replace(/_/g, ' ')}:
                </label>
                <input
                  type="number"
                  value={parameters[param]}
                  onChange={(e) => handleParameterChange(param, e.target.value)}
                  style={{
                    background: '#2c3e50',
                    color: 'white',
                    border: '1px solid #3498db',
                    borderRadius: '4px',
                    padding: '8px',
                    width: '100%'
                  }}
                  step={param.includes('percentile') ? '1' : '0.1'}
                />
              </div>
            ))}
          </div>
        )}

        {/* Normalization Result */}
        {normalizationResult && (
          <div style={{
            background: 'rgba(39, 174, 96, 0.2)',
            border: '2px solid #27ae60',
            padding: '15px',
            borderRadius: '8px',
            marginBottom: '20px'
          }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#27ae60' }}>✅ Normalisation Appliquée!</h4>
            <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
              <div><strong>Méthode:</strong> {normalizationResult.method}</div>
              <div><strong>Nouvelles valeurs:</strong></div>
              <div style={{ marginLeft: '20px', fontSize: '13px' }}>
                • Min: {normalizationResult.statistics.min_value.toFixed(3)}<br/>
                • Max: {normalizationResult.statistics.max_value.toFixed(3)}<br/>
                • Moyenne: {normalizationResult.statistics.mean_value.toFixed(3)}<br/>
                • Écart-type: {normalizationResult.statistics.std_value.toFixed(3)}
              </div>
              <div style={{ marginTop: '10px', fontSize: '12px', color: '#f39c12' }}>
                ⚠️ Les changements sont visibles dans la vue 3D et les coupes 2D
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div style={{
            background: 'rgba(231, 76, 60, 0.2)',
            padding: '15px',
            borderRadius: '5px',
            color: '#e74c3c',
            marginBottom: '20px'
          }}>
            {error}
          </div>
        )}

        {/* Apply Button */}
        <div style={{ textAlign: 'center' }}>
          <button
            onClick={handleNormalize}
            disabled={isProcessing || (!appState.brainFile && !appState.lesionFile)}
            style={{
              background: isProcessing ? '#7f8c8d' : '#27ae60',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '12px 30px',
              fontSize: '16px',
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              transition: 'background 0.3s'
            }}
          >
            {isProcessing ? 'Normalisation en cours...' : 'Appliquer la Normalisation'}
          </button>
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
        La normalisation modifie les valeurs des voxels pour améliorer la visualisation et l'analyse
      </div>
    </div>
  );
};

export default NormalizationPanel;