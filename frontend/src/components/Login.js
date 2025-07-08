// components/Login.js - Updated to work properly with AuthContext
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Auth.css';

const API_BASE_URL = 'http://localhost:5000/api';

const Login = ({ onLogin }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Check if onLogin is provided
    if (!onLogin) {
      console.error('❌ onLogin prop is missing!');
      setError('Erreur système: fonction de connexion manquante');
      return;
    }

    setLoading(true);
    setError('');

    try {
      console.log('🔐 Attempting login for:', formData.email);
      
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (data.success) {
        console.log('✅ Login successful:', data.user.email, 'Role:', data.user.role);
        
        // Let AuthContext handle the storage and state management
        // Remove manual localStorage operations to avoid conflicts
        onLogin(data.user, data.access_token);
        
        // Navigation will be handled by the routing logic in App.js
        // Don't manually navigate here, let the AuthContext update trigger it
        console.log('🚀 Login completed, context should handle navigation');
        
      } else {
        console.log('❌ Login failed:', data.error);
        setError(data.error || 'Erreur de connexion');
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('Erreur de connexion au serveur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="logo-section">
            <div className="logo-icon">🧠</div>
            <h1>BrainOS</h1>
            <p>Système d'analyse médicale avancée</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <h2>Connexion</h2>
          
          {error && (
            <div className="error-message">
              <span className="error-icon">⚠️</span>
              {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">
              <span className="label-icon">📧</span>
              Adresse email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="votre@email.com"
              className="auth-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">
              <span className="label-icon">🔒</span>
              Mot de passe
            </label>
            <div className="password-input-container">
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                placeholder="Votre mot de passe"
                className="auth-input"
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

          <button
            type="submit"
            disabled={loading}
            className={`auth-button ${loading ? 'loading' : ''}`}
          >
            {loading ? (
              <>
                <div className="spinner"></div>
                Connexion...
              </>
            ) : (
              <>
                <span className="button-icon">🚀</span>
                Se connecter
              </>
            )}
          </button>

          <div className="auth-footer">
            <p>
              Pas encore de compte ? 
              <button
                type="button"
                onClick={() => navigate('/register')}
                className="link-button"
              >
                Créer un compte
              </button>
            </p>
            
            {/* Debug info - remove in production */}
            <div style={{ 
              marginTop: '20px', 
              padding: '10px', 
              background: '#f8f9fa', 
              borderRadius: '5px',
              fontSize: '12px',
              color: '#666'
            }}>
              <strong>Comptes de test :</strong><br/>
              Admin: admin@brainos.com / admin123<br/>
              onLogin prop: {onLogin ? '✅ Disponible' : '❌ Manquant'}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;