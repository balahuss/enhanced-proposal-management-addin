const express = require('express');
const session = require('express-session');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Import custom modules
const apiRoutes = require('./routes/api');
const authRoutes = require('./routes/auth');
const proposalRoutes = require('./routes/proposals');
const budgetRoutes = require('./routes/budget');
const excelRoutes = require('./routes/excel');
const errorHandler = require('./middleware/errorHandler');
const authMiddleware = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_PORT = process.env.FRONTEND_PORT || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        "'unsafe-eval'",
        "https://appsforoffice.microsoft.com",
        "https://ajax.aspnetcdn.com",
        "https://cdn.jsdelivr.net",
        "https://unpkg.com"
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://fonts.googleapis.com",
        "https://cdn.jsdelivr.net"
      ],
      fontSrc: [
        "'self'",
        "https://fonts.gstatic.com",
        "https://cdn.jsdelivr.net"
      ],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: [
        "'self'",
        `http://localhost:${PORT}`,
        `http://localhost:${FRONTEND_PORT}`,
        "https://appsforoffice.microsoft.com"
      ],
      frameSrc: [
        "'self'",
        "https://appsforoffice.microsoft.com"
      ]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// Compression middleware
app.use(compression());

// CORS configuration
app.use(cors({
  origin: [
    `http://localhost:${FRONTEND_PORT}`,
    `http://localhost:${PORT}`,
    'https://localhost:3000',
    'https://localhost:3001'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-requested-with']
}));

// Logging middleware
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Serve static files from dist directory
app.use(express.static(path.join(__dirname, '../../dist')));

// Serve static assets
app.use('/assets', express.static(path.join(__dirname, '../client/assets')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/proposals', authMiddleware, proposalRoutes);
app.use('/api/budget', authMiddleware, budgetRoutes);
app.use('/api/excel', authMiddleware, excelRoutes);
app.use('/api', authMiddleware, apiRoutes);

// Serve Office Add-in files
app.get('/taskpane.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../../dist/taskpane.html'));
});

app.get('/fullscreen.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../../dist/fullscreen.html'));
});

app.get('/function-file/function-file.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../../dist/function-file/function-file.html'));
});

// Serve manifest file
app.get('/manifest.xml', (req, res) => {
  res.setHeader('Content-Type', 'application/xml');
  res.sendFile(path.join(__dirname, '../../manifest.xml'));
});

// Initialize database/excel workbook structure
app.post('/api/initialize', authMiddleware, async (req, res) => {
  try {
    const ExcelUtils = require('./utils/excelUtils');
    const result = await ExcelUtils.initializeWorkbook();
    res.json({ success: true, message: 'System initialized successfully', data: result });
  } catch (error) {
    console.error('Initialization error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to initialize system',
      error: error.message 
    });
  }
});

// Catch-all handler for SPA routing
app.get('*', (req, res) => {
  // Check if the request is for an HTML file
  if (req.path.endsWith('.html') || req.path === '/') {
    const filePath = path.join(__dirname, '../../dist/index.html');
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).send('File not found');
    }
  } else {
    res.status(404).json({ message: 'Route not found' });
  }
});

// Error handling middleware
app.use(errorHandler);

// Graceful shutdown handling
const server = app.listen(PORT, () => {
  console.log(`🚀 Enhanced Proposal Management Server running on port ${PORT}`);
  console.log(`📊 Frontend available at: http://localhost:${FRONTEND_PORT}`);
  console.log(`🔗 API available at: http://localhost:${PORT}/api`);
  console.log(`📄 Manifest available at: http://localhost:${PORT}/manifest.xml`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`🌟 Environment: ${process.env.NODE_ENV || 'development'}`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

module.exports = app;