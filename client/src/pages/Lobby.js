import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useAuth } from '../contexts/AuthContext';
import io from 'socket.io-client';
import axios from 'axios';

const Lobby = () => {
  const { id: lobbyId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [socket, setSocket] = useState(null);
  const [lobby, setLobby] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // Fetch initial lobby data
  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    const fetchLobby = async () => {
      try {
        const response = await axios.get(`http://localhost:3001/api/game/lobby/${lobbyId}`, {
          headers: { Authorization: `Bearer ${currentUser.token}` }
        });
        setLobby(response.data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching lobby:', error);
        setError('Failed to load lobby');
        setLoading(false);
      }
    };

    fetchLobby();
  }, [lobbyId, currentUser, navigate]);

  // Setup socket connection
  useEffect(() => {
    if (!currentUser || !lobby) return;

    console.log('Setting up socket connection...');
    const newSocket = io('http://localhost:3001', {
      auth: {
        token: currentUser.token
      }
    });

    newSocket.on('connect', () => {
      console.log('Socket connected, joining lobby:', lobbyId);
      newSocket.emit('join-lobby', { lobbyId });
    });

    newSocket.on('lobby-updated', (updatedLobby) => {
      console.log('Received lobby update:', updatedLobby);
      setLobby(updatedLobby);
    });

    newSocket.on('game-started', ({ gameId }) => {
      console.log('Game started, navigating to game:', gameId);
      navigate(`/game/${gameId}`);
      window.location.reload();
    });

    newSocket.on('error', (error) => {
      console.error('Socket error:', error);
      setError(error.message);
    });

    newSocket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    setSocket(newSocket);

    // Cleanup function
    return () => {
      console.log('Cleaning up socket connection');
      if (newSocket.connected) {
        newSocket.emit('leave-lobby', { lobbyId });
        newSocket.disconnect();
      }
    };
  }, [currentUser, lobby?.id, lobbyId, navigate]);

  const startGame = () => {
    if (!socket || !lobby) return;
    console.log('Starting game for lobby:', lobbyId);
    socket.emit('start-game', { lobbyId });
  };

  const leaveLobby = () => {
    navigate('/');
  };

  if (loading) {
    return (
      <Container>
        <LoadingMessage>Loading lobby...</LoadingMessage>
      </Container>
    );
  }

  if (error) {
    return (
      <Container>
        <ErrorMessage>{error}</ErrorMessage>
        <LeaveButton onClick={leaveLobby}>Back to Menu</LeaveButton>
      </Container>
    );
  }

  if (!lobby || !lobby.host) {
    return (
      <Container>
        <ErrorMessage>Lobby not found</ErrorMessage>
        <LeaveButton onClick={leaveLobby}>Back to Menu</LeaveButton>
      </Container>
    );
  }

  const isHost = lobby.host.id === currentUser.id;

  return (
    <Container>
      <Header>
        <Title>Lobby</Title>
        {lobby.isPrivate && (
          <LobbyCode>
            Lobby Code: <span>{lobby.code}</span>
          </LobbyCode>
        )}
      </Header>

      <PlayersContainer>
        <PlayerList>
          <PlayerItem>
            <PlayerName isHost={true}>
              {lobby.host.username}
              <HostBadge>Host</HostBadge>
            </PlayerName>
          </PlayerItem>
          {lobby.guest && (
            <PlayerItem>
              <PlayerName>{lobby.guest.username}</PlayerName>
            </PlayerItem>
          )}
          {!lobby.guest && (
            <PlayerItem>
              <WaitingMessage>Waiting for player...</WaitingMessage>
            </PlayerItem>
          )}
        </PlayerList>
      </PlayersContainer>

      <ButtonsContainer>
        {isHost && lobby.guest && (
          <StartButton onClick={startGame}>
            Start Game
          </StartButton>
        )}
        <LeaveButton onClick={leaveLobby}>
          Leave Lobby
        </LeaveButton>
      </ButtonsContainer>

      {error && (
        <ErrorMessage>{error}</ErrorMessage>
      )}
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
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
`;

const Title = styled.h1`
  font-size: 2.5rem;
  margin-bottom: 2rem;
`;

const LobbyCode = styled.div`
  font-size: 1.5rem;
  margin-bottom: 2rem;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
`;

const PlayersContainer = styled.div`
  margin: 2rem 0;
`;

const PlayerList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
`;

const PlayerItem = styled.li`
  padding: 1rem;
  margin: 0.5rem 0;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const PlayerName = styled.span`
  font-size: 1.2rem;
  font-weight: bold;
  color: #4a90e2;
  margin-right: 1rem;
`;

const HostBadge = styled.span`
  font-size: 1rem;
  font-weight: bold;
  color: #ff6b6b;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.1);
`;

const WaitingMessage = styled.div`
  color: #999;
  font-style: italic;
`;

const ButtonsContainer = styled.div`
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin-top: 2rem;
`;

const StartButton = styled.button`
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
`;

const LeaveButton = styled.button`
  background: #ff6b6b;
  color: white;
  border: none;
  padding: 0.8rem 1.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  transition: background 0.2s;

  &:hover {
    background: #e74c3c;
  }
`;

const LoadingMessage = styled.div`
  font-size: 1.5rem;
  margin: 2rem 0;
`;

const ErrorMessage = styled.div`
  color: #ff6b6b;
  font-size: 1.2rem;
  margin: 2rem 0;
`;

export default Lobby;
