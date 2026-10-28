const jwt = require('jsonwebtoken');
const User = require('../models/User');

const SECRET = process.env.JWT_SECRET || process.env.secret_key || 'fortis_secret';

function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: '7d' });
}

async function authRequired(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'Unauthorized' });

    const decoded = jwt.verify(token, SECRET);

    if (decoded.role === 'admin') {
      req.isAdmin = true;
      req.user = { role: 'admin', email: decoded.email };
      return next();
    }

    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ message: 'Unauthorized' });
    req.user = user;
    req.userId = user._id;
    return next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

function adminOnly(req, res, next) {
  if (!req.isAdmin) return res.status(403).json({ message: 'Admin access required' });
  return next();
}

module.exports = { signToken, authRequired, adminOnly, SECRET };