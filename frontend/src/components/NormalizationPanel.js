// components/NormalizationPanel.js - Mesh Geometry Normalization Component
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

// API configuration
const API_BASE_URL = 'http://localhost:5000/api';

const NormalizationPanel = ({ appState, isVisible, onClose, onNormalizationComplete }) => {
  const { authenticatedFetch } = useAuth();
  const [selectedMethod, setSelectedMethod] = useState('cartesian');
  const [parameters, setParameters] = useState({
    // Cartesian normalization
    target_size: 100,
    center_at_origin: true,
    preserve_aspect_ratio: true,
    
    // Spherical normalization
    target_radius: 50,
    center_mode: 'centroid', // 'centroid', 'geometric_center', 'mass_center'
    normalize_to_unit_sphere: true
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [selectedFile, setSelectedFile] = useState('brain');
  const [normalizationResult, setNormalizationResult] = useState(null);
  const [meshStats, setMeshStats] = useState({
    before: null,
    after: null
  });

  const normalizationMethods = {
    cartesian: {
      name: 'Normalisation Cartésienne',
      description: 'Normalise le mesh dans un cube cartésien avec des dimensions fixes',
      icon: '📦',
      params: ['target_size', 'center_at_origin', 'preserve_aspect_ratio'],
      effect: 'Place le mesh dans un cube de taille définie, idéal pour la comparaison de formes'
    },
    spherical: {
      name: 'Normalisation Sphérique', 
      description: 'Normalise le mesh dans une sphère avec un rayon défini',
      icon: '🌐',
      params: ['target_radius', 'center_mode', 'normalize_to_unit_sphere'],
      effect: 'Place le mesh dans une sphère de rayon défini, préserve mieux les proportions anatomiques'
    }
  };

  const handleParameterChange = (param, value) => {
    setParameters(prev => ({
      ...prev,
      [param]: typeof value === 'string' ? value : parseFloat(value)
    }));
  };

  const handleBooleanParameterChange = (param, checked) => {
    setParameters(prev => ({
      ...prev,
      [param]: checked
    }));
  };

  const handleNormalize = async () => {
    try {
      setIsProcessing(true);
      setError(null);
      setNormalizationResult(null);
      setMeshStats({ before: null, after: null });

      const fileId = selectedFile === 'brain' 
        ? appState.brainFile?.file_id 
        : appState.lesionFile?.file_id;

      if (!fileId) {
        throw new Error('Aucun fichier sélectionné');
      }

      console.log('🔍 Getting current mesh stats for file:', fileId);

      // First, get the current mesh to capture "before" stats
      const meshResponse = await authenticatedFetch(`${API_BASE_URL}/mesh/${fileId}?threshold=${appState.meshThreshold || 0.1}&use_normalized=false`);
      
      if (!meshResponse.ok) {
        const errorText = await meshResponse.text();
        throw new Error(`Failed to fetch mesh: ${meshResponse.status} - ${errorText}`);
      }
      
      const meshData = await meshResponse.json();
      
      if (!meshData.success) {
        throw new Error(meshData.error || 'Impossible de récupérer le mesh actuel');
      }

      console.log('✅ Mesh data received:', meshData);

      // Calculate "before" statistics safely
      let beforeStats = null;
      try {
        beforeStats = calculateMeshStats(meshData.mesh_data, 'avant normalisation');
        console.log('📊 Before stats calculated:', beforeStats);
      } catch (statsError) {
        console.warn('Warning: Could not calculate before stats:', statsError);
        beforeStats = {
          label: 'avant normalisation',
          vertex_count: meshData.mesh_data?.vertices?.length || 0,
          face_count: meshData.mesh_data?.faces?.length || 0,
          error: 'Could not calculate detailed stats'
        };
      }

      setMeshStats(prev => ({ ...prev, before: beforeStats }));

      // Prepare parameters based on selected method
      const methodParams = {};
      normalizationMethods[selectedMethod].params.forEach(param => {
        methodParams[param] = parameters[param];
      });

      console.log('🔄 Applying mesh normalization...', { 
        method: selectedMethod, 
        params: methodParams,
        fileId: fileId
      });

      // Apply mesh normalization
      const response = await authenticatedFetch(`${API_BASE_URL}/normalize-mesh/${fileId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          method: selectedMethod,
          params: methodParams
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Normalization failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      if (data.success) {
        console.log('✅ Normalization successful:', data);

        // Calculate "after" statistics safely
        let afterStats = null;
        try {
          afterStats = calculateMeshStats(data.normalized_mesh_data, 'après normalisation');
          console.log('📊 After stats calculated:', afterStats);
        } catch (statsError) {
          console.warn('Warning: Could not calculate after stats:', statsError);
          afterStats = {
            label: 'après normalisation',
            vertex_count: data.normalized_mesh_data?.vertices?.length || 0,
            face_count: data.normalized_mesh_data?.faces?.length || 0,
            error: 'Could not calculate detailed stats'
          };
        }

        setMeshStats(prev => ({ ...prev, after: afterStats }));

        setNormalizationResult({
          method: selectedMethod,
          params: methodParams,
          mesh_stats: data.mesh_stats,
          transform_applied: data.transform_applied
        });
        
        // Notify parent component
        onNormalizationComplete({
          fileType: selectedFile,
          method: selectedMethod,
          meshData: data.normalized_mesh_data,
          stats: { before: beforeStats, after: afterStats }
        });

        console.log('🎉 Normalization completed successfully');
      } else {
        throw new Error(data.error || 'Échec de la normalisation');
      }
    } catch (error) {
      console.error('❌ Erreur de normalisation:', error);
      setError(`Erreur de normalisation: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const calculateMeshStats = (meshData, label) => {
    try {
      if (!meshData || !meshData.vertices || !Array.isArray(meshData.vertices)) {
        console.warn('Invalid mesh data provided to calculateMeshStats');
        return null;
      }

      const vertices = meshData.vertices;
      const faces = meshData.faces || [];

      if (vertices.length === 0) {
        console.warn('Empty vertices array');
        return null;
      }

      // Safe array operations with fallbacks
      let xs = [], ys = [], zs = [];
      
      try {
        for (let i = 0; i < vertices.length; i++) {
          const vertex = vertices[i];
          if (Array.isArray(vertex) && vertex.length >= 3) {
            xs.push(Number(vertex[0]) || 0);
            ys.push(Number(vertex[1]) || 0);
            zs.push(Number(vertex[2]) || 0);
          }
        }
      } catch (error) {
        console.error('Error processing vertices:', error);
        return null;
      }

      if (xs.length === 0) {
        console.warn('No valid vertices found');
        return null;
      }

      // Calculate bounding box safely
      const minX = Math.min.apply(Math, xs);
      const maxX = Math.max.apply(Math, xs);
      const minY = Math.min.apply(Math, ys);
      const maxY = Math.max.apply(Math, ys);
      const minZ = Math.min.apply(Math, zs);
      const maxZ = Math.max.apply(Math, zs);

      // Calculate dimensions
      const width = maxX - minX;
      const height = maxY - minY;
      const depth = maxZ - minZ;

      // Calculate centroid safely
      const sum_x = xs.reduce((sum, x) => sum + x, 0);
      const sum_y = ys.reduce((sum, y) => sum + y, 0);
      const sum_z = zs.reduce((sum, z) => sum + z, 0);
      
      const centroidX = sum_x / xs.length;
      const centroidY = sum_y / ys.length;
      const centroidZ = sum_z / zs.length;

      // Calculate distances from centroid safely
      let distances = [];
      let maxDistance = 0;
      let totalDistance = 0;

      for (let i = 0; i < xs.length; i++) {
        const dx = xs[i] - centroidX;
        const dy = ys[i] - centroidY;
        const dz = zs[i] - centroidZ;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        
        distances.push(distance);
        totalDistance += distance;
        
        if (distance > maxDistance) {
          maxDistance = distance;
        }
      }

      const avgDistance = totalDistance / distances.length;

      // Simple volume estimation (avoid complex calculations that might cause recursion)
      let volume = 0;
      if (Array.isArray(faces) && faces.length > 0) {
        // Very simple volume approximation
        volume = (width * height * depth) * 0.5; // Rough approximation
      }

      return {
        label: String(label || ''),
        vertex_count: vertices.length,
        face_count: Array.isArray(faces) ? faces.length : 0,
        bounding_box: {
          min: [minX, minY, minZ],
          max: [maxX, maxY, maxZ],
          dimensions: [width, height, depth]
        },
        centroid: [centroidX, centroidY, centroidZ],
        max_distance_from_centroid: maxDistance,
        avg_distance_from_centroid: avgDistance,
        volume_estimation: volume,
        surface_area_estimation: Array.isArray(faces) ? faces.length * 0.5 : 0
      };
    } catch (error) {
      console.error('Error in calculateMeshStats:', error);
      return null;
    }
  };

  const renderStatsComparison = () => {
    if (!meshStats.before || !meshStats.after) return null;

    const before = meshStats.before;
    const after = meshStats.after;

    return (
      <div style={{
        background: 'rgba(39, 174, 96, 0.1)',
        border: '2px solid #27ae60',
        padding: '15px',
        borderRadius: '8px',
        marginBottom: '20px'
      }}>
        <h4 style={{ margin: '0 0 15px 0', color: '#27ae60', textAlign: 'center' }}>
          ✨ Comparaison Avant/Après Normalisation
        </h4>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', fontSize: '13px' }}>
          {/* Before */}
          <div style={{ background: 'rgba(231, 76, 60, 0.1)', padding: '10px', borderRadius: '5px' }}>
            <h5 style={{ margin: '0 0 10px 0', color: '#e74c3c' }}>📊 Avant Normalisation</h5>
            <div style={{ lineHeight: '1.4' }}>
              <div><strong>Dimensions:</strong></div>
              <div style={{ marginLeft: '10px', fontSize: '12px' }}>
                X: {before.bounding_box.dimensions[0].toFixed(2)} mm<br/>
                Y: {before.bounding_box.dimensions[1].toFixed(2)} mm<br/>
                Z: {before.bounding_box.dimensions[2].toFixed(2)} mm
              </div>
              <div><strong>Centroïde:</strong></div>
              <div style={{ marginLeft: '10px', fontSize: '12px' }}>
                ({before.centroid[0].toFixed(1)}, {before.centroid[1].toFixed(1)}, {before.centroid[2].toFixed(1)})
              </div>
              <div><strong>Rayon max:</strong> {before.max_distance_from_centroid.toFixed(2)} mm</div>
              <div><strong>Volume:</strong> {before.volume_estimation.toFixed(2)} mm³</div>
            </div>
          </div>

          {/* After */}
          <div style={{ background: 'rgba(39, 174, 96, 0.1)', padding: '10px', borderRadius: '5px' }}>
            <h5 style={{ margin: '0 0 10px 0', color: '#27ae60' }}>✅ Après Normalisation</h5>
            <div style={{ lineHeight: '1.4' }}>
              <div><strong>Dimensions:</strong></div>
              <div style={{ marginLeft: '10px', fontSize: '12px' }}>
                X: {after.bounding_box.dimensions[0].toFixed(2)} mm<br/>
                Y: {after.bounding_box.dimensions[1].toFixed(2)} mm<br/>
                Z: {after.bounding_box.dimensions[2].toFixed(2)} mm
              </div>
              <div><strong>Centroïde:</strong></div>
              <div style={{ marginLeft: '10px', fontSize: '12px' }}>
                ({after.centroid[0].toFixed(1)}, {after.centroid[1].toFixed(1)}, {after.centroid[2].toFixed(1)})
              </div>
              <div><strong>Rayon max:</strong> {after.max_distance_from_centroid.toFixed(2)} mm</div>
              <div><strong>Volume:</strong> {after.volume_estimation.toFixed(2)} mm³</div>
            </div>
          </div>
        </div>

        {/* Changes Summary */}
        <div style={{ 
          marginTop: '15px', 
          padding: '10px', 
          background: 'rgba(52, 152, 219, 0.1)', 
          borderRadius: '5px',
          borderLeft: '4px solid #3498db'
        }}>
          <h5 style={{ margin: '0 0 8px 0', color: '#3498db' }}>🎯 Changements Appliqués</h5>
          <div style={{ fontSize: '12px', lineHeight: '1.5' }}>
            <div><strong>Facteur d'échelle:</strong> {(after.max_distance_from_centroid / before.max_distance_from_centroid).toFixed(3)}x</div>
            <div><strong>Translation du centroïde:</strong></div>
            <div style={{ marginLeft: '15px' }}>
              ΔX: {(after.centroid[0] - before.centroid[0]).toFixed(2)} mm<br/>
              ΔY: {(after.centroid[1] - before.centroid[1]).toFixed(2)} mm<br/>
              ΔZ: {(after.centroid[2] - before.centroid[2]).toFixed(2)} mm
            </div>
            <div><strong>Changement de volume:</strong> {((after.volume_estimation / before.volume_estimation) * 100).toFixed(1)}% du volume original</div>
          </div>
        </div>
      </div>
    );
  };

  if (!isVisible) return null;

  return (
    <div style={{
      position: 'fixed',
      top: '5%',
      left: '10%',
      width: '80%',
      height: '90%',
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
        <h3 style={{ margin: 0 }}>🔧 Normalisation Géométrique du Mesh</h3>
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
          <h4 style={{ margin: '0 0 10px 0', color: '#3498db' }}>📁 Sélection du Fichier</h4>
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
              <option value="brain">🧠 Cerveau - {appState.brainFile.filename}</option>
            )}
            {appState.lesionFile && (
              <option value="lesion" disabled>🔴 Lésions - {appState.lesionFile.filename} (Auto-transformées)</option>
            )}
          </select>
          
          {/* Warning message for lesion selection */}
          {selectedFile === 'lesion' && (
            <div style={{
              marginTop: '10px',
              padding: '10px',
              background: 'rgba(241, 196, 15, 0.2)',
              border: '1px solid #f1c40f',
              borderRadius: '4px',
              fontSize: '13px'
            }}>
              <div style={{ color: '#f1c40f', fontWeight: 'bold', marginBottom: '5px' }}>
                ⚠️ Information Important
              </div>
              <div style={{ color: '#bdc3c7' }}>
                Les lésions ne peuvent pas être normalisées directement. Elles sont automatiquement transformées 
                lorsque vous normalisez le cerveau (FLAIR). Sélectionnez le fichier cerveau pour appliquer la normalisation.
              </div>
            </div>
          )}
        </div>

        {/* Method Selection */}
        <div style={{
          background: '#34495e',
          padding: '15px',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          <h4 style={{ margin: '0 0 15px 0', color: '#3498db' }}>🎯 Type de Normalisation</h4>
          {Object.entries(normalizationMethods).map(([key, method]) => (
            <div
              key={key}
              style={{
                background: selectedMethod === key ? '#3498db' : '#2c3e50',
                padding: '12px',
                borderRadius: '6px',
                marginBottom: '10px',
                cursor: 'pointer',
                transition: 'all 0.3s',
                border: selectedMethod === key ? '2px solid #fff' : '1px solid #34495e'
              }}
              onClick={() => setSelectedMethod(key)}
            >
              <div style={{ fontWeight: 'bold', fontSize: '16px' }}>
                {method.icon} {method.name}
              </div>
              <div style={{ fontSize: '13px', marginTop: '5px', color: '#bdc3c7' }}>
                {method.description}
              </div>
              <div style={{ fontSize: '12px', marginTop: '5px', color: '#f39c12', fontStyle: 'italic' }}>
                ➤ {method.effect}
              </div>
            </div>
          ))}
        </div>

        {/* Parameters */}
        <div style={{
          background: '#34495e',
          padding: '15px',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          <h4 style={{ margin: '0 0 15px 0', color: '#3498db' }}>⚙️ Paramètres</h4>
          
          {selectedMethod === 'cartesian' && (
            <>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>
                  📏 Taille cible du cube (mm):
                </label>
                <input
                  type="number"
                  value={parameters.target_size}
                  onChange={(e) => handleParameterChange('target_size', e.target.value)}
                  style={{
                    background: '#2c3e50',
                    color: 'white',
                    border: '1px solid #3498db',
                    borderRadius: '4px',
                    padding: '8px',
                    width: '100%'
                  }}
                  min="10"
                  max="500"
                />
              </div>
              
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'flex', alignItems: 'center', fontSize: '14px' }}>
                  <input
                    type="checkbox"
                    checked={parameters.center_at_origin}
                    onChange={(e) => handleBooleanParameterChange('center_at_origin', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  🎯 Centrer à l'origine (0,0,0)
                </label>
              </div>
              
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'flex', alignItems: 'center', fontSize: '14px' }}>
                  <input
                    type="checkbox"
                    checked={parameters.preserve_aspect_ratio}
                    onChange={(e) => handleBooleanParameterChange('preserve_aspect_ratio', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  📐 Préserver les proportions
                </label>
              </div>
            </>
          )}

          {selectedMethod === 'spherical' && (
            <>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>
                  🌐 Rayon cible de la sphère (mm):
                </label>
                <input
                  type="number"
                  value={parameters.target_radius}
                  onChange={(e) => handleParameterChange('target_radius', e.target.value)}
                  style={{
                    background: '#2c3e50',
                    color: 'white',
                    border: '1px solid #3498db',
                    borderRadius: '4px',
                    padding: '8px',
                    width: '100%'
                  }}
                  min="5"
                  max="200"
                />
              </div>
              
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>
                  🎯 Mode de centrage:
                </label>
                <select
                  value={parameters.center_mode}
                  onChange={(e) => handleParameterChange('center_mode', e.target.value)}
                  style={{
                    background: '#2c3e50',
                    color: 'white',
                    border: '1px solid #3498db',
                    borderRadius: '4px',
                    padding: '8px',
                    width: '100%'
                  }}
                >
                  <option value="centroid">Centroïde (moyenne des points)</option>
                  <option value="geometric_center">Centre géométrique (bounding box)</option>
                  <option value="mass_center">Centre de masse</option>
                </select>
              </div>
              
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'flex', alignItems: 'center', fontSize: '14px' }}>
                  <input
                    type="checkbox"
                    checked={parameters.normalize_to_unit_sphere}
                    onChange={(e) => handleBooleanParameterChange('normalize_to_unit_sphere', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  📏 Normaliser vers une sphère unitaire
                </label>
              </div>
            </>
          )}
        </div>

        {/* Results Comparison */}
        {renderStatsComparison()}

        {/* Success Message */}
        {normalizationResult && (
          <div style={{
            background: 'rgba(39, 174, 96, 0.2)',
            border: '2px solid #27ae60',
            padding: '15px',
            borderRadius: '8px',
            marginBottom: '20px'
          }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#27ae60' }}>
              ✅ Normalisation Géométrique Appliquée!
            </h4>
            <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
              <div><strong>Méthode:</strong> {normalizationResult.method === 'cartesian' ? '📦 Cartésienne' : '🌐 Sphérique'}</div>
              <div><strong>Transformation:</strong> {normalizationResult.transform_applied ? 'Appliquée' : 'Non nécessaire'}</div>
              
              {/* Automatic Lesion Transformation Results */}
              {normalizationResult.lesion_transforms && normalizationResult.lesion_transforms.length > 0 && (
                <div style={{ marginTop: '10px', padding: '8px', background: 'rgba(52, 152, 219, 0.2)', borderRadius: '4px' }}>
                  <div style={{ fontWeight: 'bold', color: '#3498db', marginBottom: '5px' }}>
                    🎯 Transformation Automatique des Lésions:
                  </div>
                  {normalizationResult.lesion_transforms.map((transform, index) => (
                    <div key={index} style={{ fontSize: '12px', marginBottom: '3px' }}>
                      {transform.status === 'success' && (
                        <span style={{ color: '#27ae60' }}>
                          ✅ {transform.filename}: {transform.lesion_count} lésions transformées
                        </span>
                      )}
                      {transform.status === 'no_lesions_found' && (
                        <span style={{ color: '#f39c12' }}>
                          ⚠️ {transform.filename}: Aucune lésion trouvée
                        </span>
                      )}
                      {transform.status === 'error' && (
                        <span style={{ color: '#e74c3c' }}>
                          ❌ {transform.filename}: Erreur - {transform.error}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              <div style={{ marginTop: '10px', fontSize: '12px', color: '#f39c12' }}>
                ⚠️ Le mesh 3D et les lésions ont été transformés selon les paramètres sélectionnés
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
            ❌ {error}
          </div>
        )}

        {/* Apply Button */}
        <div style={{ textAlign: 'center' }}>
          <button
            onClick={handleNormalize}
            disabled={isProcessing || (!appState.brainFile && !appState.lesionFile) || selectedFile === 'lesion'}
            style={{
              background: isProcessing ? '#7f8c8d' : (selectedFile === 'lesion' ? '#7f8c8d' : '#27ae60'),
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '15px 40px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: isProcessing || selectedFile === 'lesion' ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s',
              boxShadow: isProcessing || selectedFile === 'lesion' ? 'none' : '0 4px 8px rgba(39, 174, 96, 0.3)'
            }}
          >
            {isProcessing ? '🔄 Normalisation en cours...' : 
             selectedFile === 'lesion' ? '🚫 Sélectionnez le cerveau pour normaliser' : 
             '🎯 Appliquer la Normalisation'}
          </button>
          
          {selectedFile === 'lesion' && (
            <div style={{ 
              marginTop: '10px', 
              fontSize: '12px', 
              color: '#f39c12',
              textAlign: 'center'
            }}>
              💡 Conseil: Sélectionnez "🧠 Cerveau" pour normaliser. Les lésions seront transformées automatiquement!
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{
        background: '#34495e',
        padding: '12px 15px',
        borderRadius: '0 0 8px 8px',
        fontSize: '12px',
        color: '#bdc3c7',
        textAlign: 'center'
      }}>
        🔧 La normalisation géométrique transforme les coordonnées 3D du mesh pour standardiser sa forme et position
      </div>
    </div>
  );
};

export default NormalizationPanel;