const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { auth } = require('../middleware/auth');
const { db } = require('../config/firebase');

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Check if user already exists
    const userSnapshot = await db.collection('users')
      .where('email', '==', email)
      .get();

    if (!userSnapshot.empty) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Check if username is taken
    const usernameSnapshot = await db.collection('users')
      .where('username', '==', username)
      .get();
    if (!usernameSnapshot.empty) {
      return res.status(400).json({ message: 'Username is already taken' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user in Firebase
    const userRef = await db.collection('users').add({
      username,
      email,
      password: hashedPassword,
      stats: {
        wins: 0,
        losses: 0,
        gamesPlayed: 0
      },
      createdAt: new Date()
    });

    const token = jwt.sign(
      { id: userRef.id, email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      token,
      user: {
        id: userRef.id,
        username,
        email,
        stats: {
          wins: 0,
          losses: 0,
          gamesPlayed: 0
        }
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('email', '==', email).get();

    if (snapshot.empty) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const userDoc = snapshot.docs[0];
    const user = { id: userDoc.id, ...userDoc.data() };

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        stats: user.stats
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user profile
router.get('/profile', auth, async (req, res) => {
  try {
    const userDoc = await db.collection('users').doc(req.user.id).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ message: 'User not found' });
    }

    const userData = userDoc.data();
    res.json({
      user: {
        id: userDoc.id,
        username: userData.username,
        email: userData.email,
        stats: userData.stats
      }
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Verify Token
router.get('/verify', auth, async (req, res) => {
  try {
    const userDoc = await db.collection('users').doc(req.user.id).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ message: 'User not found' });
    }

    const userData = userDoc.data();
    res.json({
      user: {
        id: userDoc.id,
        email: userData.email,
        username: userData.username,
        stats: userData.stats
      }
    });
  } catch (error) {
    console.error('Verify token error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
