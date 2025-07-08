// components/SliceViewer.js - FIXED VERSION with correct anatomical orientations
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

// API configuration
const API_BASE_URL = 'http://localhost:5000/api';

// Canvas component for rendering 2D slices with measurement tools
const SliceCanvas = ({ 
  sliceData, 
  sliceShape, 
  windowLevel, 
  windowWidth, 
  colormap,
  onPixelClick,
  crosshairPosition,
  showCrosshair,
  showGrid,
  zoomLevel,
  contrast,
  brightness,
  showMeasurements,
  measurements,
  onMeasurementUpdate,
  currentMeasurementTool,
  voxelSpacing,
  viewType
}) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentMeasurement, setCurrentMeasurement] = useState(null);

  // Apply window/level adjustments to slice data
  const applyWindowLevel = useCallback((data, level, width, contrast = 1.0, brightness = 0) => {
    if (!data || data.length === 0) return data;
    
    const flatData = data.flat();
    const nonZeroData = flatData.filter(val => val > 0);
    
    let adjustedLevel = level;
    let adjustedWidth = width;
    
    if (nonZeroData.length > 0 && (level === 40 && width === 80)) {
      const dataMin = Math.min(...nonZeroData);
      const dataMax = Math.max(...nonZeroData);
      const dataMean = nonZeroData.reduce((a, b) => a + b, 0) / nonZeroData.length;
      
      adjustedLevel = dataMean;
      adjustedWidth = (dataMax - dataMin) * 0.8;
    }
    
    const minVal = adjustedLevel - adjustedWidth / 2;
    const maxVal = adjustedLevel + adjustedWidth / 2;
    
    return data.map(row => 
      row.map(pixel => {
        let clampedVal = Math.max(minVal, Math.min(maxVal, pixel));
        let normalized = adjustedWidth > 0 ? (clampedVal - minVal) / adjustedWidth : 0;
        normalized = Math.pow(Math.max(0, normalized), 1/contrast) + (brightness / 100);
        return Math.round(Math.max(0, Math.min(1, normalized)) * 255);
      })
    );
  }, []);

  // Apply colormap to grayscale data
  const applyColormap = useCallback((data, colormap) => {
    if (!data || colormap === 'gray') return data;
    
    const colormaps = {
      jet: (val) => {
        const normalized = val / 255;
        if (normalized < 0.25) {
          return [0, Math.floor(normalized * 4 * 255), 255];
        } else if (normalized < 0.5) {
          return [0, 255, Math.floor((0.5 - normalized) * 4 * 255)];
        } else if (normalized < 0.75) {
          return [Math.floor((normalized - 0.5) * 4 * 255), 255, 0];
        } else {
          return [255, Math.floor((1 - normalized) * 4 * 255), 0];
        }
      },
      hot: (val) => {
        const normalized = val / 255;
        if (normalized < 0.33) {
          return [Math.floor(normalized * 3 * 255), 0, 0];
        } else if (normalized < 0.66) {
          return [255, Math.floor((normalized - 0.33) * 3 * 255), 0];
        } else {
          return [255, 255, Math.floor((normalized - 0.66) * 3 * 255)];
        }
      },
      rainbow: (val) => {
        const normalized = val / 255;
        const hue = normalized * 360;
        const saturation = 1;
        const lightness = 0.5;
        
        const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
        const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
        const m = lightness - c / 2;
        
        let r, g, b;
        if (hue < 60) [r, g, b] = [c, x, 0];
        else if (hue < 120) [r, g, b] = [x, c, 0];
        else if (hue < 180) [r, g, b] = [0, c, x];
        else if (hue < 240) [r, g, b] = [0, x, c];
        else if (hue < 300) [r, g, b] = [x, 0, c];
        else [r, g, b] = [c, 0, x];
        
        return [
          Math.floor((r + m) * 255),
          Math.floor((g + m) * 255),
          Math.floor((b + m) * 255)
        ];
      }
    };

    if (colormaps[colormap]) {
      return data.map(row => 
        row.map(pixel => colormaps[colormap](pixel))
      );
    }
    
    return data;
  }, []);

  // Calculate distance between two points in mm
  const calculateDistance = (p1, p2) => {
    const dx = (p2.x - p1.x) * voxelSpacing[0];
    const dy = (p2.y - p1.y) * voxelSpacing[1];
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Calculate area of a polygon in mm²
  const calculateArea = (points) => {
    if (points.length < 3) return 0;
    
    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      area += points[i].x * points[j].y;
      area -= points[j].x * points[i].y;
    }
    area = Math.abs(area) / 2;
    
    // Convert to mm²
    return area * voxelSpacing[0] * voxelSpacing[1];
  };

  // Handle mouse events for measurements
  const handleMouseDown = (event) => {
    if (!showMeasurements || !currentMeasurementTool) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = Math.floor((event.clientX - rect.left) * scaleX);
    const y = Math.floor((event.clientY - rect.top) * scaleY);
    
    if (currentMeasurementTool === 'distance') {
      setIsDrawing(true);
      setCurrentMeasurement({
        type: 'distance',
        points: [{ x, y }],
        value: 0
      });
    } else if (currentMeasurementTool === 'area') {
      if (!currentMeasurement) {
        setCurrentMeasurement({
          type: 'area',
          points: [{ x, y }],
          value: 0
        });
      } else {
        // Add point to existing area measurement
        const updatedPoints = [...currentMeasurement.points, { x, y }];
        setCurrentMeasurement({
          ...currentMeasurement,
          points: updatedPoints,
          value: calculateArea(updatedPoints)
        });
      }
    }
  };

  const handleMouseMove = (event) => {
    if (!isDrawing || !currentMeasurement) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = Math.floor((event.clientX - rect.left) * scaleX);
    const y = Math.floor((event.clientY - rect.top) * scaleY);
    
    if (currentMeasurement.type === 'distance') {
      const distance = calculateDistance(currentMeasurement.points[0], { x, y });
      setCurrentMeasurement({
        ...currentMeasurement,
        points: [currentMeasurement.points[0], { x, y }],
        value: distance
      });
    }
  };

  const handleMouseUp = (event) => {
    if (!isDrawing || !currentMeasurement) return;
    
    if (currentMeasurement.type === 'distance') {
      setIsDrawing(false);
      if (currentMeasurement.points.length === 2) {
        onMeasurementUpdate([...measurements, {
          ...currentMeasurement,
          id: Date.now(),
          timestamp: new Date().toISOString()
        }]);
        setCurrentMeasurement(null);
      }
    }
  };

  const handleDoubleClick = () => {
    if (currentMeasurement && currentMeasurement.type === 'area') {
      if (currentMeasurement.points.length >= 3) {
        onMeasurementUpdate([...measurements, {
          ...currentMeasurement,
          id: Date.now(),
          timestamp: new Date().toISOString()
        }]);
      }
      setCurrentMeasurement(null);
    }
  };

  // Render slice and measurements to canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !sliceData || !sliceShape) return;

    const ctx = canvas.getContext('2d');
    const [height, width] = sliceShape;
    
    canvas.width = width;
    canvas.height = height;
    
    // Apply window/level
    const processedData = applyWindowLevel(sliceData, windowLevel, windowWidth, contrast, brightness);
    
    // Apply colormap
    const coloredData = applyColormap(processedData, colormap);
    
    // Create ImageData
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        
        if (colormap === 'gray') {
          const value = processedData[y][x];
          data[index] = value;
          data[index + 1] = value;
          data[index + 2] = value;
        } else {
          const [r, g, b] = coloredData[y][x];
          data[index] = r;
          data[index + 1] = g;
          data[index + 2] = b;
        }
        data[index + 3] = 255;
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
    
    // Draw grid
    if (showGrid) {
      ctx.strokeStyle = 'rgba(100, 100, 100, 0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      
      const gridSize = 50;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    }
    
    // Draw measurements
    if (showMeasurements) {
      // Draw completed measurements
      measurements.forEach(measurement => {
        if (measurement.type === 'distance' && measurement.points.length === 2) {
          ctx.strokeStyle = '#00ff00';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(measurement.points[0].x, measurement.points[0].y);
          ctx.lineTo(measurement.points[1].x, measurement.points[1].y);
          ctx.stroke();
          
          // Draw endpoints
          ctx.fillStyle = '#00ff00';
          measurement.points.forEach(point => {
            ctx.beginPath();
            ctx.arc(point.x, point.y, 3, 0, 2 * Math.PI);
            ctx.fill();
          });
          
          // Draw label
          const midX = (measurement.points[0].x + measurement.points[1].x) / 2;
          const midY = (measurement.points[0].y + measurement.points[1].y) / 2;
          ctx.fillStyle = '#00ff00';
          ctx.font = '12px Arial';
          ctx.fillText(`${measurement.value.toFixed(2)} mm`, midX + 5, midY - 5);
        } else if (measurement.type === 'area' && measurement.points.length >= 3) {
          ctx.strokeStyle = '#ffff00';
          ctx.fillStyle = 'rgba(255, 255, 0, 0.2)';
          ctx.lineWidth = 2;
          
          ctx.beginPath();
          ctx.moveTo(measurement.points[0].x, measurement.points[0].y);
          measurement.points.forEach((point, i) => {
            if (i > 0) ctx.lineTo(point.x, point.y);
          });
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          
          // Draw vertices
          ctx.fillStyle = '#ffff00';
          measurement.points.forEach(point => {
            ctx.beginPath();
            ctx.arc(point.x, point.y, 3, 0, 2 * Math.PI);
            ctx.fill();
          });
          
          // Draw label
          const centerX = measurement.points.reduce((sum, p) => sum + p.x, 0) / measurement.points.length;
          const centerY = measurement.points.reduce((sum, p) => sum + p.y, 0) / measurement.points.length;
          ctx.fillStyle = '#ffff00';
          ctx.font = '12px Arial';
          ctx.fillText(`${measurement.value.toFixed(2)} mm²`, centerX - 20, centerY);
        }
      });
      
      // Draw current measurement
      if (currentMeasurement) {
        if (currentMeasurement.type === 'distance' && currentMeasurement.points.length === 2) {
          ctx.strokeStyle = '#00ffff';
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.moveTo(currentMeasurement.points[0].x, currentMeasurement.points[0].y);
          ctx.lineTo(currentMeasurement.points[1].x, currentMeasurement.points[1].y);
          ctx.stroke();
          ctx.setLineDash([]);
          
          ctx.fillStyle = '#00ffff';
          ctx.font = '12px Arial';
          ctx.fillText(`${currentMeasurement.value.toFixed(2)} mm`, 
            currentMeasurement.points[1].x + 5, 
            currentMeasurement.points[1].y - 5);
        } else if (currentMeasurement.type === 'area' && currentMeasurement.points.length > 0) {
          ctx.strokeStyle = '#ffff00';
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 5]);
          
          if (currentMeasurement.points.length > 1) {
            ctx.beginPath();
            ctx.moveTo(currentMeasurement.points[0].x, currentMeasurement.points[0].y);
            currentMeasurement.points.forEach((point, i) => {
              if (i > 0) ctx.lineTo(point.x, point.y);
            });
            ctx.stroke();
          }
          ctx.setLineDash([]);
          
          // Draw vertices
          ctx.fillStyle = '#ffff00';
          currentMeasurement.points.forEach(point => {
            ctx.beginPath();
            ctx.arc(point.x, point.y, 3, 0, 2 * Math.PI);
            ctx.fill();
          });
        }
      }
    }
    
    // Draw crosshair
    if (showCrosshair && crosshairPosition) {
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      
      ctx.beginPath();
      ctx.moveTo(crosshairPosition.x, 0);
      ctx.lineTo(crosshairPosition.x, height);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(0, crosshairPosition.y);
      ctx.lineTo(width, crosshairPosition.y);
      ctx.stroke();
      
      ctx.setLineDash([]);
    }
    
  }, [sliceData, sliceShape, windowLevel, windowWidth, colormap, crosshairPosition, 
      showCrosshair, showGrid, contrast, brightness, applyWindowLevel, applyColormap,
      showMeasurements, measurements, currentMeasurement]);

  const handleCanvasClick = (event) => {
    if (showMeasurements && currentMeasurementTool) {
      handleMouseDown(event);
    } else if (onPixelClick) {
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      
      const x = Math.floor((event.clientX - rect.left) * scaleX);
      const y = Math.floor((event.clientY - rect.top) * scaleY);
      
      onPixelClick({ x, y, value: sliceData?.[y]?.[x] || 0 });
    }
  };

  return (
    <div className="slice-canvas-container" style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center',
      width: '100%',
      height: '100%',
      background: '#000'
    }}>
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        style={{
          maxWidth: `${100 * zoomLevel}%`,
          maxHeight: `${100 * zoomLevel}%`,
          cursor: showMeasurements ? 'crosshair' : 'default',
          imageRendering: 'pixelated',
          transform: `scale(${zoomLevel})`
        }}
      />
    </div>
  );
};

