const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const { auth } = require('../middleware/auth');
const { generateLobbyCode } = require('../utils/helpers');

// Wrap async route handlers
const asyncHandler = fn => (req, res, next) => {
  return Promise.resolve(fn(req, res, next)).catch(next);
};

// Find or create public lobby
router.post('/lobby/public', auth, asyncHandler(async (req, res) => {
  const lobbiesRef = db.collection('lobbies');
  
  // Find an available public lobby
  const publicLobbies = await lobbiesRef
    .where('isPrivate', '==', false)
    .where('playerCount', '<', 2)
    .get();

  // If there's an available public lobby, join it
  if (!publicLobbies.empty) {
    const lobby = publicLobbies.docs[0];
    const lobbyData = lobby.data();

    // Add the player to the lobby
    await lobby.ref.update({
      guest: {
        id: req.user.id,
        username: req.user.username
      },
      playerCount: 2
    });

    return res.json({
      id: lobby.id,
      ...lobbyData,
      guest: {
        id: req.user.id,
        username: req.user.username
      }
    });
  }

  // If no available public lobby, create a new one
  const newLobby = {
    host: {
      id: req.user.id,
      username: req.user.username
    },
    guest: null,
    isPrivate: false,
    playerCount: 1,
    createdAt: new Date(),
    status: 'waiting'
  };

  const lobbyDoc = await lobbiesRef.add(newLobby);
  
  res.json({
    id: lobbyDoc.id,
    ...newLobby
  });
}));

// Create private lobby
router.post('/lobby', auth, asyncHandler(async (req, res) => {
  const { isPrivate } = req.body;
  const lobbiesRef = db.collection('lobbies');

  const lobbyData = {
    host: {
      id: req.user.id,
      username: req.user.username
    },
    guest: null,
    isPrivate,
    code: isPrivate ? generateLobbyCode() : null,
    playerCount: 1,
    createdAt: new Date(),
    status: 'waiting'
  };

  const lobbyDoc = await lobbiesRef.add(lobbyData);

  res.json({
    id: lobbyDoc.id,
    ...lobbyData
  });
}));

// Join private lobby by code
router.post('/lobby/join-by-code', auth, asyncHandler(async (req, res) => {
  console.log('Join private lobby request:', { userId: req.user.id, code: req.body.code });
  
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ message: 'Lobby code is required' });
  }

  const lobbiesRef = db.collection('lobbies');
  console.log('Searching for lobby with code:', code);
  
  try {
    // First find by code only
    const lobbies = await lobbiesRef
      .where('code', '==', code)
      .get();

    if (lobbies.empty) {
      console.log('No lobby found with code:', code);
      return res.status(404).json({ message: 'Lobby not found' });
    }

    const lobby = lobbies.docs[0];
    const lobbyData = lobby.data();
    console.log('Found lobby:', { id: lobby.id, ...lobbyData });

    // Then check player count manually
    if (lobbyData.playerCount >= 2) {
      console.log('Lobby is full');
      return res.status(400).json({ message: 'Lobby is full' });
    }

    if (lobbyData.host.id === req.user.id) {
      console.log('User tried to join their own lobby');
      return res.status(400).json({ message: 'Cannot join your own lobby' });
    }

    if (lobbyData.guest) {
      console.log('Lobby already has a guest');
      return res.status(400).json({ message: 'Lobby is already full' });
    }

    // Add the player to the lobby
    const updateData = {
      guest: {
        id: req.user.id,
        username: req.user.username
      },
      playerCount: 2
    };
    
    console.log('Updating lobby with guest data:', updateData);
    await lobby.ref.update(updateData);

    // Get the updated lobby data
    const updatedLobby = await lobby.ref.get();
    const updatedLobbyData = {
      id: updatedLobby.id,
      ...updatedLobby.data()
    };
    
    // Emit socket event to notify all clients in the lobby
    req.app.get('io').to(`lobby_${lobby.id}`).emit('lobby-updated', updatedLobbyData);
    
    console.log('Successfully joined lobby:', updatedLobbyData);
    res.json(updatedLobbyData);
  } catch (error) {
    console.error('Error joining lobby:', error);
    res.status(500).json({ 
      message: 'Failed to join lobby',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}));

// Get lobby by ID
router.get('/lobby/:id', auth, asyncHandler(async (req, res) => {
  const lobbyDoc = await db.collection('lobbies').doc(req.params.id).get();
  
  if (!lobbyDoc.exists) {
    return res.status(404).json({ message: 'Lobby not found' });
  }

  const lobbyData = lobbyDoc.data();
  
  // Check if user is part of the lobby
  if (lobbyData.host.id !== req.user.id && 
      (!lobbyData.guest || lobbyData.guest.id !== req.user.id)) {
    return res.status(403).json({ message: 'Not authorized to view this lobby' });
  }

  res.json({
    id: lobbyDoc.id,
    ...lobbyData
  });
}));

// Get available public lobbies
router.get('/lobbies', auth, asyncHandler(async (req, res) => {
  const lobbiesRef = db.collection('lobbies');
  const snapshot = await lobbiesRef
    .where('isPrivate', '==', false)
    .where('status', '==', 'waiting')
    .get();

  const lobbies = [];
  snapshot.forEach(doc => {
    lobbies.push({
      id: doc.id,
      ...doc.data()
    });
  });

  res.json({ lobbies });
}));

// Update player stats
router.put('/stats', auth, asyncHandler(async (req, res) => {
  const { result } = req.body; // 'win' or 'loss'
  const userRef = db.collection('users').doc(req.user.id);
  
  await db.runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef);
    const userData = userDoc.data();
    
    const stats = {
      wins: userData.stats.wins + (result === 'win' ? 1 : 0),
      losses: userData.stats.losses + (result === 'loss' ? 1 : 0),
      gamesPlayed: userData.stats.gamesPlayed + 1
    };

    transaction.update(userRef, { stats });
  });

  res.json({ message: 'Stats updated successfully' });
}));

module.exports = router;
