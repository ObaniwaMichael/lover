import jwt from 'jsonwebtoken';

/**
 * Requires Authorization: Bearer <token>. Uses JWT_SECRET from the environment
 * (validated by env-validator before the server boots).
 */
export function authenticateToken(req, res, next) {
  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) {
    return res.status(500).json({ error: 'Server authentication is not configured' });
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}
