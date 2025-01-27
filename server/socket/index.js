const { db } = require('../config/firebase');

const initializeSocketHandlers = (io) => {
  const gameStates = new Map();
  
  io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    // Join lobby room
    socket.on('joinLobby', async ({ lobbyId, userId }) => {
      try {
        socket.join(lobbyId);
        socket.to(lobbyId).emit('playerJoined', { userId });
      } catch (error) {
        console.error('Join lobby error:', error);
      }
    });

    // Player ready
    socket.on('playerReady', ({ lobbyId, userId }) => {
      socket.to(lobbyId).emit('opponentReady', { userId });
    });

    // Game actions
    socket.on('gameAction', ({ lobbyId, action, position }) => {
      const gameState = gameStates.get(lobbyId) || {
        turn: 0,
        positions: [],
        score: { player1: 0, player2: 0 }
      };

      // Update game state based on action
      // This is where you'll implement the game physics logic
      
      gameStates.set(lobbyId, gameState);
      socket.to(lobbyId).emit('gameUpdate', gameState);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });
};

module.exports = { initializeSocketHandlers };
