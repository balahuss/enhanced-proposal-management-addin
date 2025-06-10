// ======================================
// AUTHENTICATION MIDDLEWARE
// ======================================

const jwt = require('jsonwebtoken');

// Main authentication middleware
const authMiddleware = (req, res, next) => {
  try {
    // Check if user is authenticated via session
    if (req.session && req.session.user) {
      req.user = req.session.user;
      return next();
    }

    // Check for JWT token in headers
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-jwt-secret-change-in-production');
        req.user = decoded;
        return next();
      } catch (jwtError) {
        console.warn('Invalid JWT token:', jwtError.message);
      }
    }

    // No valid authentication found
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please log in.',
      code: 'AUTH_REQUIRED'
    });

  } catch (error) {
    console.error('Authentication middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication system error'
    });
  }
};

// Role-based authorization middleware
const requireRole = (requiredRole) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      if (req.user.role !== requiredRole) {
        return res.status(403).json({
          success: false,
          message: `Access denied. ${requiredRole} role required.`,
          userRole: req.user.role,
          requiredRole: requiredRole
        });
      }

      next();
    } catch (error) {
      console.error('Role authorization error:', error);
      return res.status(500).json({
        success: false,
        message: 'Authorization system error'
      });
    }
  };
};

// Specialist-only middleware
const requireSpecialist = requireRole('specialist');

// Rate limiting middleware
const rateLimiter = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const requests = new Map();
  
  return (req, res, next) => {
    try {
      const clientId = req.ip || req.connection.remoteAddress;
      const now = Date.now();
      const windowStart = now - windowMs;
      
      // Clean up old entries
      const clientRequests = requests.get(clientId) || [];
      const validRequests = clientRequests.filter(timestamp => timestamp > windowStart);
      
      if (validRequests.length >= maxRequests) {
        return res.status(429).json({
          success: false,
          message: 'Too many requests. Please try again later.',
          retryAfter: Math.ceil(windowMs / 1000)
        });
      }
      
      // Add current request
      validRequests.push(now);
      requests.set(clientId, validRequests);
      
      next();
    } catch (error) {
      console.error('Rate limiting error:', error);
      next(); // Continue on error to avoid blocking legitimate requests
    }
  };
};

// Request logging middleware
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  // Override res.json to log response
  const originalJson = res.json;
  res.json = function(data) {
    const duration = Date.now() - start;
    const logData = {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
      duration: `${duration}ms`,
      statusCode: res.statusCode,
      user: req.user ? `${req.user.username} (${req.user.role})` : 'anonymous'
    };
    
    console.log(`${req.method} ${req.url} - ${res.statusCode} - ${duration}ms - ${req.user ? req.user.username : 'anonymous'}`);
    
    // Call original json method
    return originalJson.call(this, data);
  };

  next();
};

// Input sanitization middleware
const sanitizeInput = (req, res, next) => {
  try {
    // Basic XSS protection for string inputs
    const sanitizeValue = (value) => {
      if (typeof value === 'string') {
        return value
          .replace(/[<>]/g, '') // Remove potential HTML tags
          .trim();
      }
      return value;
    };

    const sanitizeObject = (obj) => {
      if (obj && typeof obj === 'object') {
        for (const key in obj) {
          if (obj.hasOwnProperty(key)) {
            if (typeof obj[key] === 'object' && obj[key] !== null) {
              sanitizeObject(obj[key]);
            } else {
              obj[key] = sanitizeValue(obj[key]);
            }
          }
        }
      }
    };

    // Sanitize request body
    if (req.body) {
      sanitizeObject(req.body);
    }

    // Sanitize query parameters
    if (req.query) {
      sanitizeObject(req.query);
    }

    next();
  } catch (error) {
    console.error('Input sanitization error:', error);
    return res.status(400).json({
      success: false,
      message: 'Invalid input data'
    });
  }
};

// CORS middleware for Office Add-ins
const corsForOffice = (req, res, next) => {
  // Office Add-ins require specific CORS headers
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
};

// Session validation middleware
const validateSession = (req, res, next) => {
  try {
    if (req.session && req.session.user) {
      // Check if session is still valid (not expired)
      const sessionAge = Date.now() - (req.session.lastAccess || 0);
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours

      if (sessionAge > maxAge) {
        // Session expired
        req.session.destroy((err) => {
          if (err) {
            console.error('Session destruction error:', err);
          }
        });
        
        return res.status(401).json({
          success: false,
          message: 'Session expired. Please log in again.'
        });
      }

      // Update last access time
      req.session.lastAccess = Date.now();
    }

    next();
  } catch (error) {
    console.error('Session validation error:', error);
    next();
  }
};

// Content Security Policy middleware for Office Add-ins
const setCSP = (req, res, next) => {
  res.setHeader('Content-Security-Policy', `
    default-src 'self';
    script-src 'self' 'unsafe-inline' 'unsafe-eval' https://appsforoffice.microsoft.com https://ajax.aspnetcdn.com;
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    font-src 'self' https://fonts.gstatic.com;
    img-src 'self' data: https:;
    connect-src 'self' https://appsforoffice.microsoft.com;
    frame-src 'self' https://appsforoffice.microsoft.com;
  `.replace(/\s+/g, ' ').trim());

  next();
};

// Error boundary middleware
const errorBoundary = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Request ID middleware for tracking
const addRequestId = (req, res, next) => {
  req.id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  res.setHeader('X-Request-ID', req.id);
  next();
};

// Cache control middleware
const cacheControl = (maxAge = 0) => {
  return (req, res, next) => {
    if (maxAge > 0) {
      res.setHeader('Cache-Control', `public, max-age=${maxAge}`);
    } else {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    next();
  };
};

// Request size limit middleware
const limitRequestSize = (maxSize = '10mb') => {
  return (req, res, next) => {
    const contentLength = req.headers['content-length'];
    
    if (contentLength) {
      const size = parseInt(contentLength);
      const maxSizeBytes = maxSize.endsWith('mb') ? 
        parseInt(maxSize.replace('mb', '')) * 1024 * 1024 :
        parseInt(maxSize);
      
      if (size > maxSizeBytes) {
        return res.status(413).json({
          success: false,
          message: `Request size exceeds limit of ${maxSize}`,
          maxSize: maxSize,
          receivedSize: `${Math.round(size / 1024 / 1024 * 100) / 100}mb`
        });
      }
    }
    
    next();
  };
};

module.exports = {
  authMiddleware,
  requireRole,
  requireSpecialist,
  rateLimiter,
  requestLogger,
  sanitizeInput,
  corsForOffice,
  validateSession,
  setCSP,
  errorBoundary,
  addRequestId,
  cacheControl,
  limitRequestSize
};