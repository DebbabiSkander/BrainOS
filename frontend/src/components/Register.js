// components/Register.js - Updated for immediate trial access
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Auth.css';

const API_BASE_URL = 'http://localhost:5000/api';

const Register = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    nom: '',
    prenom: '',
    titre: 'Dr.',
    specialite: '',
    telephone: '',
    affiliation: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  const specialites = [
    'Neurologie',
    'Neurochirurgie',
    'Radiologie',
    'Neuroradiologie',
    'Médecine Nucléaire',
    'Psychiatrie',
    'Neuropsychologie',
    'Anatomie Pathologique',
    'Médecine Interne',
    'Autre'
  ];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateForm = () => {
    if (!formData.email || !formData.password || !formData.nom || !formData.prenom || 
        !formData.specialite || !formData.telephone || !formData.affiliation) {
      setError('Tous les champs sont requis');
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return false;
    }

    if (formData.password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Format d\'email invalide');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      console.log('📝 Submitting registration for:', formData.email);
      
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          nom: formData.nom,
          prenom: formData.prenom,
          titre: formData.titre,
          specialite: formData.specialite,
          telephone: formData.telephone,
          affiliation: formData.affiliation
        }),
      });

      const data = await response.json();

      if (data.success) {
        console.log('✅ Registration successful with immediate trial access');
        setShowSuccess(true);
        
        // Automatically log in the user
        setTimeout(() => {
          login(data.user, data.access_token);
        }, 2000);
        
      } else {
        console.error('❌ Registration failed:', data.error);
        setError(data.error || 'Erreur lors de la création du compte');
      }
    } catch (error) {
      console.error('❌ Registration error:', error);
      setError('Erreur de connexion. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  if (showSuccess) {
    return (
      <div className="auth-container">
        <div className="auth-card success-card">
          <div className="auth-header">
            <div className="logo-section">
              <div className="logo-icon">🧠</div>
              <h1>BrainOS</h1>
              <p>Analyse d'imagerie médicale</p>
            </div>
          </div>
          
          <div className="success-content">
            <div className="success-icon">🎉</div>
            <h2>Compte créé avec succès!</h2>
            <p>
              Félicitations! Votre compte a été créé et vous avez immédiatement accès 
              à BrainOS pour une période d'essai de 7 jours.
            </p>
            
            <div className="trial-welcome-info">
              <h3>🔥 Votre période d'essai</h3>
              <div className="trial-features">
                <div className="trial-feature">
                  <span className="feature-icon">📅</span>
                  <div>
                    <strong>7 jours d'accès</strong>
                    <p>Utilisez toutes les fonctionnalités de BrainOS</p>
                  </div>
                </div>
                <div className="trial-feature">
                  <span className="feature-icon">📤</span>
                  <div>
                    <strong>2 téléchargements maximum</strong>
                    <p>Analysez jusqu'à 2 fichiers NIFTI</p>
                  </div>
                </div>
                <div className="trial-feature">
                  <span className="feature-icon">✅</span>
                  <div>
                    <strong>Approbation pour accès illimité</strong>
                    <p>Demandez l'approbation pour continuer</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="next-steps">
              <h4>Prochaines étapes :</h4>
              <ol>
                <li>Vous allez être redirigé vers BrainOS</li>
                <li>Commencez par télécharger votre premier fichier NIFTI</li>
                <li>Explorez les outils de visualisation et d'analyse</li>
                <li>Avant la fin de l'essai, demandez l'approbation admin</li>
              </ol>
            </div>
            
            <p className="redirect-message">
              Redirection automatique en cours...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card register-card">
        <div className="auth-header">
          <div className="logo-section">
            <div className="logo-icon">🧠</div>
            <h1>BrainOS</h1>
            <p>Plateforme d'analyse d'imagerie cérébrale</p>
          </div>
        </div>

        <form className="register-form" onSubmit={handleSubmit}>
          <h2>Créer un compte médecin</h2>
          
          <div className="trial-info-banner">
            <div className="banner-content">
              <span className="banner-icon">🚀</span>
              <div>
                <strong>Accès immédiat à l'essai gratuit!</strong>
                <p>7 jours d'accès complet + 2 téléchargements inclus</p>
              </div>
            </div>
          </div>

          {error && (
            <div className="error-message">
              <span className="error-icon">⚠️</span>
              {error}
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label>
                <span className="label-icon">👤</span>
                Prénom *
              </label>
              <input
                type="text"
                name="prenom"
                value={formData.prenom}
                onChange={handleInputChange}
                className="auth-input"
                placeholder="Votre prénom"
                required
              />
            </div>
            <div className="form-group">
              <label>
                <span className="label-icon">👤</span>
                Nom *
              </label>
              <input
                type="text"
                name="nom"
                value={formData.nom}
                onChange={handleInputChange}
                className="auth-input"
                placeholder="Votre nom"
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>
                <span className="label-icon">🎓</span>
                Titre *
              </label>
              <select
                name="titre"
                value={formData.titre}
                onChange={handleInputChange}
                className="auth-select"
                required
              >
                <option value="Dr.">Dr.</option>
                <option value="Prof.">Prof.</option>
                <option value="Pr.">Pr.</option>
              </select>
            </div>
            <div className="form-group">
              <label>
                <span className="label-icon">🏥</span>
                Spécialité *
              </label>
              <select
                name="specialite"
                value={formData.specialite}
                onChange={handleInputChange}
                className="auth-select"
                required
              >
                <option value="">Choisir une spécialité</option>
                {specialites.map(spec => (
                  <option key={spec} value={spec}>{spec}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>
              <span className="label-icon">📧</span>
              Email professionnel *
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              className="auth-input"
              placeholder="votre.email@hopital.fr"
              required
            />
          </div>

          <div className="form-group">
            <label>
              <span className="label-icon">📞</span>
              Téléphone *
            </label>
            <input
              type="tel"
              name="telephone"
              value={formData.telephone}
              onChange={handleInputChange}
              className="auth-input"
              placeholder="+216 XX XXX XXX"
              required
            />
          </div>

          <div className="form-group">
            <label>
              <span className="label-icon">🏢</span>
              Affiliation (Hôpital/Clinique) *
            </label>
            <input
              type="text"
              name="affiliation"
              value={formData.affiliation}
              onChange={handleInputChange}
              className="auth-input"
              placeholder="Nom de votre établissement"
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>
                <span className="label-icon">🔒</span>
                Mot de passe *
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className="auth-input"
                placeholder="Minimum 8 caractères"
                required
              />
            </div>
            <div className="form-group">
              <label>
                <span className="label-icon">🔒</span>
                Confirmer le mot de passe *
              </label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                className="auth-input"
                placeholder="Confirmer le mot de passe"
                required
              />
            </div>
          </div>

          <div className="terms-notice">
            <p>
              <strong>🔥 Nouveau système d'essai :</strong><br/>
              • Accès immédiat pour 7 jours<br/>
              • Maximum 2 téléchargements pendant l'essai<br/>
              • Demande d'approbation admin pour accès illimité<br/>
              • Une fois approuvé : utilisation sans limite
            </p>
          </div>

          <button
            type="submit"
            className="auth-button"
            disabled={loading}
          >
            {loading ? (
              <>
                <div className="spinner"></div>
                Création en cours...
              </>
            ) : (
              <>
                <span className="button-icon">🚀</span>
                Créer mon compte et commencer l'essai
              </>
            )}
          </button>

          <div className="auth-footer">
            Vous avez déjà un compte ?{' '}
            <button
              type="button"
              className="link-button"
              onClick={() => navigate('/login')}
            >
              Se connecter
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Register;