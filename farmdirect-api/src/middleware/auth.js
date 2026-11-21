const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');
const { unauthorized, forbidden } = require('../utils/errors');

function signToken(user) {
  return jwt.sign({ sub: String(user._id), role: user.role, tv: user.tokenVersion || 0 }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
    algorithm: 'HS256',
  });
}

/** Loads the user from a Bearer token. Rejects deactivated users and revoked tokens. */
async function authenticate(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw unauthorized();
    let payload;
    try {
      payload = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });
    } catch {
      throw unauthorized('Your session has expired. Please log in again.');
    }
    const user = await User.findById(payload.sub).select('+tokenVersion');
    if (!user || !user.isActive) throw unauthorized('Account not found or disabled');
    if ((user.tokenVersion || 0) !== payload.tv) throw unauthorized('Session was signed out. Please log in again.');
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

/** Role guard. Always use AFTER authenticate. The role comes from the DB, never from the request. */
const requireRole =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) return next(forbidden());
    next();
  };

module.exports = { signToken, authenticate, requireRole };
