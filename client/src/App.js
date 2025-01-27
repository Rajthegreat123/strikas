import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import MainMenu from './pages/MainMenu';
import Game from './pages/Game';
import Lobby from './pages/Lobby';

const PrivateRoute = ({ children }) => {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  return currentUser ? children : <Navigate to="/login" />;
};

const PublicRoute = ({ children }) => {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  return !currentUser ? children : <Navigate to="/" />;
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          } />
          <Route path="/register" element={
            <PublicRoute>
              <Register />
            </PublicRoute>
          } />
          <Route path="/" element={
            <PrivateRoute>
              <MainMenu />
            </PrivateRoute>
          } />
          <Route path="/lobby/:id" element={
            <PrivateRoute>
              <Lobby />
            </PrivateRoute>
          } />
          <Route path="/game/:id" element={
            <PrivateRoute>
              <Game />
            </PrivateRoute>
          } />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
