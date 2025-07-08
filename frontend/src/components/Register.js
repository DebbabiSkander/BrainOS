// components/Register.js - Doctor Registration Component (COMPLETE FIXED VERSION)
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Auth.css';

const API_BASE_URL = 'http://localhost:5000/api';

const Register = () => {
  const navigate = useNavigate();
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
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const titles = ['Dr.', 'Prof.', 'Dr. Prof.', 'M.', 'Mme'];
  const specialties = [
    'Neurologie',
    'Neurochirurgie',
    'Radiologie',
    'Imagerie médicale',
    'Médecine interne',
    'Psychiatrie',
    'Pédiatrie',
    'Gériatrie',
    'Médecine d\'urgence',
    'Autre'
  ];

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const validateForm = () => {
    if (formData.password !== formData.confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return false;
    }
    if (formData.password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères');
      return false;
    }
    if (!formData.telephone.match(/^[+]?[0-9\s\-()]{8,15}$/)) {
      setError('Numéro de téléphone invalide');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          nom: formData.nom,
          prenom: formData.prenom,
          titre: formData.titre,
          specialite: formData.specialite,
          telephone: formData.telephone,
          affiliation: formData.affiliation
        })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(true);
      } else {
        setError(data.error || 'Erreur lors de la création du compte');
      }
    } catch (error) {
      console.error('Registration error:', error);
      setError('Erreur de connexion au serveur');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="auth-container">
        <div className="auth-card success-card">
          <div className="success-content">
            <div className="success-icon">✅</div>
            <h2>Compte créé avec succès !</h2>
            <p>
              Votre demande d'inscription a été soumise. Un administrateur
              va examiner votre demande et vous recevrez un email de confirmation
              une fois votre compte approuvé.
            </p>
            <button
              onClick={() => navigate('/login')}
              className="auth-button"
            >
              <span className="button-icon">🚀</span>
              Aller à la connexion
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container" style={{ minHeight: '100vh', padding: '20px 20px 50px' }}>
      <div className="auth-card register-card" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="auth-header">
          <div className="logo-section">
            <div className="logo-icon">🧠</div>
            <h1>BrainOS</h1>
            <p>Créer votre compte médecin</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="auth-form register-form">
          <h2>Inscription</h2>
          
          {error && (
            <div className="error-message">
              <span className="error-icon">⚠️</span>
              {error}
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="prenom">
                <span className="label-icon">👤</span>
                Prénom *
              </label>
              <input
                type="text"
                id="prenom"
                name="prenom"
                value={formData.prenom}
                onChange={handleChange}
                required
                className="auth-input"
                placeholder="Prénom"
              />
            </div>

            <div className="form-group">
              <label htmlFor="nom">
                <span className="label-icon">👤</span>
                Nom *
              </label>
              <input
                type="text"
                id="nom"
                name="nom"
                value={formData.nom}
                onChange={handleChange}
                required
                className="auth-input"
                placeholder="Nom de famille"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="titre">
                <span className="label-icon">🎓</span>
                Titre *
              </label>
              <select
                id="titre"
                name="titre"
                value={formData.titre}
                onChange={handleChange}
                required
                className="auth-select"
              >
                {titles.map(title => (
                  <option key={title} value={title}>{title}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="specialite">
                <span className="label-icon">🏥</span>
                Spécialité *
              </label>
              <select
                id="specialite"
                name="specialite"
                value={formData.specialite}
                onChange={handleChange}
                required
                className="auth-select"
              >
                <option value="">Sélectionner...</option>
                {specialties.map(specialty => (
                  <option key={specialty} value={specialty}>{specialty}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="email">
              <span className="label-icon">📧</span>
              Adresse email professionnelle *
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="auth-input"
              placeholder="votre.nom@hopital.com"
            />
          </div>

          <div className="form-group">
            <label htmlFor="telephone">
              <span className="label-icon">📞</span>
              Téléphone *
            </label>
            <input
              type="tel"
              id="telephone"
              name="telephone"
              value={formData.telephone}
              onChange={handleChange}
              required
              className="auth-input"
              placeholder="+216 XX XXX XXX"
            />
          </div>

          <div className="form-group">
            <label htmlFor="affiliation">
              <span className="label-icon">🏢</span>
              Affiliation (Hôpital/Clinique) *
            </label>
            <input
              type="text"
              id="affiliation"
              name="affiliation"
              value={formData.affiliation}
              onChange={handleChange}
              required
              className="auth-input"
              placeholder="Nom de votre établissement"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">
              <span className="label-icon">🔒</span>
              Mot de passe *
            </label>
            <div className="password-input-container">
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                className="auth-input"
                placeholder="Au moins 8 caractères"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">
              <span className="label-icon">🔒</span>
              Confirmer le mot de passe *
            </label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              className="auth-input"
              placeholder="Répéter le mot de passe"
            />
          </div>

          <div className="terms-notice">
            <p>
              En créant un compte, vous acceptez notre politique de confidentialité
              et nos conditions d'utilisation pour les professionnels de santé.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`auth-button ${loading ? 'loading' : ''}`}
          >
            {loading ? (
              <>
                <div className="spinner"></div>
                Création du compte...
              </>
            ) : (
              <>
                <span className="button-icon">📝</span>
                Créer mon compte
              </>
            )}
          </button>

          <div className="auth-footer">
            <p>
              Déjà un compte ? 
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="link-button"
              >
                Se connecter
              </button>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Register;