// contexts/AuthContext.js - Fixed version with proper file upload support
import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const API_BASE_URL = 'http://localhost:5000/api';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check for stored authentication on mount
  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');

      console.log('🔍 Checking stored auth:', { 
        hasToken: !!storedToken, 
        hasUser: !!storedUser 
      });

      if (storedToken && storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          
          // Verify token BEFORE setting user and token
          console.log('🔐 Verifying stored token...');
          const response = await fetch(`${API_BASE_URL}/auth/profile`, {
            headers: {
              'Authorization': `Bearer ${storedToken}`,
              'Content-Type': 'application/json'
            }
          });

          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              console.log('✅ Token valid, restoring session:', data.user.email);
              setToken(storedToken);
              setUser(data.user);
              localStorage.setItem('user', JSON.stringify(data.user));
            } else {
              console.log('❌ Token verification failed');
              logout();
            }
          } else {
            console.log('❌ Token verification failed with status:', response.status);
            logout();
          }
        } catch (error) {
          console.error('❌ Error verifying stored token:', error);
          logout();
        }
      } else {
        console.log('ℹ️ No stored authentication found');
      }
      
      setLoading(false);
    };

    initializeAuth();
  }, []);

  const verifyToken = async (authToken) => {
    try {
      console.log('🔐 Verifying token...');
      const response = await fetch(`${API_BASE_URL}/auth/profile`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.log('❌ Token verification failed:', response.status);
        // Token is invalid, logout user
        logout();
      } else {
        const data = await response.json();
        if (data.success) {
          console.log('✅ Token verified, updating user data');
          // Update user data with latest info
          setUser(data.user);
          localStorage.setItem('user', JSON.stringify(data.user));
        }
      }
    } catch (error) {
      console.error('❌ Token verification failed:', error);
      logout();
    }
  };

  const login = (userData, authToken) => {
    console.log('🚀 Logging in user:', userData.email, 'Role:', userData.role);
    setUser(userData);
    setToken(authToken);
    localStorage.setItem('token', authToken);
    localStorage.setItem('user', JSON.stringify(userData));
    
    // Force navigation after successful login
    setTimeout(() => {
      if (userData.role === 'admin') {
        window.location.href = '/admin-dashboard';
      } else {
        window.location.href = '/dashboard';
      }
    }, 100);
  };

  const logout = () => {
    console.log('🚪 Logging out user');
    setUser(null);
    setToken(null);
    
    // Clear ALL localStorage data related to auth
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('authToken');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userStatus');
    
    // Clear sessionStorage as well
    sessionStorage.clear();
    
    // Clear any cookies related to auth
    document.cookie.split(";").forEach(function(c) { 
      document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
    });
    
    // Force redirect to login with cache busting
    window.location.href = '/login?t=' + Date.now();
  };

  const updateUser = (updatedUserData) => {
    console.log('🔄 Updating user data');
    setUser(updatedUserData);
    localStorage.setItem('user', JSON.stringify(updatedUserData));
  };

  const isAuthenticated = () => {
    return !!(user && token);
  };

  const isAdmin = () => {
    return user && user.role === 'admin';
  };

  const isTrialActive = () => {
    return user && user.is_trial_active;
  };

  const getDaysRemaining = () => {
    return user ? user.days_remaining || 0 : 0;
  };

  const getAuthHeaders = (isFileUpload = false) => {
    if (!token) {
      console.warn('⚠️ No token available for auth headers');
      return isFileUpload ? {
        // Don't set Content-Type for file uploads, let browser set it
      } : {
        'Content-Type': 'application/json'
      };
    }
    
    if (isFileUpload) {
      return {
        'Authorization': `Bearer ${token}`
        // Don't set Content-Type for FormData, browser will set it automatically
      };
    } else {
      return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };
    }
  };

  // Enhanced API call function with proper file upload support
  const authenticatedFetch = async (url, options = {}) => {
    // Check if this is a file upload (has FormData in body)
    const isFileUpload = options.body instanceof FormData;
    
    const headers = getAuthHeaders(isFileUpload);
    
    console.log('📡 Making authenticated request to:', url);
    console.log('🔑 Using token:', token ? `${token.substring(0, 20)}...` : 'NO TOKEN');
    console.log('📤 Is file upload:', isFileUpload);
    
    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...options.headers
      }
    });

    // If we get 401, token might be expired
    if (response.status === 401) {
      console.log('❌ 401 Unauthorized - logging out');
      logout();
      throw new Error('Session expired');
    }

    return response;
  };

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    updateUser,
    isAuthenticated,
    isAdmin,
    isTrialActive,
    getDaysRemaining,
    getAuthHeaders,
    authenticatedFetch
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};