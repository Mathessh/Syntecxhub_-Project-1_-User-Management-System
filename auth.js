const jwt = require('jsonwebtoken');

// Basic Authentication middleware
// Checks for either:
//   1. Bearer token (JWT) in Authorization header
//   2. Basic auth credentials (admin username/password from .env)
const basicAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No authorization header provided.',
    });
  }

  // Handle Bearer token (JWT)
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      return next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token.',
      });
    }
  }

  // Handle Basic auth
  if (authHeader.startsWith('Basic ')) {
    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
    const [username, password] = credentials.split(':');

    if (
      username === process.env.ADMIN_USERNAME &&
      password === process.env.ADMIN_PASSWORD
    ) {
      req.user = { username, role: 'admin' };
      return next();
    }

    return res.status(401).json({
      success: false,
      message: 'Invalid credentials.',
    });
  }

  return res.status(401).json({
    success: false,
    message: 'Invalid authorization format. Use "Basic" or "Bearer" scheme.',
  });
};

module.exports = { basicAuth };
