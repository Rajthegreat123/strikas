const { db } = require('../config/firebase');

function setupLobbyHandlers(io) {
  io.on('connection', (socket) => {
    console.log('User connected:', socket.user?.id);

    socket.on('join_lobby', async ({ lobbyId }) => {
      try {
        const lobbyDoc = await db.collection('lobbies').doc(lobbyId).get();
        
        if (!lobbyDoc.exists) {
          socket.emit('lobby_error', { message: 'Lobby not found' });
          return;
        }

        const lobby = {
          id: lobbyDoc.id,
          ...lobbyDoc.data()
        };

        // Join the socket room for this lobby
        socket.join(`lobby_${lobbyId}`);
        
        // Send initial lobby data to the client
        socket.emit('lobby_data', lobby);

        // Notify other players in the lobby
        socket.to(`lobby_${lobbyId}`).emit('player_joined', {
          playerId: socket.user.id,
          email: socket.user.email
        });

      } catch (error) {
        console.error('Error joining lobby:', error);
        socket.emit('lobby_error', { message: 'Failed to join lobby' });
      }
    });

    socket.on('leave_lobby', async ({ lobbyId }) => {
      try {
        const lobbyDoc = await db.collection('lobbies').doc(lobbyId).get();
        
        if (!lobbyDoc.exists) {
          return;
        }

        const lobby = lobbyDoc.data();
        
        // Remove player from lobby
        const updatedPlayers = lobby.players.filter(
          player => player.id !== socket.user.id
        );

        // If lobby is empty, delete it
        if (updatedPlayers.length === 0) {
          await lobbyDoc.ref.delete();
        } else {
          // If host left, make the other player host
          const newHostId = updatedPlayers[0].id;
          await lobbyDoc.ref.update({
            players: updatedPlayers,
            hostId: newHostId,
            status: 'waiting'
          });

          // Notify remaining players
          io.to(`lobby_${lobbyId}`).emit('lobby_data', {
            id: lobbyId,
            ...lobby,
            players: updatedPlayers,
            hostId: newHostId,
            status: 'waiting'
          });
        }

        // Leave the socket room
        socket.leave(`lobby_${lobbyId}`);

      } catch (error) {
        console.error('Error leaving lobby:', error);
      }
    });

    socket.on('start_game', async ({ lobbyId }) => {
      try {
        const lobbyDoc = await db.collection('lobbies').doc(lobbyId).get();
        
        if (!lobbyDoc.exists) {
          socket.emit('lobby_error', { message: 'Lobby not found' });
          return;
        }

        const lobby = lobbyDoc.data();

        // Verify sender is host and lobby is full
        if (lobby.hostId !== socket.user.id || lobby.players.length !== 2) {
          return;
        }

        // Create game document
        const gameRef = await db.collection('games').add({
          players: lobby.players,
          status: 'active',
          createdAt: new Date(),
          lobbyId: lobbyId
        });

        // Update lobby status
        await lobbyDoc.ref.update({
          status: 'in_game',
          gameId: gameRef.id
        });

        // Notify all players to start the game
        io.to(`lobby_${lobbyId}`).emit('game_started', gameRef.id);

      } catch (error) {
        console.error('Error starting game:', error);
        socket.emit('lobby_error', { message: 'Failed to start game' });
      }
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.user?.id);
    });
  });
}

module.exports = { setupLobbyHandlers };
