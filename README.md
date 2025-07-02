# BrainOS - 3D Brain Visualization Application

A powerful web application for visualizing and analyzing brain MRI scans in NIFTI format.

## Features
- 3D volume rendering with Three.js
- 2D slice viewer (axial, coronal, sagittal)
- Measurement tools for distance and area
- Data normalization algorithms
- Mesh export (STL format)
- Statistical analysis
- Performance optimizations

## Tech Stack
- **Frontend**: React, Three.js, React Three Fiber
- **Backend**: Flask, NumPy, NiBabel, SciPy

## Installation

### Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py
Frontend Setup
bashcd frontend
npm install
npm start

Usage

1/Start the Flask backend (runs on http://localhost:5000)
2/Start the React frontend (runs on http://localhost:3000)
/Upload a NIFTI file (.nii or .nii.gz)
4/Explore 3D/2D visualizations