// Get anatomical orientation labels for each view type
const getOrientationLabels = (viewType) => {
  switch (viewType) {
    case 'axial':
      return {
        top: 'A',      // Anterior
        bottom: 'P',   // Posterior  
        left: 'R',     // Right (patient's right on viewer's left)
        right: 'L'     // Left
      };
    case 'coronal':
      return {
        top: 'S',      // Superior
        bottom: 'I',   // Inferior
        left: 'R',     // Right
        right: 'L'     // Left
      };
    case 'sagittal':
      return {
        top: 'S',      // Superior
        bottom: 'I',   // Inferior
        left: 'A',     // Anterior
        right: 'P'     // Posterior
      };
    default:
      return { top: '', bottom: '', left: '', right: '' };
  }
};

// Main SliceViewer component - FIXED VERSION with correct orientations
const SliceViewer = ({ appState, onParameterUpdate }) => {
  const { authenticatedFetch } = useAuth();
  
  const [sliceData, setSliceData] = useState({
    brain: { axial: null, coronal: null, sagittal: null },
    lesion: { axial: null, coronal: null, sagittal: null }
  });
  
  // CRITICAL FIX: Initialize with proper default values
  const [currentSliceIndices, setCurrentSliceIndices] = useState({
    axial: 0,
    coronal: 0,
    sagittal: 0
  });
  
  const [maxSlices, setMaxSlices] = useState({
    axial: 1, // Start with 1 instead of 0
    coronal: 1,
    sagittal: 1
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [crosshairPosition, setCrosshairPosition] = useState(null);
  const [measurements, setMeasurements] = useState([]);
  const [currentMeasurementTool, setCurrentMeasurementTool] = useState('distance');

  const viewType = appState.viewMode.replace('2D-', '');
  const is2DMode = appState.viewMode.startsWith('2D-');

  // Get voxel spacing for current view
  const getVoxelSpacing = () => {
    if (!appState.brainFile) return [1, 1];
    const zooms = appState.brainFile.zooms;
    
    switch (viewType) {
      case 'axial':
        return [zooms[0], zooms[1]]; // x, y
      case 'coronal':
        return [zooms[0], zooms[2]]; // x, z
      case 'sagittal':
        return [zooms[1], zooms[2]]; // y, z
      default:
        return [1, 1];
    }
  };

  // Load slice data from backend - FIXED VERSION
  const loadSlice = useCallback(async (fileId, viewType, sliceIndex) => {
    try {
      setLoading(true);
      setError(null);
      
      // CRITICAL FIX: Validate slice index before making request
      const validSliceIndex = Math.max(0, Math.min(sliceIndex || 0, maxSlices[viewType] - 1));
      
      if (isNaN(validSliceIndex)) {
        console.warn(`Invalid slice index for ${viewType}: ${sliceIndex}, using 0`);
        return null;
      }
      
      console.log(`Loading slice: ${fileId}/${viewType}/${validSliceIndex}`);
      
      const response = await authenticatedFetch(`${API_BASE_URL}/slice/${fileId}/${viewType}/${validSliceIndex}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        // Backend now returns correctly oriented slice data
        return {
          data: data.slice_data,
          shape: data.shape,
          maxSlices: data.max_slices || maxSlices[viewType],
          orientationApplied: data.orientation_applied || false
        };
      } else {
        throw new Error(data.error || 'Failed to load slice');
      }
    } catch (error) {
      console.error(`Error loading slice:`, error);
      setError(`Failed to load slice: ${error.message}`);
      return null;
    } finally {
      setLoading(false);
    }
  }, [maxSlices, authenticatedFetch]);

  // Initialize max slices from file shape - CRITICAL FIX
  useEffect(() => {
    if (appState.brainFile && appState.brainFile.shape) {
      const [width, height, depth] = appState.brainFile.shape;
      
      console.log('Initializing max slices from file shape:', appState.brainFile.shape);
      
      const newMaxSlices = {
        axial: depth,
        coronal: height,
        sagittal: width
      };
      
      setMaxSlices(newMaxSlices);
      
      // Initialize current slice indices to middle of each dimension
      setCurrentSliceIndices({
        axial: Math.floor(depth / 2),
        coronal: Math.floor(height / 2),
        sagittal: Math.floor(width / 2)
      });
      
      console.log('Set max slices:', newMaxSlices);
      console.log('Set initial slice indices:', {
        axial: Math.floor(depth / 2),
        coronal: Math.floor(height / 2),
        sagittal: Math.floor(width / 2)
      });
    }
  }, [appState.brainFile]);

  // Load current slice when parameters change - FIXED VERSION
  useEffect(() => {
    if (!is2DMode || !appState.brainFile) {
      return;
    }

    const loadCurrentSlice = async () => {
      const sliceIndex = currentSliceIndices[viewType];
      
      // CRITICAL FIX: Validate slice index
      if (isNaN(sliceIndex) || sliceIndex < 0) {
        console.warn(`Invalid slice index for ${viewType}: ${sliceIndex}`);
        return;
      }
      
      console.log(`Loading ${viewType} slice ${sliceIndex}/${maxSlices[viewType]} with correct orientation`);
      
      const brainSlice = await loadSlice(appState.brainFile.file_id, viewType, sliceIndex);
      if (brainSlice) {
        console.log(`Loaded brain slice with orientation applied: ${brainSlice.orientationApplied}`);
        setSliceData(prev => ({
          ...prev,
          brain: { ...prev.brain, [viewType]: brainSlice }
        }));
      }
      
      if (appState.lesionFile) {
        const lesionSlice = await loadSlice(appState.lesionFile.file_id, viewType, sliceIndex);
        if (lesionSlice) {
          console.log(`Loaded lesion slice with orientation applied: ${lesionSlice.orientationApplied}`);
          setSliceData(prev => ({
            ...prev,
            lesion: { ...prev.lesion, [viewType]: lesionSlice }
          }));
        }
      }
    };

    loadCurrentSlice();
  }, [appState.brainFile, appState.lesionFile, viewType, currentSliceIndices, is2DMode, loadSlice, maxSlices]);

  const handleSliceChange = (newSliceIndex) => {
    // CRITICAL FIX: Ensure slice index is valid
    const validIndex = Math.max(0, Math.min(maxSlices[viewType] - 1, parseInt(newSliceIndex) || 0));
    
    if (isNaN(validIndex)) {
      console.warn(`Invalid slice index: ${newSliceIndex}, keeping current`);
      return;
    }
    
    console.log(`Changing ${viewType} slice to ${validIndex}`);
    
    setCurrentSliceIndices(prev => ({
      ...prev,
      [viewType]: validIndex
    }));
  };

  const handlePixelClick = (pixelInfo) => {
    setCrosshairPosition({ x: pixelInfo.x, y: pixelInfo.y });
  };

  // Handle screenshot
  const takeScreenshot = useCallback(() => {
    const canvasContainer = document.querySelector('.slice-canvas-container');
    const canvas = canvasContainer ? canvasContainer.querySelector('canvas') : null;
    
    if (!canvas) {
      console.error('No canvas found for screenshot');
      return;
    }
    
    try {
      const link = document.createElement('a');
      link.download = `brain_slice_${viewType}_${currentSliceIndices[viewType]}_${Date.now()}.png`;
      link.href = canvas.toDataURL();
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log('Screenshot saved successfully');
      onParameterUpdate('statusMessage', 'Capture d\'écran enregistrée!');
    } catch (error) {
      console.error('Error taking screenshot:', error);
      onParameterUpdate('statusMessage', 'Erreur lors de la capture d\'écran');
    }
  }, [viewType, currentSliceIndices, onParameterUpdate]);

  // Handle data export
  const exportData = useCallback(() => {
    const data = {
      measurements: measurements,
      viewType: viewType,
      sliceIndex: currentSliceIndices[viewType],
      windowLevel: appState.windowLevel,
      windowWidth: appState.windowWidth,
      timestamp: new Date().toISOString(),
      fileInfo: appState.brainFile
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.download = `brain_measurements_${Date.now()}.json`;
    link.href = URL.createObjectURL(blob);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    console.log('Data exported successfully');
  }, [measurements, viewType, currentSliceIndices, appState]);

  // Clear measurements when requested
  useEffect(() => {
    if (appState.clearMeasurements && appState.clearMeasurements > 0) {
      setMeasurements([]);
    }
  }, [appState.clearMeasurements]);

  // Export screenshot when requested
  useEffect(() => {
    if (appState.takeScreenshot && appState.takeScreenshot > 0) {
      takeScreenshot();
    }
  }, [appState.takeScreenshot, takeScreenshot]);

  // Export data when requested
  useEffect(() => {
    if (appState.exportData && appState.exportData > 0) {
      exportData();
    }
  }, [appState.exportData, exportData]);

  if (!is2DMode) {
    return null;
  }

  const currentBrainSlice = sliceData.brain[viewType];
  const currentSliceIndex = currentSliceIndices[viewType] || 0; // Fallback to 0
  const orientationLabels = getOrientationLabels(viewType);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Slice Navigation Controls */}
      <div style={{
        background: 'rgba(0,0,0,0.8)',
        padding: '10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '15px',
        color: 'white',
        fontSize: '14px'
      }}>
        <button
          onClick={() => handleSliceChange(currentSliceIndex - 1)}
          disabled={currentSliceIndex <= 0}
          style={{
            background: '#3498db',
            color: 'white',
            border: 'none',
            padding: '5px 10px',
            borderRadius: '3px',
            cursor: 'pointer'
          }}
        >
          ← Précédent
        </button>
        
        <span>
          Vue {viewType}: {currentSliceIndex + 1} / {maxSlices[viewType]}
        </span>
        
        <input
          type="range"
          min="0"
          max={Math.max(0, maxSlices[viewType] - 1)}
          value={currentSliceIndex}
          onChange={(e) => handleSliceChange(parseInt(e.target.value))}
          style={{ width: '200px' }}
        />
        
        <button
          onClick={() => handleSliceChange(currentSliceIndex + 1)}
          disabled={currentSliceIndex >= maxSlices[viewType] - 1}
          style={{
            background: '#3498db',
            color: 'white',
            border: 'none',
            padding: '5px 10px',
            borderRadius: '3px',
            cursor: 'pointer'
          }}
        >
          Suivant →
        </button>
        
        <span style={{ 
          fontSize: '12px', 
          color: '#95a5a6', 
          marginLeft: '15px' 
        }}>
          ✅ Orientation radiologique correcte
        </span>
      </div>

      {/* Measurement Tools Bar */}
      {appState.showMeasurements && (
        <div style={{
          background: 'rgba(0,0,0,0.8)',
          padding: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          color: 'white',
          fontSize: '14px'
        }}>
          <button
            onClick={() => setCurrentMeasurementTool('distance')}
            style={{
              background: currentMeasurementTool === 'distance' ? '#3498db' : '#34495e',
              color: 'white',
              border: 'none',
              padding: '5px 15px',
              borderRadius: '3px',
              cursor: 'pointer'
            }}
          >
            📏 Distance
          </button>
          
          <button
            onClick={() => setCurrentMeasurementTool('area')}
            style={{
              background: currentMeasurementTool === 'area' ? '#3498db' : '#34495e',
              color: 'white',
              border: 'none',
              padding: '5px 15px',
              borderRadius: '3px',
              cursor: 'pointer'
            }}
          >
            📐 Zone
          </button>
          
          <span style={{ marginLeft: '20px', fontSize: '12px', color: '#bdc3c7' }}>
            {currentMeasurementTool === 'distance' 
              ? 'Cliquez et glissez pour mesurer la distance'
              : 'Cliquez pour ajouter des points, double-cliquez pour terminer'}
          </span>
        </div>
      )}

      {/* Main slice viewer */}
      <div style={{ flex: 1, position: 'relative' }}>
        {loading && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 1000,
            background: 'rgba(0,0,0,0.8)',
            padding: '20px',
            borderRadius: '10px',
            color: 'white'
          }}>
            Chargement de la coupe...
          </div>
        )}

        {error && (
          <div style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            zIndex: 1000,
            background: 'rgba(231, 76, 60, 0.9)',
            padding: '10px',
            borderRadius: '5px',
            color: 'white',
            fontSize: '12px'
          }}>
            {error}
          </div>
        )}

        {currentBrainSlice && (
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <SliceCanvas
              sliceData={currentBrainSlice.data}
              sliceShape={currentBrainSlice.shape}
              windowLevel={appState.windowLevel}
              windowWidth={appState.windowWidth}
              colormap={appState.colormap}
              onPixelClick={handlePixelClick}
              crosshairPosition={crosshairPosition}
              showCrosshair={appState.showCrosshair}
              showGrid={appState.showGrid}
              zoomLevel={appState.zoomLevel}
              contrast={appState.contrast}
              brightness={appState.brightness}
              showMeasurements={appState.showMeasurements}
              measurements={measurements}
              onMeasurementUpdate={setMeasurements}
              currentMeasurementTool={currentMeasurementTool}
              voxelSpacing={getVoxelSpacing()}
              viewType={viewType}
            />
            
            {/* CORRECTED Anatomical orientation labels */}
            <div style={{
              position: 'absolute',
              top: '10px',
              left: '50%',
              transform: 'translateX(-50%)',
              color: '#00ff00',
              fontSize: '14px',
              fontWeight: 'bold',
              textShadow: '1px 1px 2px black',
              pointerEvents: 'none'
            }}>
              {orientationLabels.top}
            </div>
            
            <div style={{
              position: 'absolute',
              bottom: '10px',
              left: '50%',
              transform: 'translateX(-50%)',
              color: '#00ff00',
              fontSize: '14px',
              fontWeight: 'bold',
              textShadow: '1px 1px 2px black',
              pointerEvents: 'none'
            }}>
              {orientationLabels.bottom}
            </div>
            
            <div style={{
              position: 'absolute',
              left: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#00ff00',
              fontSize: '14px',
              fontWeight: 'bold',
              textShadow: '1px 1px 2px black',
              pointerEvents: 'none'
            }}>
              {orientationLabels.left}
            </div>
            
            <div style={{
              position: 'absolute',
              right: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#00ff00',
              fontSize: '14px',
              fontWeight: 'bold',
              textShadow: '1px 1px 2px black',
              pointerEvents: 'none'
            }}>
              {orientationLabels.right}
            </div>
          </div>
        )}
      </div>

      {/* Slice information and measurements */}
      <div style={{
        background: 'rgba(0,0,0,0.8)',
        padding: '10px',
        color: 'white',
        fontSize: '12px',
        display: 'flex',
        justifyContent: 'space-between'
      }}>
        <div>
          Mode: {appState.viewMode} | 
          Niveau: {appState.windowLevel} | 
          Fenêtre: {appState.windowWidth} |
          Coupe: {currentSliceIndex + 1}/{maxSlices[viewType]} |
          Orientation: Radiologique
        </div>
        {crosshairPosition && (
          <div>
            Position: ({crosshairPosition.x}, {crosshairPosition.y})
          </div>
        )}
      </div>

      {/* Measurements panel */}
      {appState.showMeasurements && measurements.length > 0 && (
        <div style={{
          background: 'rgba(0,0,0,0.9)',
          padding: '10px',
          color: 'white',
          fontSize: '12px',
          maxHeight: '150px',
          overflow: 'auto'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>📊 Mesures:</div>
          {measurements.map((m, index) => (
            <div key={m.id} style={{ marginBottom: '3px' }}>
              {m.type === 'distance' 
                ? `📏 Distance ${index + 1}: ${m.value.toFixed(2)} mm`
                : `📐 Zone ${index + 1}: ${m.value.toFixed(2)} mm²`}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SliceViewer;