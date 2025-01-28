require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const { db } = require('./config/firebase');
const authRoutes = require('./routes/auth');
const gameRoutes = require('./routes/game');

const app = express();
const server = http.createServer(app);

// Socket.io setup with CORS
const io = socketIO(server, {
  cors: {
    origin: "https://strikas.onrender.com",
    methods: ["GET", "POST"]
  }
});

// Make io accessible to routes
app.set('io', io);

// Middleware
app.use(cors());
app.use(express.json());

// Socket authentication middleware
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

// Socket connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.userId);

  socket.on('join-lobby', async ({ lobbyId }) => {
    try {
      console.log(`User ${socket.userId} joining lobby ${lobbyId}`);
      socket.join(`lobby_${lobbyId}`);
      
      const lobbyDoc = await db.collection('lobbies').doc(lobbyId).get();
      if (!lobbyDoc.exists) {
        socket.emit('error', { message: 'Lobby not found' });
        return;
      }

      const lobbyData = {
        id: lobbyDoc.id,
        ...lobbyDoc.data()
      };

      // Send lobby data to all clients in the room
      io.to(`lobby_${lobbyId}`).emit('lobby-updated', lobbyData);
      console.log(`User ${socket.userId} joined lobby ${lobbyId}`);
    } catch (error) {
      console.error('Error in join-lobby handler:', error);
      socket.emit('error', { message: 'Failed to join lobby' });
    }
  });

  socket.on('start-game', async ({ lobbyId }) => {
    try {
      console.log(`User ${socket.userId} starting game for lobby ${lobbyId}`);
      
      // Get the lobby data
      const lobbyDoc = await db.collection('lobbies').doc(lobbyId).get();
      if (!lobbyDoc.exists) {
        socket.emit('error', { message: 'Lobby not found' });
        return;
      }

      const lobbyData = lobbyDoc.data();
      
      // Check if user is the host
      if (lobbyData.host.id !== socket.userId) {
        socket.emit('error', { message: 'Only the host can start the game' });
        return;
      }

      // Check if we have two players
      if (!lobbyData.guest) {
        socket.emit('error', { message: 'Cannot start game without two players' });
        return;
      }

      // Create a new game document
      const gameData = {
        lobbyId,
        status: 'in_progress',
        players: {
          host: lobbyData.host,
          guest: lobbyData.guest
        },
        score: {
          host: 0,
          guest: 0
        },
        startedAt: new Date(),
        lastUpdated: new Date()
      };

      const gameDoc = await db.collection('games').add(gameData);
      
      // Update lobby status
      await lobbyDoc.ref.update({
        status: 'in_game',
        gameId: gameDoc.id
      });

      // Notify all players to start the game
      io.to(`lobby_${lobbyId}`).emit('game-started', { 
        gameId: gameDoc.id,
        ...gameData
      });
      
      console.log(`Game started for lobby ${lobbyId}, game ID: ${gameDoc.id}`);
    } catch (error) {
      console.error('Error starting game:', error);
      socket.emit('error', { message: 'Failed to start game' });
    }
  });

  socket.on('leave-lobby', async ({ lobbyId }) => {
    try {
      console.log(`User ${socket.userId} leaving lobby ${lobbyId}`);
      socket.leave(`lobby_${lobbyId}`);
      
      const lobbyDoc = await db.collection('lobbies').doc(lobbyId).get();
      if (!lobbyDoc.exists) return;

      const lobbyData = lobbyDoc.data();
      
      // If the leaving user was the guest, update the lobby
      if (lobbyData.guest && lobbyData.guest.id === socket.userId) {
        await lobbyDoc.ref.update({
          guest: null,
          playerCount: 1
        });
        
        // Get updated lobby data
        const updatedLobby = await lobbyDoc.ref.get();
        const updatedLobbyData = {
          id: updatedLobby.id,
          ...updatedLobby.data()
        };
        
        // Notify remaining players
        io.to(`lobby_${lobbyId}`).emit('lobby-updated', updatedLobbyData);
      }
    } catch (error) {
      console.error('Error in leave-lobby handler:', error);
    }
  });

  socket.on('join-game', async ({ gameId }) => {
    try {
      console.log(`User ${socket.userId} joining game ${gameId}`);
      
      // Get the game data
      const gameDoc = await db.collection('games').doc(gameId).get();
      if (!gameDoc.exists) {
        socket.emit('error', { message: 'Game not found' });
        return;
      }

      const gameData = {
        id: gameDoc.id,
        ...gameDoc.data()
      };

      // Join the game room
      socket.join(`game_${gameId}`);
      console.log(`User ${socket.userId} joined game room: game_${gameId}`);

      // Store game ID in socket for cleanup
      socket.gameId = gameId;

      // Send initial game state
      socket.emit('game-state', gameData);
    } catch (error) {
      console.error('Error in join-game handler:', error);
      socket.emit('error', { message: 'Failed to join game' });
    }
  });

  socket.on('player-update', ({ gameId, position, velocity }) => {
    try {
      // Validate the game room
      if (!socket.rooms.has(`game_${gameId}`)) {
        console.log(`User ${socket.userId} not in game room ${gameId}`);
        return;
      }

      // Broadcast player position to all other clients in the game room
      socket.to(`game_${gameId}`).emit('player-moved', {
        playerId: socket.userId,
        position,
        velocity
      });
    } catch (error) {
      console.error('Error in player-update handler:', error);
    }
  });

  socket.on('ball-update', ({ gameId, position, velocity }) => {
    try {
      // Validate the game room
      if (!socket.rooms.has(`game_${gameId}`)) {
        console.log(`User ${socket.userId} not in game room ${gameId}`);
        return;
      }

      // Broadcast ball position to all other clients in the game room
      socket.to(`game_${gameId}`).emit('ball-update', {
        position,
        velocity
      });
    } catch (error) {
      console.error('Error in ball-update handler:', error);
    }
  });

  socket.on('goal-scored', async ({ gameId, scorer }) => {
    try {
      // Validate the game room
      if (!socket.rooms.has(`game_${gameId}`)) {
        console.log(`User ${socket.userId} not in game room ${gameId}`);
        return;
      }

      console.log(`Goal scored in game ${gameId} by ${scorer}`);
      
      const gameDoc = await db.collection('games').doc(gameId).get();
      if (!gameDoc.exists) {
        console.log(`Game ${gameId} not found`);
        return;
      }

      const gameData = gameDoc.data();
      const newScore = {
        host: gameData.score.host + (scorer === 'host' ? 1 : 0),
        guest: gameData.score.guest + (scorer === 'guest' ? 1 : 0)
      };

      // Check if game is over (first to 5 goals)
      const isGameOver = newScore.host >= 5 || newScore.guest >= 5;
      const winner = newScore.host >= 5 ? 'host' : 'guest';
      
      if (isGameOver) {
        // Update game status
        await gameDoc.ref.update({
          score: newScore,
          status: 'completed',
          winner: winner,
          endedAt: new Date()
        });

        // Get references to player documents
        const hostRef = db.collection('users').doc(gameData.players.host.id);
        const guestRef = db.collection('users').doc(gameData.players.guest.id);
        
        // Get current stats
        const hostDoc = await hostRef.get();
        const guestDoc = await guestRef.get();
        
        // Update host stats
        await hostRef.update({
          'stats.gamesPlayed': (hostDoc.data()?.stats?.gamesPlayed || 0) + 1,
          'stats.wins': (hostDoc.data()?.stats?.wins || 0) + (winner === 'host' ? 1 : 0),
          'stats.losses': (hostDoc.data()?.stats?.losses || 0) + (winner === 'host' ? 0 : 1)
        });

        // Update guest stats
        await guestRef.update({
          'stats.gamesPlayed': (guestDoc.data()?.stats?.gamesPlayed || 0) + 1,
          'stats.wins': (guestDoc.data()?.stats?.wins || 0) + (winner === 'guest' ? 1 : 0),
          'stats.losses': (guestDoc.data()?.stats?.losses || 0) + (winner === 'guest' ? 0 : 1)
        });

        // Notify all players in the room
        io.to(`game_${gameId}`).emit('game-over', {
          winner,
          score: newScore,
          hostId: gameData.players.host.id,
          guestId: gameData.players.guest.id
        });
      } else {
        // Just update score
        await gameDoc.ref.update({
          score: newScore,
          lastUpdated: new Date()
        });
        
        // Broadcast score update
        io.to(`game_${gameId}`).emit('score-update', newScore);
      }
    } catch (error) {
      console.error('Error in goal-scored handler:', error);
    }
  });

  socket.on('disconnect', async () => {
    try {
      console.log(`User ${socket.userId} disconnected`);
      
      // Clean up game room if user was in one
      if (socket.gameId) {
        const gameDoc = await db.collection('games').doc(socket.gameId).get();
        if (gameDoc.exists) {
          const gameData = gameDoc.data();
          
          // Update game status if a player left
          if (gameData.players.host.id === socket.userId || 
              gameData.players.guest.id === socket.userId) {
            await gameDoc.ref.update({
              status: 'ended',
              endedAt: new Date(),
              endReason: 'player_disconnected'
            });
            
            // Notify remaining players
            io.to(`game_${socket.gameId}`).emit('game-ended', {
              reason: 'player_disconnected'
            });
          }
        }
      }
    } catch (error) {
      console.error('Error handling disconnect:', error);
    }
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/game', gameRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    message: 'Internal server error', 
    error: process.env.NODE_ENV === 'development' ? err.message : undefined 
  });
});

const PORT = process.env.PORT || 4000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
