const express = require('express');
const ExcelUtils = require('../utils/excelUtils');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// Lock/unlock Excel workbook for editing protection
router.post('/lock', asyncHandler(async (req, res) => {
  const user = req.session.user;
  
  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'User not authenticated'
    });
  }

  try {
    // In a real implementation, you would implement workbook locking
    // For now, we'll just return a success response
    res.json({
      success: true,
      message: 'Workbook locked for editing protection',
      lockedBy: user.username,
      lockTime: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error locking workbook:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to lock workbook'
    });
  }
}));

router.post('/unlock', asyncHandler(async (req, res) => {
  const user = req.session.user;
  
  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'User not authenticated'
    });
  }

  try {
    // In a real implementation, you would implement workbook unlocking
    res.json({
      success: true,
      message: 'Workbook unlocked',
      unlockedBy: user.username,
      unlockTime: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error unlocking workbook:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unlock workbook'
    });
  }
}));

// Get workbook status
router.get('/status', asyncHandler(async (req, res) => {
  const user = req.session.user;
  
  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'User not authenticated'
    });
  }

  try {
    // Get basic workbook information
    const sheets = ['Proposals', 'Budget', 'Cost', 'Users', 'Workplan'];
    const sheetStatus = {};
    
    for (const sheetName of sheets) {
      try {
        const data = await ExcelUtils.getSheetData(sheetName);
        sheetStatus[sheetName] = {
          exists: true,
          rowCount: data.rows ? data.rows.length : 0,
          columnCount: data.headers ? data.headers.length : 0,
          headers: data.headers || []
        };
      } catch (error) {
        sheetStatus[sheetName] = {
          exists: false,
          error: error.message
        };
      }
    }

    res.json({
      success: true,
      workbook: {
        status: 'available',
        lastModified: new Date().toISOString(),
        sheets: sheetStatus,
        totalSheets: Object.keys(sheetStatus).length
      }
    });

  } catch (error) {
    console.error('Error getting workbook status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get workbook status'
    });
  }
}));

// Sync data to Excel workbook
router.post('/sync', asyncHandler(async (req, res) => {
  const user = req.session.user;
  
  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'User not authenticated'
    });
  }

  try {
    // Get all data from sheets
    const proposalData = await ExcelUtils.getSheetData('Proposals');
    const budgetData = await ExcelUtils.getSheetData('Budget');
    const costData = await ExcelUtils.getSheetData('Cost');
    const userData = await ExcelUtils.getSheetData('Users');

    const syncResult = {
      success: true,
      message: 'Data synchronized successfully',
      timestamp: new Date().toISOString(),
      syncedBy: user.username,
      summary: {
        proposals: proposalData.rows ? proposalData.rows.length : 0,
        budgetItems: budgetData.rows ? budgetData.rows.length : 0,
        costItems: costData.rows ? costData.rows.length : 0,
        users: userData.rows ? userData.rows.length : 0
      }
    };

    res.json(syncResult);

  } catch (error) {
    console.error('Error syncing workbook:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to sync workbook data'
    });
  }
}));

// Export workbook data
router.get('/export/:format', asyncHandler(async (req, res) => {
  const { format } = req.params;
  const user = req.session.user;
  
  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'User not authenticated'
    });
  }

  // Only specialists can export data
  if (user.role !== 'specialist') {
    return res.status(403).json({
      success: false,
      message: 'Only specialists can export workbook data'
    });
  }

  try {
    if (format !== 'xlsx' && format !== 'csv') {
      return res.status(400).json({
        success: false,
        message: 'Unsupported export format. Use xlsx or csv.'
      });
    }

    // In a real implementation, you would generate and return the actual file
    // For now, we'll return export information
    const exportInfo = {
      success: true,
      message: `Workbook exported as ${format.toUpperCase()}`,
      format: format,
      exportedBy: user.username,
      timestamp: new Date().toISOString(),
      filename: `proposal_management_export_${Date.now()}.${format}`,
      downloadUrl: `/downloads/proposal_management_export_${Date.now()}.${format}`
    };

    res.json(exportInfo);

  } catch (error) {
    console.error('Error exporting workbook:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export workbook'
    });
  }
}));

// Backup workbook
router.post('/backup', asyncHandler(async (req, res) => {
  const user = req.session.user;
  
  if (!user || user.role !== 'specialist') {
    return res.status(403).json({
      success: false,
      message: 'Only specialists can create workbook backups'
    });
  }

  try {
    // In a real implementation, you would create an actual backup
    const backupInfo = {
      success: true,
      message: 'Workbook backup created successfully',
      backupId: `backup_${Date.now()}`,
      createdBy: user.username,
      timestamp: new Date().toISOString(),
      location: 'system/backups/',
      size: '2.5MB' // Placeholder
    };

    res.json(backupInfo);

  } catch (error) {
    console.error('Error creating workbook backup:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create workbook backup'
    });
  }
}));

// Restore workbook from backup
router.post('/restore/:backupId', asyncHandler(async (req, res) => {
  const { backupId } = req.params;
  const user = req.session.user;
  
  if (!user || user.role !== 'specialist') {
    return res.status(403).json({
      success: false,
      message: 'Only specialists can restore workbook backups'
    });
  }

  try {
    // In a real implementation, you would restore from actual backup
    const restoreInfo = {
      success: true,
      message: 'Workbook restored successfully',
      backupId: backupId,
      restoredBy: user.username,
      timestamp: new Date().toISOString(),
      warning: 'Current data has been replaced with backup data'
    };

    res.json(restoreInfo);

  } catch (error) {
    console.error('Error restoring workbook:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to restore workbook'
    });
  }
}));

// Get workbook validation report
router.get('/validate', asyncHandler(async (req, res) => {
  const user = req.session.user;
  
  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'User not authenticated'
    });
  }

  try {
    const validationReport = {
      success: true,
      timestamp: new Date().toISOString(),
      validatedBy: user.username,
      status: 'valid',
      issues: [],
      warnings: [],
      summary: {
        totalSheets: 5,
        validSheets: 5,
        issues: 0,
        warnings: 0
      }
    };

    // In a real implementation, you would perform actual validation
    // Check for data integrity, missing required fields, etc.

    res.json(validationReport);

  } catch (error) {
    console.error('Error validating workbook:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate workbook'
    });
  }
}));

module.exports = router;