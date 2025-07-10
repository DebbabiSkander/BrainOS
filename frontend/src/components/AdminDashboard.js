// components/AdminDashboard.js - Updated for new trial system
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './AdminDashboard.css';

const API_BASE_URL = 'http://localhost:5000/api';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, logout, authenticatedFetch, isAdmin } = useAuth();
  
  const [activeTab, setActiveTab] = useState('trial'); // Start with trial users
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user || !isAdmin()) {
      console.log('❌ Not admin, redirecting to login');
      navigate('/login');
      return;
    }
    
    console.log('✅ Admin user detected, loading dashboard');
    fetchStats();
    fetchUsers('trial'); // Start with trial users
  }, [user, navigate, isAdmin]);

  const fetchStats = async () => {
    try {
      console.log('📊 Fetching admin stats...');
      const response = await authenticatedFetch(`${API_BASE_URL}/auth/admin/stats`);
      const data = await response.json();
      
      if (data.success) {
        console.log('✅ Stats loaded:', data.stats);
        setStats(data.stats);
      } else {
        console.error('❌ Failed to load stats:', data.error);
        setError(data.error);
      }
    } catch (error) {
      console.error('❌ Error fetching stats:', error);
      setError('Erreur de chargement des statistiques');
    }
  };

  const fetchUsers = async (status = '') => {
    setLoading(true);
    setError('');
    
    try {
      const url = status 
        ? `${API_BASE_URL}/auth/admin/users?status=${status}` 
        : `${API_BASE_URL}/auth/admin/users`;
      
      console.log(`👥 Fetching users for status: ${status || 'all'}`);
      const response = await authenticatedFetch(url);
      const data = await response.json();
      
      if (data.success) {
        console.log(`✅ Users loaded: ${data.users.length} users`);
        setUsers(data.users);
      } else {
        console.error('❌ Failed to load users:', data.error);
        setError(data.error);
      }
    } catch (error) {
      console.error('❌ Error fetching users:', error);
      setError('Erreur de chargement des utilisateurs');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (tab) => {
    console.log(`📂 Switching to tab: ${tab}`);
    setActiveTab(tab);
    const statusMap = {
      'trial': 'trial',
      'pending': 'pending',
      'approved': 'approved',
      'suspended': 'suspended',
      'all': ''
    };
    fetchUsers(statusMap[tab]);
  };

  const approveUser = async (userId) => {
    try {
      console.log(`✅ Approving user: ${userId}`);
      const response = await authenticatedFetch(
        `${API_BASE_URL}/auth/admin/users/${userId}/approve`,
        { method: 'POST' }
      );
      
      const data = await response.json();
      if (data.success) {
        console.log('✅ User approved successfully');
        fetchUsers(activeTab === 'all' ? '' : activeTab);
        fetchStats();
      } else {
        console.error('❌ Failed to approve user:', data.error);
        setError(data.error);
      }
    } catch (error) {
      console.error('❌ Error approving user:', error);
      setError('Erreur lors de l\'approbation');
    }
  };

  const rejectUser = async (userId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir rejeter cette demande ?')) {
      return;
    }
    
    try {
      console.log(`❌ Rejecting user: ${userId}`);
      const response = await authenticatedFetch(
        `${API_BASE_URL}/auth/admin/users/${userId}/reject`,
        { method: 'POST' }
      );
      
      const data = await response.json();
      if (data.success) {
        console.log('✅ User rejected successfully');
        fetchUsers(activeTab === 'all' ? '' : activeTab);
        fetchStats();
      } else {
        console.error('❌ Failed to reject user:', data.error);
        setError(data.error);
      }
    } catch (error) {
      console.error('❌ Error rejecting user:', error);
      setError('Erreur lors du rejet');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status) => {
    const badges = {
      'trial': { class: 'status-trial', text: 'Essai', icon: '🔥' },
      'pending': { class: 'status-pending', text: 'En attente', icon: '⏳' },
      'approved': { class: 'status-approved', text: 'Approuvé', icon: '✅' },
      'rejected': { class: 'status-rejected', text: 'Rejeté', icon: '❌' },
      'suspended': { class: 'status-suspended', text: 'Suspendu', icon: '🚫' }
    };
    const badge = badges[status] || badges['trial'];
    return (
      <span className={`status-badge ${badge.class}`}>
        {badge.icon} {badge.text}
      </span>
    );
  };

  const getTrialProgress = (user) => {
    if (user.status !== 'trial') return null;
    
    const uploadsUsed = user.trial_uploads_count || 0;
    const uploadsMax = user.trial_max_uploads || 2;
    const daysRemaining = user.days_remaining || 0;
    
    return (
      <div className="trial-progress">
        <div className="progress-item">
          <span className="progress-label">Téléchargements:</span>
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${(uploadsUsed / uploadsMax) * 100}%` }}
            ></div>
          </div>
          <span className="progress-text">{uploadsUsed}/{uploadsMax}</span>
        </div>
        <div className="progress-item">
          <span className="progress-label">Jours restants:</span>
          <span className={`days-remaining ${daysRemaining <= 1 ? 'critical' : daysRemaining <= 3 ? 'warning' : ''}`}>
            {daysRemaining}
          </span>
        </div>
      </div>
    );
  };

  // Show loading if user data is still being fetched
  if (!user) {
    return (
      <div className="loading-container">
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <h3>Chargement...</h3>
          <p>Vérification des permissions administrateur</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <div className="admin-header">
        <div className="admin-title">
          <h1>🛡️ Panneau d'Administration BrainOS</h1>
          <p>Bienvenue, {user.prenom} {user.nom}</p>
        </div>
        <div className="admin-actions">
          <button onClick={() => navigate('/dashboard')} className="nav-button">
            🧠 Accéder à BrainOS
          </button>
          <button onClick={logout} className="logout-button">
            🚪 Déconnexion
          </button>
        </div>
      </div>

      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">👥</div>
            <div className="stat-content">
              <h3>{stats.total_users}</h3>
              <p>Total Médecins</p>
            </div>
          </div>
          <div className="stat-card trial">
            <div className="stat-icon">🔥</div>
            <div className="stat-content">
              <h3>{stats.trial_users}</h3>
              <p>En Essai</p>
            </div>
          </div>
          <div className="stat-card pending">
            <div className="stat-icon">⏳</div>
            <div className="stat-content">
              <h3>{stats.pending_users}</h3>
              <p>En Attente</p>
            </div>
          </div>
          <div className="stat-card approved">
            <div className="stat-icon">✅</div>
            <div className="stat-content">
              <h3>{stats.approved_users}</h3>
              <p>Approuvés</p>
            </div>
          </div>
          <div className="stat-card suspended">
            <div className="stat-icon">🚫</div>
            <div className="stat-content">
              <h3>{stats.suspended_users}</h3>
              <p>Suspendus</p>
            </div>
          </div>
        </div>
      )}

      <div className="admin-content">
        <div className="tab-navigation">
          <button
            className={`tab-button ${activeTab === 'trial' ? 'active' : ''}`}
            onClick={() => handleTabChange('trial')}
          >
            🔥 Essais Actifs ({stats?.trial_users || 0})
          </button>
          <button
            className={`tab-button ${activeTab === 'pending' ? 'active' : ''}`}
            onClick={() => handleTabChange('pending')}
          >
            ⏳ En Attente ({stats?.pending_users || 0})
          </button>
          <button
            className={`tab-button ${activeTab === 'approved' ? 'active' : ''}`}
            onClick={() => handleTabChange('approved')}
          >
            ✅ Approuvés ({stats?.approved_users || 0})
          </button>
          <button
            className={`tab-button ${activeTab === 'suspended' ? 'active' : ''}`}
            onClick={() => handleTabChange('suspended')}
          >
            🚫 Suspendus ({stats?.suspended_users || 0})
          </button>
          <button
            className={`tab-button ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => handleTabChange('all')}
          >
            📋 Tous
          </button>
        </div>

        {error && (
          <div className="error-message">
            ⚠️ {error}
            <button onClick={() => setError('')}>✕</button>
          </div>
        )}

        <div className="users-section">
          {loading ? (
            <div className="loading-section">
              <div className="spinner"></div>
              <p>Chargement des utilisateurs...</p>
            </div>
          ) : (
            <div className="users-table">
              {users.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📭</div>
                  <h3>Aucun utilisateur trouvé</h3>
                  <p>Il n'y a aucun utilisateur dans cette catégorie pour le moment.</p>
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Médecin</th>
                      <th>Spécialité</th>
                      <th>Statut</th>
                      <th>Progression Essai</th>
                      <th>Date d'inscription</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(userItem => (
                      <tr key={userItem.id} className={`user-row ${userItem.status}`}>
                        <td>
                          <div className="user-info">
                            <div className="user-avatar">
                              {userItem.titre === 'Dr.' ? '👨‍⚕️' : '👩‍⚕️'}
                            </div>
                            <div>
                              <strong>{userItem.titre} {userItem.prenom} {userItem.nom}</strong>
                              <br />
                              <small>{userItem.email}</small>
                              <br />
                              <small>{userItem.affiliation}</small>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="specialty-badge">{userItem.specialite}</span>
                        </td>
                        <td>{getStatusBadge(userItem.status)}</td>
                        <td>{getTrialProgress(userItem)}</td>
                        <td>{formatDate(userItem.created_at)}</td>
                        <td>
                          <div className="action-buttons">
                            {(userItem.status === 'pending' || userItem.status === 'trial' || userItem.status === 'suspended') && (
                              <>
                                <button
                                  onClick={() => approveUser(userItem.id)}
                                  className="approve-button"
                                  title="Approuver pour accès illimité"
                                >
                                  ✅ Approuver
                                </button>
                                <button
                                  onClick={() => rejectUser(userItem.id)}
                                  className="reject-button"
                                  title="Rejeter"
                                >
                                  ❌ Rejeter
                                </button>
                              </>
                            )}
                            {userItem.status === 'approved' && (
                              <span className="approved-info">
                                ✅ Accès illimité
                              </span>
                            )}
                            {userItem.status === 'trial' && (
                              <div className="trial-info">
                                <small>
                                  {userItem.uploads_remaining} téléchargements restants
                                  <br />
                                  {userItem.days_remaining} jours restants
                                </small>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>

        {stats && stats.recent_activities && stats.recent_activities.length > 0 && (
          <div className="recent-activities">
            <h3>📊 Activités Récentes</h3>
            <div className="activities-list">
              {stats.recent_activities.map((activity, index) => (
                <div key={index} className="activity-item">
                  <div className="activity-time">{formatDate(activity.timestamp)}</div>
                  <div className="activity-content">
                    <strong>{activity.user_email}</strong> - {activity.action}
                    {activity.details && <span className="activity-details">: {activity.details}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;