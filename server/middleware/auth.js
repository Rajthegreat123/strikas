const jwt = require('jsonwebtoken');
const { db } = require('../config/firebase');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No auth token' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.id) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    // Get user from database
    const userDoc = await db.collection('users').doc(decoded.id).get();
    if (!userDoc.exists) {
      return res.status(401).json({ message: 'User not found' });
    }

    const userData = userDoc.data();
    
    // Attach user data to request
    req.user = {
      id: decoded.id,
      username: userData.username || userData.email?.split('@')[0], // Fallback to email username if no username set
      email: userData.email
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ message: 'Authentication failed' });
  }
};

module.exports = { auth };
