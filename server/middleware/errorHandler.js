// ======================================
// ERROR HANDLER MIDDLEWARE
// ======================================

// Async handler wrapper to catch errors in async route handlers
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Main error handling middleware
const errorHandler = (error, req, res, next) => {
  let statusCode = error.statusCode || 500;
  let message = error.message || 'Internal Server Error';

  // Log error details
  logError(error, req);

  // Handle specific error types
  if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error';
  } else if (error.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid data format';
  } else if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token';
  } else if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Authentication token has expired';
  } else if (error.code === 'ENOENT') {
    statusCode = 404;
    message = 'File or resource not found';
  } else if (error.code === 'EACCES') {
    statusCode = 403;
    message = 'Permission denied';
  }

  // Don't expose internal error details in production
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    message = 'Internal Server Error';
  }

  // Prepare error response
  const errorResponse = {
    success: false,
    message: getUserFriendlyMessage(error) || message,
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method
  };

  // Include error details in development
  if (process.env.NODE_ENV !== 'production') {
    errorResponse.error = {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }

  // Include request ID if available
  if (req.id) {
    errorResponse.requestId = req.id;
  }

  res.status(statusCode).json(errorResponse);
};

// Not found middleware (404 handler)
const notFoundHandler = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

// Log error details
const logError = (error, req) => {
  const errorInfo = {
    timestamp: new Date().toISOString(),
    message: error.message,
    stack: error.stack,
    name: error.name,
    code: error.code,
    statusCode: error.statusCode,
    url: req.url,
    method: req.method,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.headers['user-agent'],
    user: req.user ? {
      username: req.user.username,
      role: req.user.role
    } : null,
    body: req.method !== 'GET' ? req.body : undefined,
    query: Object.keys(req.query).length > 0 ? req.query : undefined
  };

  // Log based on severity
  if (error.statusCode >= 500) {
    console.error('CRITICAL ERROR:', JSON.stringify(errorInfo, null, 2));
  } else if (error.statusCode >= 400) {
    console.warn('CLIENT ERROR:', JSON.stringify(errorInfo, null, 2));
  } else {
    console.log('INFO:', JSON.stringify(errorInfo, null, 2));
  }

  // In production, you might want to send errors to an external service
  if (process.env.NODE_ENV === 'production' && error.statusCode >= 500) {
    // Send to error tracking service (e.g., Sentry, LogRocket, etc.)
    // sendToErrorService(errorInfo);
  }
};

// Get user-friendly error message
const getUserFriendlyMessage = (error) => {
  const messageMappings = {
    'ENOENT': 'File or resource not found',
    'EACCES': 'Permission denied',
    'ECONNREFUSED': 'Service temporarily unavailable',
    'ETIMEDOUT': 'Request timeout - please try again',
    'ENOTFOUND': 'Service not available',
    'ValidationError': 'Invalid input data provided',
    'CastError': 'Invalid data format',
    'MongoError': 'Database operation failed',
    'JsonWebTokenError': 'Invalid authentication token',
    'TokenExpiredError': 'Authentication token has expired',
    'SyntaxError': 'Invalid request format'
  };

  // Check for specific error types
  if (error.type && messageMappings[error.type]) {
    return messageMappings[error.type];
  }

  // Check for error codes
  if (error.code && messageMappings[error.code]) {
    return messageMappings[error.code];
  }

  // Check for constructor name
  if (error.constructor.name && messageMappings[error.constructor.name]) {
    return messageMappings[error.constructor.name];
  }

  // Check for specific error messages
  const errorMessage = error.message.toLowerCase();
  
  if (errorMessage.includes('duplicate') || errorMessage.includes('unique')) {
    return 'This item already exists';
  }
  
  if (errorMessage.includes('required') || errorMessage.includes('missing')) {
    return 'Required information is missing';
  }
  
  if (errorMessage.includes('invalid') || errorMessage.includes('malformed')) {
    return 'Invalid data provided';
  }
  
  if (errorMessage.includes('timeout')) {
    return 'Operation timed out - please try again';
  }
  
  if (errorMessage.includes('connection') || errorMessage.includes('network')) {
    return 'Network connection error - please check your connection';
  }

  // Default messages based on status code
  if (error.statusCode) {
    switch (error.statusCode) {
      case 400: return 'Invalid request - please check your input';
      case 401: return 'Authentication required - please log in';
      case 403: return 'Access denied - insufficient permissions';
      case 404: return 'The requested resource was not found';
      case 408: return 'Request timeout - please try again';
      case 409: return 'Conflict - this action cannot be completed';
      case 413: return 'Request too large - please reduce the size';
      case 422: return 'Invalid input data - please check and try again';
      case 429: return 'Too many requests - please wait before trying again';
      case 500: return 'Internal server error - please try again later';
      case 502: return 'Service temporarily unavailable';
      case 503: return 'Service maintenance - please try again later';
      case 504: return 'Gateway timeout - please try again';
      default: return null;
    }
  }

  return null;
};

// Create custom error
const createError = (message, statusCode = 500, code = null) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
};

// Validation error helper
const validationError = (message, errors = []) => {
  const error = new Error(message);
  error.statusCode = 400;
  error.name = 'ValidationError';
  error.errors = errors;
  return error;
};

// Authorization error helper
const authorizationError = (message = 'Access denied') => {
  const error = new Error(message);
  error.statusCode = 403;
  error.name = 'AuthorizationError';
  return error;
};

// Authentication error helper
const authenticationError = (message = 'Authentication required') => {
  const error = new Error(message);
  error.statusCode = 401;
  error.name = 'AuthenticationError';
  return error;
};

// Not found error helper
const notFoundError = (message = 'Resource not found') => {
  const error = new Error(message);
  error.statusCode = 404;
  error.name = 'NotFoundError';
  return error;
};

// Conflict error helper
const conflictError = (message = 'Resource conflict') => {
  const error = new Error(message);
  error.statusCode = 409;
  error.name = 'ConflictError';
  return error;
};

// Rate limit error helper
const rateLimitError = (message = 'Too many requests') => {
  const error = new Error(message);
  error.statusCode = 429;
  error.name = 'RateLimitError';
  return error;
};

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  createError,
  validationError,
  authorizationError,
  authenticationError,
  notFoundError,
  conflictError,
  rateLimitError,
  logError,
  getUserFriendlyMessage
};