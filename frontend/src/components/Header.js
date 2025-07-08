import React from 'react';

const Header = ({ appState, onReset }) => {
  return (
    <div className="app-header">
      <div className="app-title">
        <span className="app-title-icon">🧠</span>
        BrainOS - Visualisation 3D Cérébrale
      </div>
      <div className="header-controls">
        <button onClick={onReset} className="button-small">
          Réinitialiser
        </button>
      </div>
    </div>
  );
};

export default Header;