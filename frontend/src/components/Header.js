// components/Header.js - Updated with logout button
import React from 'react';
import { useAuth } from '../contexts/AuthContext';

const Header = ({ appState, onReset, user, onLogout }) => {
  const { logout, isAdmin } = useAuth();

  const handleLogout = () => {
    if (window.confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
      logout();
    }
  };

  const handleSwitchToAdmin = () => {
    if (isAdmin()) {
      window.location.href = '/admin-dashboard';
    }
  };

  return (
    <div className="app-header">
      <div className="app-title">
        <span className="app-title-icon">🧠</span>
        BrainOS
        {user && (
          <span className="user-info-header">
            - {user.prenom} {user.nom}
            {user.status === 'trial' && (
              <span className="trial-badge">
                Essai ({user.days_remaining}j, {user.uploads_remaining} uploads)
              </span>
            )}
          </span>
        )}
      </div>
      
      <div className="header-controls">
        {/* Trial Status Indicator */}
        {user && user.status === 'trial' && (
          <div className="trial-status-indicator">
            <span className="trial-icon">🔥</span>
            <div className="trial-details">
              <div className="trial-time">{user.days_remaining} jours restants</div>
              <div className="trial-uploads">{user.uploads_remaining} téléchargements</div>
            </div>
          </div>
        )}

        {/* Admin Panel Button */}
        {isAdmin() && (
          <button
            onClick={handleSwitchToAdmin}
            className="button-admin"
            title="Accéder au panneau d'administration"
          >
            👑 Admin
          </button>
        )}

        {/* Reset Button */}
        <button
          onClick={onReset}
          className="button-danger"
          title="Réinitialiser l'application"
        >
          🔄 Reset
        </button>

        {/* Account Menu */}
        <div className="account-menu">
          <button
            onClick={handleLogout}
            className="button-logout"
            title="Se déconnecter"
          >
            🚪 Déconnexion
          </button>
        </div>
      </div>
    </div>
  );
};

export default Header;