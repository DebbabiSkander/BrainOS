// components/ProtectedRoute.js - Updated for new trial system
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = ({ children, requireAdmin = false }) => {
  const { user, loading, isAuthenticated, isAdmin } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <h3>Chargement...</h3>
          <p>Vérification de l'authentification</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated()) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check admin requirement
  if (requireAdmin && !isAdmin()) {
    return <Navigate to="/dashboard" replace />;
  }

  // Check user status and render appropriate component
  if (user.status === 'trial') {
    return <TrialUserWrapper>{children}</TrialUserWrapper>;
  }

  if (user.status === 'pending') {
    return <PendingApprovalComponent />;
  }

  if (user.status === 'rejected') {
    return <AccountRejectedComponent />;
  }

  if (user.status === 'suspended') {
    return <AccountSuspendedComponent />;
  }

  if (user.status === 'approved') {
    return children; // Full access
  }

  return children;
};

// Wrapper for trial users with warnings
const TrialUserWrapper = ({ children }) => {
  const { user } = useAuth();
  
  return (
    <div>
      {/* Trial status banner */}
      <div className="trial-banner">
        <div className="trial-info">
          <span className="trial-icon">⏱️</span>
          <div className="trial-text">
            <strong>Période d'essai:</strong> {user.days_remaining} jours restants, 
            {user.uploads_remaining} téléchargements sur {user.trial_max_uploads}
            {user.uploads_remaining <= 1 && (
              <span className="trial-warning"> - Demandez l'approbation pour continuer!</span>
            )}
          </div>
        </div>
        {user.uploads_remaining === 0 && (
          <button className="request-approval-btn" onClick={() => requestApproval()}>
            Demander l'approbation
          </button>
        )}
      </div>
      {children}
    </div>
  );
};

// Component for pending approval
const PendingApprovalComponent = () => {
  const { logout, user } = useAuth();

  return (
    <div className="status-container">
      <div className="status-card pending">
        <div className="status-icon">⏳</div>
        <h2>En attente d'approbation</h2>
        <p>
          Votre période d'essai est terminée. Votre compte est maintenant en attente 
          d'approbation par un administrateur pour obtenir un accès illimité.
        </p>
        
        <div className="status-details">
          <h4>Votre utilisation pendant l'essai :</h4>
          <ul>
            <li>✅ Téléchargements effectués: {user.trial_uploads_count}/{user.trial_max_uploads}</li>
            <li>📅 Période d'essai: {Math.abs(user.days_remaining)} jours utilisés</li>
            <li>📧 Statut: En attente d'approbation administrateur</li>
            <li>🔄 Une fois approuvé: Accès illimité à BrainOS</li>
          </ul>
        </div>

        <div className="trial-summary">
          <h4>Prochaines étapes :</h4>
          <div className="steps-list">
            <div className="step completed">✅ Période d'essai terminée</div>
            <div className="step current">⏳ En cours d'examen administrateur</div>
            <div className="step pending">📧 Notification par email</div>
            <div className="step pending">🚀 Accès illimité accordé</div>
          </div>
        </div>

        <div className="status-actions">
          <button onClick={logout} className="logout-button">
            Se déconnecter
          </button>
          <a href="mailto:admin@brainos.com" className="contact-button">
            Contacter l'administrateur
          </a>
        </div>
      </div>
    </div>
  );
};

// Component for rejected account
const AccountRejectedComponent = () => {
  const { logout } = useAuth();

  return (
    <div className="status-container">
      <div className="status-card rejected">
        <div className="status-icon">❌</div>
        <h2>Compte rejeté</h2>
        <p>
          Nous regrettons de vous informer que votre demande d'accès illimité 
          n'a pas été approuvée. Cela peut être dû à des informations 
          incomplètes ou à des critères d'éligibilité non remplis.
        </p>
        
        <div className="status-details">
          <h4>Options disponibles :</h4>
          <ul>
            <li>📧 Contactez notre équipe support pour plus d'informations</li>
            <li>📋 Fournissez des informations supplémentaires si demandées</li>
            <li>🔄 Créez un nouveau compte avec des données mises à jour</li>
            <li>💼 Explorez nos options de licence institutionnelle</li>
          </ul>
        </div>

        <div className="status-actions">
          <a href="mailto:support@brainos.com" className="contact-button primary">
            📧 Contacter le Support
          </a>
          <button onClick={logout} className="logout-button">
            Se déconnecter
          </button>
        </div>
      </div>
    </div>
  );
};

// Component for suspended account
const AccountSuspendedComponent = () => {
  const { logout, user } = useAuth();

  return (
    <div className="status-container">
      <div className="status-card suspended">
        <div className="status-icon">🚫</div>
        <h2>Compte suspendu</h2>
        <p>
          Votre compte a été suspendu. Cela peut être dû à l'expiration de votre 
          période d'essai ou au dépassement des limites d'utilisation.
        </p>
        
        <div className="status-details">
          <h4>Informations de votre compte :</h4>
          <ul>
            <li>📊 Téléchargements utilisés: {user.trial_uploads_count}/{user.trial_max_uploads}</li>
            <li>📅 Jours d'essai restants: {user.days_remaining}</li>
            <li>⏰ Dernière connexion: {user.last_login ? new Date(user.last_login).toLocaleDateString('fr-FR') : 'N/A'}</li>
          </ul>
        </div>

        <div className="resolution-options">
          <h4>Pour rétablir votre accès :</h4>
          <div className="options-grid">
            <div className="option-card">
              <div className="option-icon">📧</div>
              <h5>Contacter Support</h5>
              <p>Demandez une révision de votre compte</p>
            </div>
            <div className="option-card">
              <div className="option-icon">🔄</div>
              <h5>Nouveau Compte</h5>
              <p>Créez un nouveau compte d'essai</p>
            </div>
            <div className="option-card">
              <div className="option-icon">💼</div>
              <h5>Licence Commerciale</h5>
              <p>Explorez nos options payantes</p>
            </div>
          </div>
        </div>

        <div className="status-actions">
          <a href="mailto:support@brainos.com" className="contact-button primary">
            📧 Contacter le Support
          </a>
          <button onClick={logout} className="logout-button">
            Se déconnecter
          </button>
        </div>
      </div>
    </div>
  );
};

// Helper function to request approval
const requestApproval = async () => {
  try {
    const response = await fetch('/api/auth/request-approval', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    if (data.success) {
      alert('Demande d\'approbation envoyée avec succès!');
      window.location.reload();
    } else {
      alert('Erreur lors de la demande: ' + data.error);
    }
  } catch (error) {
    console.error('Error requesting approval:', error);
    alert('Erreur de connexion');
  }
};

export default ProtectedRoute;