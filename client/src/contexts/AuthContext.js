import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          // Verify the token is valid by making a request to the server
          const response = await axios.get('http://localhost:3001/api/auth/verify', {
            headers: { Authorization: `Bearer ${token}` }
          });
          setCurrentUser({ token, ...response.data.user });
        } catch (error) {
          console.error('Token verification failed:', error);
          localStorage.removeItem('token');
        }
      }
      setLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (email, password) => {
    try {
      const response = await axios.post('http://localhost:3001/api/auth/login', {
        email,
        password
      });
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      setCurrentUser({ token, ...user });
      return response.data;
    } catch (error) {
      throw error;
    }
  };

  const register = async (email, password) => {
    try {
      const response = await axios.post('http://localhost:3001/api/auth/register', {
        email,
        password
      });
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      setCurrentUser({ token, ...user });
      return response.data;
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setCurrentUser(null);
  };

  const value = {
    currentUser,
    login,
    register,
    logout,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
