import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const MainMenu = () => {
  const [lobbyCode, setLobbyCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
    }
  }, [currentUser, navigate]);

  const joinPublicLobby = async () => {
    if (!currentUser || !currentUser.token) {
      setError('Please log in first');
      navigate('/login');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const response = await axios.post('http://localhost:3001/api/game/lobby/public',
        {},
        { headers: { Authorization: `Bearer ${currentUser.token}` }}
      );
      
      navigate(`/lobby/${response.data.id}`);
    } catch (error) {
      console.error('Error joining/creating public lobby:', error);
      if (error.response?.status === 401) {
        setError('Please log in again');
        navigate('/login');
      } else {
        setError('Failed to join public lobby');
      }
    } finally {
      setLoading(false);
    }
  };

  const createPrivateLobby = async () => {
    if (!currentUser || !currentUser.token) {
      setError('Please log in first');
      navigate('/login');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const response = await axios.post('http://localhost:3001/api/game/lobby', 
        { isPrivate: true },
        { headers: { Authorization: `Bearer ${currentUser.token}` }}
      );
      
      const { id, code } = response.data;
      if (code) {
        localStorage.setItem('lastLobbyCode', code);
      }
      
      navigate(`/lobby/${id}`);
    } catch (error) {
      console.error('Error creating private lobby:', error);
      if (error.response?.status === 401) {
        setError('Please log in again');
        navigate('/login');
      } else {
        setError('Failed to create lobby');
      }
    } finally {
      setLoading(false);
    }
  };

  const joinPrivateLobby = async (e) => {
    e.preventDefault();
    if (!currentUser || !currentUser.token) {
      setError('Please log in first');
      navigate('/login');
      return;
    }

    if (!lobbyCode) {
      setError('Please enter a lobby code');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const response = await axios.post('http://localhost:3001/api/game/lobby/join-by-code',
        { code: lobbyCode },
        { headers: { Authorization: `Bearer ${currentUser.token}` }}
      );
      navigate(`/lobby/${response.data.id}`);
    } catch (error) {
      console.error('Error joining private lobby:', error);
      if (error.response?.status === 401) {
        setError('Please log in again');
        navigate('/login');
      } else {
        setError(error.response?.data?.message || 'Invalid lobby code or lobby is full');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!currentUser) {
    return null;
  }

  return (
    <Container>
      <Header>
        <Title>Strikas</Title>
        <Welcome>Welcome, {currentUser.username}!</Welcome>
      </Header>

      <Stats>
        <StatItem>
          <StatLabel>Wins</StatLabel>
          <StatValue>{currentUser.stats?.wins || 0}</StatValue>
        </StatItem>
        <StatItem>
          <StatLabel>Losses</StatLabel>
          <StatValue>{currentUser.stats?.losses || 0}</StatValue>
        </StatItem>
        <StatItem>
          <StatLabel>Games Played</StatLabel>
          <StatValue>{currentUser.stats?.gamesPlayed || 0}</StatValue>
        </StatItem>
      </Stats>

      <ButtonsContainer>
        <Button 
          onClick={joinPublicLobby} 
          disabled={loading}
        >
          {loading ? 'Joining...' : 'Join Public Lobby'}
        </Button>
        <Button 
          onClick={createPrivateLobby}
          disabled={loading}
        >
          {loading ? 'Creating...' : 'Create Private Lobby'}
        </Button>
        <LogoutButton onClick={handleLogout}>Logout</LogoutButton>
      </ButtonsContainer>

      <JoinPrivateContainer onSubmit={joinPrivateLobby}>
        <input
          type="text"
          placeholder="Enter 6-digit lobby code"
          value={lobbyCode}
          onChange={(e) => setLobbyCode(e.target.value.toUpperCase())}
          maxLength={6}
          disabled={loading}
        />
        <Button 
          type="submit"
          disabled={loading}
        >
          {loading ? 'Joining...' : 'Join Private Lobby'}
        </Button>
      </JoinPrivateContainer>

      {error && <ErrorMessage>{error}</ErrorMessage>}
    </Container>
  );
};

const Container = styled.div`
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
  color: #f0f0f0;
`;

const Header = styled.div`
  margin-bottom: 2rem;
`;

const Title = styled.h1`
  font-size: 3rem;
  margin-bottom: 0.5rem;
`;

const Welcome = styled.h2`
  font-size: 1.5rem;
  color: #4a90e2;
  margin: 0;
`;

const Stats = styled.div`
  display: flex;
  justify-content: center;
  gap: 2rem;
  margin-bottom: 2rem;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
`;

const StatItem = styled.div`
  text-align: center;
`;

const StatLabel = styled.div`
  font-size: 0.9rem;
  color: #999;
  margin-bottom: 0.5rem;
`;

const StatValue = styled.div`
  font-size: 2rem;
  font-weight: bold;
  color: #4a90e2;
`;

const ButtonsContainer = styled.div`
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin-bottom: 2rem;
`;

const JoinPrivateContainer = styled.form`
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin-bottom: 2rem;

  input {
    padding: 0.8rem;
    border-radius: 4px;
    border: 1px solid #4a90e2;
    background: rgba(255, 255, 255, 0.1);
    color: white;
    font-size: 1rem;
    width: 200px;

    &::placeholder {
      color: rgba(255, 255, 255, 0.5);
    }

    &:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }
  }
`;

const Button = styled.button`
  background: #4a90e2;
  color: white;
  border: none;
  padding: 0.8rem 1.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  transition: background 0.2s;

  &:hover {
    background: #357abd;
  }

  &:disabled {
    background: #666;
    cursor: not-allowed;
  }
`;

const LogoutButton = styled(Button)`
  background: #ff4444;

  &:hover {
    background: #cc3333;
  }
`;

const ErrorMessage = styled.div`
  color: #ff6b6b;
  margin-bottom: 1rem;
`;

export default MainMenu;
