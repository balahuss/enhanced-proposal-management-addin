// ======================================
// FUNCTION-FILE.JS - STANDALONE OFFICE FUNCTIONS
// ======================================

// This file provides standalone Office.js functions that can be called
// independently of the main application, primarily for ribbon commands

(() => {
  'use strict';

  // ======================================
  // GLOBAL VARIABLES AND CONFIGURATION
  // ======================================

  let isOfficeInitialized = false;
  let currentContext = null;
  let debugMode = false;

  const config = {
    apiBaseUrl: process.env.NODE_ENV === 'production' 
      ? 'https://localhost:3001/api' 
      : 'http://localhost:3001/api',
    worksheetNames: {
      proposals: 'Proposals',
      budget: 'Budget',
      costItems: 'Cost',
      users: 'Users',
      workplan: 'Workplan',
      systemConfig: 'System_Config'
    },
    maxRetries: 3,
    retryDelay: 1000
  };

  // ======================================
  // OFFICE INITIALIZATION
  // ======================================

  const initializeOffice = () => {
    if (typeof Office === 'undefined') {
      console.warn('Office.js not available');
      return Promise.resolve(false);
    }

    return new Promise((resolve) => {
      Office.onReady((info) => {
        console.log('📊 Function file Office.onReady called:', info);
        isOfficeInitialized = true;
        currentContext = info;
        
        // Enable debug mode in development
        debugMode = process.env.NODE_ENV === 'development';
        
        if (debugMode) {
          console.log('🔧 Debug mode enabled for function file');
        }
        
        resolve(true);
      });
    });
  };

  // ======================================
  // UTILITY FUNCTIONS
  // ======================================

  const ensureOfficeReady = () => {
    if (!isOfficeInitialized) {
      throw new Error('Office not initialized');
    }
    return true;
  };

  const logFunction = (functionName, args = []) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] Function executed: ${functionName}`, args);
  };

  const showNotification = (title, message, type = 'information') => {
    if (Office.context && Office.context.ui) {
      try {
        const dialogHtml = `
          <html>
            <head>
              <style>
                body { 
                  font-family: 'Segoe UI', sans-serif; 
                  padding: 20px; 
                  margin: 0;
                  background: #f8f7f6;
                }
                .notification {
                  background: white;
                  border-radius: 8px;
                  padding: 20px;
                  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                  text-align: center;
                }
                .title { 
                  font-size: 16px; 
                  font-weight: 600; 
                  margin-bottom: 8px;
                  color: #323130;
                }
                .message { 
                  font-size: 14px; 
                  color: #605e5c;
                  line-height: 1.4;
                }
                .icon {
                  font-size: 24px;
                  margin-bottom: 12px;
                }
              </style>
            </head>
            <body>
              <div class="notification">
                <div class="icon">${type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️'}</div>
                <div class="title">${title}</div>
                <div class="message">${message}</div>
              </div>
            </body>
          </html>
        `;

        Office.context.ui.displayDialogAsync(
          `data:text/html,${encodeURIComponent(dialogHtml)}`,
          { height: 200, width: 400 },
          (result) => {
            if (result.status === Office.AsyncResultStatus.Succeeded) {
              setTimeout(() => {
                if (result.value) {
                  result.value.close();
                }
              }, 3000);
            }
          }
        );
      } catch (error) {
        console.error('Error showing notification:', error);
        // Fallback to alert
        alert(`${title}: ${message}`);
      }
    } else {
      // Fallback for environments without Office.context.ui
      alert(`${title}: ${message}`);
    }
  };

  const apiCall = async (endpoint, options = {}) => {
    const url = `${config.apiBaseUrl}${endpoint}`;
    
    const defaultOptions = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      credentials: 'include'
    };

    const finalOptions = { ...defaultOptions, ...options };

    let retries = 0;
    while (retries < config.maxRetries) {
      try {
        const response = await fetch(url, finalOptions);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
      } catch (error) {
        retries++;
        if (retries >= config.maxRetries) {
          throw error;
        }
        
        console.warn(`API call attempt ${retries} failed, retrying...`, error);
        await new Promise(resolve => setTimeout(resolve, config.retryDelay * retries));
      }
    }
  };

  // ======================================
  // EXCEL UTILITY FUNCTIONS
  // ======================================

  const getWorksheetNames = async () => {
    try {
      let worksheetNames = [];
      await Excel.run(async (context) => {
        const worksheets = context.workbook.worksheets;
        worksheets.load('items/name');
        await context.sync();
        
        worksheetNames = worksheets.items.map(ws => ws.name);
      });
      return worksheetNames;
    } catch (error) {
      console.error('Error getting worksheet names:', error);
      return [];
    }
  };

  const applyWorksheetProtection = async (worksheetName, options = {}) => {
    try {
      await Excel.run(async (context) => {
        const worksheet = context.workbook.worksheets.getItem(worksheetName);
        
        const protectionOptions = {
          allowFormatCells: options.allowFormatCells || false,
          allowFormatColumns: options.allowFormatColumns || false,
          allowFormatRows: options.allowFormatRows || false,
          allowInsertColumns: options.allowInsertColumns || false,
          allowInsertRows: options.allowInsertRows || false,
          allowInsertHyperlinks: options.allowInsertHyperlinks || false,
          allowDeleteColumns: options.allowDeleteColumns || false,
          allowDeleteRows: options.allowDeleteRows || false,
          allowSort: options.allowSort || true,
          allowAutoFilter: options.allowAutoFilter || true,
          allowPivotTables: options.allowPivotTables || false,
          allowEditObjects: options.allowEditObjects || false,
          allowEditScenarios: options.allowEditScenarios || false
        };

        worksheet.protection.protect(protectionOptions);
        await context.sync();
      });
      return { success: true };
    } catch (error) {
      console.error('Error applying protection:', error);
      return { success: false, error: error.message };
    }
  };

  const removeWorksheetProtection = async (worksheetName) => {
    try {
      await Excel.run(async (context) => {
        const worksheet = context.workbook.worksheets.getItem(worksheetName);
        worksheet.protection.unprotect();
        await context.sync();
      });
      return { success: true };
    } catch (error) {
      console.error('Error removing protection:', error);
      return { success: false, error: error.message };
    }
  };

  const addDataValidation = async (worksheetName, range, validationType, values) => {
    try {
      await Excel.run(async (context) => {
        const worksheet = context.workbook.worksheets.getItem(worksheetName);
        const targetRange = worksheet.getRange(range);
        
        if (validationType === 'list') {
          targetRange.dataValidation.rule = {
            list: {
              inCellDropDown: true,
              source: Array.isArray(values) ? values.join(',') : values
            }
          };
        } else if (validationType === 'number') {
          targetRange.dataValidation.rule = {
            wholeNumber: {
              formula1: values.min || 0,
              formula2: values.max || 999999,
              operator: Excel.DataValidationOperator.between
            }
          };
        } else if (validationType === 'date') {
          targetRange.dataValidation.rule = {
            date: {
              formula1: values.startDate || new Date(),
              formula2: values.endDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
              operator: Excel.DataValidationOperator.between
            }
          };
        }
        
        await context.sync();
      });
      return { success: true };
    } catch (error) {
      console.error('Error adding data validation:', error);
      return { success: false, error: error.message };
    }
  };

  // ======================================
  // RIBBON COMMAND FUNCTIONS
  // ======================================

  const openQuickAccess = (event) => {
    try {
      logFunction('openQuickAccess');
      ensureOfficeReady();
      
      showNotification(
        'Quick Access', 
        'Opening Proposal Management Quick Access panel...',
        'information'
      );
      
      // The taskpane should be available via the manifest
      // This command ensures it's visible
      
      if (event) {
        event.completed();
      }
    } catch (error) {
      console.error('Error opening quick access:', error);
      showNotification('Error', `Failed to open quick access: ${error.message}`, 'error');
      if (event) {
        event.completed();
      }
    }
  };

  const openFullDashboard = (event) => {
    try {
      logFunction('openFullDashboard');
      ensureOfficeReady();
      
      // Open fullscreen dashboard in new window
      const dashboardUrl = `${window.location.origin}/fullscreen.html`;
      window.open(dashboardUrl, '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes');
      
      showNotification(
        'Full Dashboard', 
        'Opening complete proposal management dashboard...',
        'success'
      );
      
      if (event) {
        event.completed();
      }
    } catch (error) {
      console.error('Error opening full dashboard:', error);
      showNotification('Error', `Failed to open dashboard: ${error.message}`, 'error');
      if (event) {
        event.completed();
      }
    }
  };

  const syncData = async (event) => {
    try {
      logFunction('syncData');
      ensureOfficeReady();
      
      showNotification(
        'Sync in Progress', 
        'Synchronizing data with server...',
        'information'
      );

      // Make API call to sync data
      const response = await apiCall('/excel/sync', {
        method: 'POST',
        body: JSON.stringify({
          action: 'full_sync',
          timestamp: new Date().toISOString()
        })
      });

      if (response.success) {
        showNotification(
          'Sync Complete', 
          'Data synchronized successfully!',
          'success'
        );
      } else {
        throw new Error(response.message || 'Sync failed');
      }

      if (event) {
        event.completed();
      }
    } catch (error) {
      console.error('Error syncing data:', error);
      showNotification('Sync Error', `Failed to sync data: ${error.message}`, 'error');
      if (event) {
        event.completed();
      }
    }
  };

  const protectWorkbook = async (event) => {
    try {
      logFunction('protectWorkbook');
      ensureOfficeReady();

      showNotification(
        'Protection', 
        'Applying workbook protection...',
        'information'
      );

      const worksheetNames = await getWorksheetNames();
      const protectionOptions = {
        allowFormatCells: false,
        allowFormatColumns: false,
        allowFormatRows: false,
        allowInsertColumns: false,
        allowInsertRows: false,
        allowInsertHyperlinks: false,
        allowDeleteColumns: false,
        allowDeleteRows: false,
        allowSort: true,
        allowAutoFilter: true,
        allowPivotTables: false,
        allowEditObjects: false,
        allowEditScenarios: false
      };

      let successCount = 0;
      for (const sheetName of worksheetNames) {
        const result = await applyWorksheetProtection(sheetName, protectionOptions);
        if (result.success) {
          successCount++;
        }
      }

      // Update server about protection status
      try {
        await apiCall('/excel/lock', {
          method: 'POST',
          body: JSON.stringify({
            protectionLevel: 'read-only',
            protectedSheets: successCount
          })
        });
      } catch (apiError) {
        console.warn('Failed to update server about protection status:', apiError);
      }

      showNotification(
        'Protection Applied', 
        `Protected ${successCount} of ${worksheetNames.length} worksheets`,
        'success'
      );

      if (event) {
        event.completed();
      }
    } catch (error) {
      console.error('Error protecting workbook:', error);
      showNotification('Protection Error', `Failed to protect workbook: ${error.message}`, 'error');
      if (event) {
        event.completed();
      }
    }
  };

  const unprotectWorkbook = async (event) => {
    try {
      logFunction('unprotectWorkbook');
      ensureOfficeReady();

      showNotification(
        'Removing Protection', 
        'Removing workbook protection...',
        'information'
      );

      const worksheetNames = await getWorksheetNames();
      let successCount = 0;

      for (const sheetName of worksheetNames) {
        const result = await removeWorksheetProtection(sheetName);
        if (result.success) {
          successCount++;
        }
      }

      // Update server about protection status
      try {
        await apiCall('/excel/unlock', {
          method: 'POST',
          body: JSON.stringify({
            unprotectedSheets: successCount
          })
        });
      } catch (apiError) {
        console.warn('Failed to update server about protection status:', apiError);
      }

      showNotification(
        'Protection Removed', 
        `Unprotected ${successCount} of ${worksheetNames.length} worksheets`,
        'success'
      );

      if (event) {
        event.completed();
      }
    } catch (error) {
      console.error('Error unprotecting workbook:', error);
      showNotification('Unprotection Error', `Failed to unprotect workbook: ${error.message}`, 'error');
      if (event) {
        event.completed();
      }
    }
  };

  const addValidationRules = async (event) => {
    try {
      logFunction('addValidationRules');
      ensureOfficeReady();

      showNotification(
        'Data Validation', 
        'Adding data validation rules...',
        'information'
      );

      // Define validation rules for different sheets
      const validationRules = [
        {
          sheet: config.worksheetNames.proposals,
          range: 'AO:AO', // proposal_status column
          type: 'list',
          values: ['pending', 'approved', 'rejected', 'resubmit']
        },
        {
          sheet: config.worksheetNames.users,
          range: 'D:D', // role column
          type: 'list',
          values: ['specialist', 'implementing_partner']
        },
        {
          sheet: config.worksheetNames.budget,
          range: 'F:F', // quantity column
          type: 'number',
          values: { min: 1, max: 9999 }
        },
        {
          sheet: config.worksheetNames.budget,
          range: 'G:G', // frequency column
          type: 'number',
          values: { min: 1, max: 365 }
        },
        {
          sheet: config.worksheetNames.proposals,
          range: 'AS:AS', // proposal_priority column
          type: 'list',
          values: ['low', 'medium', 'high']
        }
      ];

      let successCount = 0;
      for (const rule of validationRules) {
        try {
          const result = await addDataValidation(rule.sheet, rule.range, rule.type, rule.values);
          if (result.success) {
            successCount++;
          }
        } catch (ruleError) {
          console.warn(`Failed to apply validation rule for ${rule.sheet}:${rule.range}`, ruleError);
        }
      }

      showNotification(
        'Validation Applied', 
        `Applied ${successCount} of ${validationRules.length} validation rules`,
        'success'
      );

      if (event) {
        event.completed();
      }
    } catch (error) {
      console.error('Error adding validation rules:', error);
      showNotification('Validation Error', `Failed to add validation rules: ${error.message}`, 'error');
      if (event) {
        event.completed();
      }
    }
  };

  const exportData = async (event) => {
    try {
      logFunction('exportData');
      ensureOfficeReady();

      showNotification(
        'Export', 
        'Preparing data export...',
        'information'
      );

      // Get workbook data
      const worksheetNames = await getWorksheetNames();
      
      // Make API call to export data
      const response = await apiCall('/excel/export/xlsx', {
        method: 'GET'
      });

      if (response.success) {
        showNotification(
          'Export Ready', 
          `Export prepared for ${worksheetNames.length} worksheets. Check your downloads.`,
          'success'
        );
      } else {
        throw new Error(response.message || 'Export failed');
      }

      if (event) {
        event.completed();
      }
    } catch (error) {
      console.error('Error exporting data:', error);
      showNotification('Export Error', `Failed to export data: ${error.message}`, 'error');
      if (event) {
        event.completed();
      }
    }
  };

  const initializeSystem = async (event) => {
    try {
      logFunction('initializeSystem');
      ensureOfficeReady();

      showNotification(
        'Initialization', 
        'Initializing proposal management system...',
        'information'
      );

      // Make API call to initialize system
      const response = await apiCall('/initialize', {
        method: 'POST',
        body: JSON.stringify({
          createSampleData: true,
          setupValidation: true
        })
      });

      if (response.success) {
        showNotification(
          'System Ready', 
          'Proposal management system initialized successfully!',
          'success'
        );
      } else {
        throw new Error(response.message || 'Initialization failed');
      }

      if (event) {
        event.completed();
      }
    } catch (error) {
      console.error('Error initializing system:', error);
      showNotification('Initialization Error', `Failed to initialize system: ${error.message}`, 'error');
      if (event) {
        event.completed();
      }
    }
  };

  const backupData = async (event) => {
    try {
      logFunction('backupData');
      ensureOfficeReady();

      showNotification(
        'Backup', 
        'Creating data backup...',
        'information'
      );

      // Make API call to create backup
      const response = await apiCall('/excel/backup', {
        method: 'POST',
        body: JSON.stringify({
          includeAllSheets: true,
          timestamp: new Date().toISOString()
        })
      });

      if (response.success) {
        showNotification(
          'Backup Complete', 
          'Data backup created successfully!',
          'success'
        );
      } else {
        throw new Error(response.message || 'Backup failed');
      }

      if (event) {
        event.completed();
      }
    } catch (error) {
      console.error('Error backing up data:', error);
      showNotification('Backup Error', `Failed to create backup: ${error.message}`, 'error');
      if (event) {
        event.completed();
      }
    }
  };

  // ======================================
  // OFFICE FUNCTION REGISTRATION
  // ======================================

  const registerOfficeFunctions = () => {
    if (typeof Office !== 'undefined') {
      // Ensure Office.actions object exists
      Office.actions = Office.actions || {};
      
      // Register all functions that can be called from ribbon buttons
      Office.actions.openQuickAccess = openQuickAccess;
      Office.actions.openFullDashboard = openFullDashboard;
      Office.actions.syncData = syncData;
      Office.actions.exportData = exportData;
      Office.actions.backupData = backupData;
      Office.actions.protectWorkbook = protectWorkbook;
      Office.actions.unprotectWorkbook = unprotectWorkbook;
      Office.actions.addValidationRules = addValidationRules;
      Office.actions.initializeSystem = initializeSystem;
      
      console.log('✅ All Office ribbon functions registered successfully');
      
      if (debugMode) {
        // Add test function for debugging
        Office.actions.testFunctionFile = () => {
          console.log('🧪 Function file test executed successfully');
          showNotification('Test', 'Function file is working correctly!', 'success');
        };
        
        // Make test function available globally for debugging
        window.testFunctionFile = Office.actions.testFunctionFile;
      }
    } else {
      console.warn('Office.js not available - functions not registered');
    }
  };

  // ======================================
  // ERROR HANDLING
  // ======================================

  const setupErrorHandling = () => {
    // Global error handler for function file
    window.addEventListener('error', (event) => {
      console.error('Global error in function file:', event.error);
      
      if (debugMode) {
        showNotification(
          'Function File Error',
          `Error: ${event.error.message}`,
          'error'
        );
      }
    });

    // Unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection in function file:', event.reason);
      event.preventDefault();
      
      if (debugMode) {
        showNotification(
          'Promise Rejection',
          `Unhandled rejection: ${event.reason}`,
          'error'
        );
      }
    });
  };

  // ======================================
  // INITIALIZATION AND SETUP
  // ======================================

  const initialize = async () => {
    try {
      console.log('🔧 Initializing function file...');
      
      // Setup error handling
      setupErrorHandling();
      
      // Initialize Office
      const officeReady = await initializeOffice();
      
      if (officeReady) {
        // Register Office functions
        registerOfficeFunctions();
        
        console.log('✅ Function file initialized successfully');
      } else {
        console.warn('⚠️ Office not available, some functions may not work');
      }
      
    } catch (error) {
      console.error('❌ Function file initialization failed:', error);
    }
  };

  // ======================================
  // AUTO-INITIALIZATION
  // ======================================

  // Initialize when script loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

  // Also initialize on Office ready (backup)
  if (typeof Office !== 'undefined') {
    Office.onReady(initialize);
  }

  // ======================================
  // EXPORTS (IF NEEDED)
  // ======================================

  // Export functions for potential external use
  window.FunctionFile = {
    openQuickAccess,
    openFullDashboard,
    syncData,
    protectWorkbook,
    unprotectWorkbook,
    addValidationRules,
    exportData,
    initializeSystem,
    backupData,
    isOfficeReady: () => isOfficeInitialized,
    getContext: () => currentContext,
    config
  };

  console.log('📄 Function file script loaded');

})();