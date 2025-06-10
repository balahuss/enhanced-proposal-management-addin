// ======================================
// API.JS - GENERAL API ROUTES
// ======================================

const express = require('express');
const ExcelUtils = require('../utils/excelUtils');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// ======================================
// HEALTH CHECK AND STATUS ENDPOINTS
// ======================================

// Health check endpoint
router.get('/health', asyncHandler(async (req, res) => {
  try {
    // Basic health check
    const healthStatus = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0'
    };

    // Check Excel utilities availability
    try {
      await ExcelUtils.checkConnection();
      healthStatus.excel = 'OK';
    } catch (error) {
      healthStatus.excel = 'ERROR';
      healthStatus.excelError = error.message;
    }

    res.json(healthStatus);
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
}));

// System status endpoint (authenticated)
router.get('/status', asyncHandler(async (req, res) => {
  const user = req.session.user;
  
  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  try {
    const systemStatus = {
      success: true,
      timestamp: new Date().toISOString(),
      user: {
        username: user.username,
        role: user.role,
        loginTime: req.session.loginTime || new Date().toISOString()
      },
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        environment: process.env.NODE_ENV || 'development'
      }
    };

    // Get basic system statistics
    try {
      const sheets = ['Proposals', 'Budget', 'Cost', 'Users'];
      const sheetStatus = {};
      
      for (const sheet of sheets) {
        try {
          const data = await ExcelUtils.getSheetData(sheet);
          sheetStatus[sheet] = {
            status: 'OK',
            rowCount: data.rows ? data.rows.length : 0,
            columns: data.headers ? data.headers.length : 0
          };
        } catch (error) {
          sheetStatus[sheet] = {
            status: 'ERROR',
            error: error.message
          };
        }
      }
      
      systemStatus.sheets = sheetStatus;
    } catch (error) {
      systemStatus.sheetsError = error.message;
    }

    res.json(systemStatus);
  } catch (error) {
    console.error('System status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get system status',
      error: error.message
    });
  }
}));

// ======================================
// SYSTEM INITIALIZATION
// ======================================

// Initialize system/database structure
router.post('/initialize', asyncHandler(async (req, res) => {
  const user = req.session.user;
  
  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  // Only specialists can initialize the system
  if (user.role !== 'specialist') {
    return res.status(403).json({
      success: false,
      message: 'Only specialists can initialize the system'
    });
  }

  try {
    console.log(`System initialization requested by ${user.username}`);
    
    const result = await ExcelUtils.initializeWorkbook();
    
    console.log('System initialization completed successfully');
    
    res.json({
      success: true,
      message: 'System initialized successfully',
      data: result,
      initializedBy: user.username,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('System initialization error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initialize system',
      error: error.message
    });
  }
}));

// ======================================
// SYSTEM CONFIGURATION
// ======================================

// Get system configuration
router.get('/config', asyncHandler(async (req, res) => {
  const user = req.session.user;
  
  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  try {
    const config = {
      success: true,
      config: {
        maxFileSize: '10mb',
        supportedFormats: ['xlsx', 'csv'],
        features: {
          budgetTracking: true,
          pdfGeneration: true,
          emailNotifications: true,
          excelIntegration: true
        },
        limits: {
          maxProposalsPerUser: user.role === 'specialist' ? -1 : 100,
          maxBudgetItems: 1000,
          sessionTimeout: 24 * 60 * 60 * 1000 // 24 hours
        },
        permissions: {
          canCreateProposals: true,
          canEditProposals: true,
          canDeleteProposals: user.role === 'specialist',
          canManageUsers: user.role === 'specialist',
          canAccessReports: true,
          canExportData: user.role === 'specialist'
        }
      }
    };

    res.json(config);
  } catch (error) {
    console.error('Get config error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get system configuration'
    });
  }
}));

// ======================================
// SYSTEM METRICS AND ANALYTICS
// ======================================

// Get system metrics (specialist only)
router.get('/metrics', asyncHandler(async (req, res) => {
  const user = req.session.user;
  
  if (!user || user.role !== 'specialist') {
    return res.status(403).json({
      success: false,
      message: 'Only specialists can view system metrics'
    });
  }

  try {
    // Get basic metrics from all sheets
    const proposalData = await ExcelUtils.getSheetData('Proposals');
    const budgetData = await ExcelUtils.getSheetData('Budget');
    const userData = await ExcelUtils.getSheetData('Users');
    const costData = await ExcelUtils.getSheetData('Cost');

    const metrics = {
      success: true,
      timestamp: new Date().toISOString(),
      metrics: {
        proposals: {
          total: proposalData.rows ? proposalData.rows.length : 0,
          byStatus: {},
          totalBudget: 0
        },
        budget: {
          totalItems: budgetData.rows ? budgetData.rows.length : 0,
          totalValue: 0
        },
        users: {
          total: userData.rows ? userData.rows.length : 0,
          byRole: {}
        },
        costItems: {
          total: costData.rows ? costData.rows.length : 0
        }
      }
    };

    res.json(metrics);
  } catch (error) {
    console.error('Get metrics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get system metrics'
    });
  }
}));

// ======================================
// ERROR HANDLING
// ======================================

// Global error handler for this router
router.use((error, req, res, next) => {
  console.error('API Routes Error:', error);
  
  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Internal server error',
    timestamp: new Date().toISOString(),
    path: req.path
  });
});

module.exports = router;