// components/ProtectedRoute.js - Route Protection Component
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = ({ children, requireAdmin = false, requireTrial = false }) => {
  const { user, loading, isAuthenticated, isAdmin, isTrialActive } = useAuth();
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

  // Check trial requirement for doctors
  if (requireTrial && user.role === 'doctor' && !isTrialActive()) {
    return <TrialExpiredComponent />;
  }

  // Check if account is pending approval
  if (user.status === 'pending') {
    return <PendingApprovalComponent />;
  }

  // Check if account was rejected
  if (user.status === 'rejected') {
    return <AccountRejectedComponent />;
  }

  return children;
};

// Component for pending approval
const PendingApprovalComponent = () => {
  const { logout } = useAuth();

  return (
    <div className="status-container">
      <div className="status-card pending">
        <div className="status-icon">⏳</div>
        <h2>Compte en attente d'approbation</h2>
        <p>
          Votre demande d'inscription a été soumise avec succès. 
          Un administrateur va examiner votre demande et vous recevrez 
          un email de confirmation une fois votre compte approuvé.
        </p>
        <div className="status-details">
          <h4>Prochaines étapes :</h4>
          <ul>
            <li>✅ Inscription soumise</li>
            <li>⏳ En attente de validation administrative</li>
            <li>📧 Notification par email une fois approuvé</li>
            <li>🚀 Accès à votre période d'essai de 7 jours</li>
          </ul>
        </div>
        <button onClick={logout} className="logout-button">
          Se déconnecter
        </button>
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
        <h2>Demande d'inscription rejetée</h2>
        <p>
          Nous regrettons de vous informer que votre demande d'inscription 
          n'a pas été approuvée. Cela peut être dû à des informations 
          incomplètes ou à des critères d'éligibilité non remplis.
        </p>
        <div className="status-details">
          <h4>Pour faire appel à cette décision :</h4>
          <ul>
            <li>📧 Contactez notre équipe support</li>
            <li>📋 Fournissez des informations supplémentaires</li>
            <li>🔄 Soumettez une nouvelle demande avec des données mises à jour</li>
          </ul>
        </div>
        <div className="status-actions">
          <button onClick={logout} className="logout-button">
            Se déconnecter
          </button>
          <a href="mailto:support@brainos.com" className="contact-button">
            Contacter le Support
          </a>
        </div>
      </div>
    </div>
  );
};

// Component for expired trial
const TrialExpiredComponent = () => {
  const { user, logout } = useAuth();

  return (
    <div className="status-container">
      <div className="status-card expired">
        <div className="status-icon">⏰</div>
        <h2>Période d'essai expirée</h2>
        <p>
          Votre période d'essai de 7 jours a expiré le{' '}
          {user.trial_ends_at ? new Date(user.trial_ends_at).toLocaleDateString('fr-FR') : 'récemment'}.
          Pour continuer à utiliser BrainOS, veuillez contacter notre équipe commerciale.
        </p>
        <div className="status-details">
          <h4>Options disponibles :</h4>
          <ul>
            <li>💼 Licence institutionnelle</li>
            <li>👤 Licence individuelle</li>
            <li>🎓 Tarifs préférentiels pour la recherche</li>
            <li>📞 Démonstration personnalisée</li>
          </ul>
        </div>
        <div className="trial-stats">
          <h4>Votre utilisation pendant l'essai :</h4>
          <div className="trial-info">
            <span>📊 Analyses effectuées : En cours de calcul</span>
            <span>🧠 Fichiers traités : En cours de calcul</span>
            <span>⏱️ Temps d'utilisation : {user.days_remaining || 0}/7 jours</span>
          </div>
        </div>
        <div className="status-actions">
          <a href="mailto:commercial@brainos.com" className="contact-button primary">
            📧 Contacter Commercial
          </a>
          <a href="tel:+21612345678" className="contact-button">
            📞 Appeler (+216 12 345 678)
          </a>
          <button onClick={logout} className="logout-button">
            Se déconnecter
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProtectedRoute;

// Add these styles to your main CSS or create a StatusPages.css file
/*

*/