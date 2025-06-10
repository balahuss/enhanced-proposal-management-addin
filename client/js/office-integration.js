// ======================================
// OFFICE-INTEGRATION.JS - OFFICE.JS SPECIFIC CODE
// ======================================

// Office integration utilities and Excel-specific operations
window.OfficeIntegration = {
  // State
  state: {
    isOfficeReady: false,
    excelWorkbook: null,
    protectionEnabled: false,
    currentWorksheet: null,
    isInitialized: false,
    connectionStatus: 'disconnected'
  },

  // Configuration
  config: {
    worksheetNames: {
      proposals: 'Proposals',
      budget: 'Budget',
      costItems: 'Cost',
      users: 'Users',
      workplan: 'Workplan',
      systemConfig: 'System_Config'
    },
    protectionPassword: 'ProposalManagement2025',
    apiBaseUrl: process.env.NODE_ENV === 'production' 
      ? 'https://localhost:3001/api' 
      : 'http://localhost:3001/api'
  },

  // ======================================
  // INITIALIZATION
  // ======================================

  async init() {
    console.log('🔌 Initializing Office Integration...');
    
    try {
      if (typeof Office === 'undefined') {
        console.warn('Office.js not available - running in standalone mode');
        return false;
      }

      return new Promise((resolve) => {
        Office.onReady((info) => {
          console.log('📊 Office.onReady called:', info);
          
          this.state.isOfficeReady = true;
          this.state.isInitialized = true;
          this.state.connectionStatus = 'connected';
          
          // Check if we're in Excel
          if (info.host === Office.HostType.Excel) {
            this.setupExcelIntegration();
          }
          
          console.log('✅ Office Integration initialized');
          resolve(true);
        });
      });
    } catch (error) {
      console.error('❌ Office Integration initialization failed:', error);
      this.state.connectionStatus = 'error';
      return false;
    }
  },

  // ======================================
  // EXCEL INTEGRATION
  // ======================================

  async setupExcelIntegration() {
    try {
      await Excel.run(async (context) => {
        this.state.excelWorkbook = context.workbook;
        console.log('📋 Excel workbook context established');
      });
    } catch (error) {
      console.error('Excel integration setup failed:', error);
    }
  },

  // ======================================
  // WORKSHEET OPERATIONS
  // ======================================

  async createWorksheet(name, headers = []) {
    if (!this.state.isOfficeReady) {
      throw new Error('Office not ready');
    }

    try {
      return await Excel.run(async (context) => {
        const worksheets = context.workbook.worksheets;
        
        // Check if worksheet already exists
        let worksheet;
        try {
          worksheet = worksheets.getItem(name);
          await context.sync();
          console.log(`📋 Worksheet '${name}' already exists`);
        } catch (error) {
          // Worksheet doesn't exist, create it
          worksheet = worksheets.add(name);
          await context.sync();
          console.log(`📋 Created worksheet '${name}'`);
        }

        // Add headers if provided
        if (headers.length > 0) {
          const headerRange = worksheet.getRange(`A1:${this.getColumnLetter(headers.length)}1`);
          headerRange.values = [headers];
          headerRange.format.font.bold = true;
          headerRange.format.fill.color = '#f0f0f0';
          
          // Freeze the header row
          worksheet.freezePanes.freezeRows(1);
          
          await context.sync();
        }

        return worksheet;
      });
    } catch (error) {
      console.error(`Error creating worksheet '${name}':`, error);
      throw error;
    }
  },

  async getWorksheet(name) {
    if (!this.state.isOfficeReady) {
      throw new Error('Office not ready');
    }

    try {
      return await Excel.run(async (context) => {
        const worksheet = context.workbook.worksheets.getItem(name);
        await context.sync();
        return worksheet;
      });
    } catch (error) {
      console.error(`Error getting worksheet '${name}':`, error);
      return null;
    }
  },

  async writeDataToWorksheet(worksheetName, data, startCell = 'A1') {
    if (!this.state.isOfficeReady) {
      throw new Error('Office not ready');
    }

    try {
      return await Excel.run(async (context) => {
        const worksheet = context.workbook.worksheets.getItem(worksheetName);
        
        if (data.length > 0) {
          const endColumn = this.getColumnLetter(data[0].length);
          const endRow = data.length;
          const range = worksheet.getRange(`${startCell}:${endColumn}${endRow}`);
          range.values = data;
          await context.sync();
        }

        console.log(`📝 Data written to worksheet '${worksheetName}'`);
        return true;
      });
    } catch (error) {
      console.error(`Error writing data to worksheet '${worksheetName}':`, error);
      throw error;
    }
  },

  async readDataFromWorksheet(worksheetName, range = null) {
    if (!this.state.isOfficeReady) {
      throw new Error('Office not ready');
    }

    try {
      return await Excel.run(async (context) => {
        const worksheet = context.workbook.worksheets.getItem(worksheetName);
        
        let dataRange;
        if (range) {
          dataRange = worksheet.getRange(range);
        } else {
          dataRange = worksheet.getUsedRange();
        }
        
        dataRange.load('values');
        await context.sync();
        
        return dataRange.values;
      });
    } catch (error) {
      console.error(`Error reading data from worksheet '${worksheetName}':`, error);
      return [];
    }
  },

  // ======================================
  // DATA SYNCHRONIZATION
  // ======================================

  async syncProposalsToExcel(proposals) {
    try {
      const headers = [
        'year', 'field_office', 'state', 'outcome', 'specialist_name', 'specialist_email', 'specialist_phone',
        'output', 'intervention', 'activity', 'activity_id', 'ip_name', 'ip_email', 'ip_id', 'ip_phone',
        'micro_activity', 'micro_activity_id', 'timeline', 'proposal_entry_date', 'proposal_id', 
        'proposal_title', 'proposal_description', 'proposal_objectives', 'proposal_activities', 
        'proposal_outcomes', 'proposal_totalbudget', 'proposal_duration', 'proposal_startdate',
        'proposal_enddate', 'proposal_location', 'proposal_beneficiaries', 'proposal_risks', 
        'proposal_mitigation', 'proposal_sustainability', 'proposal_monitoring', 'proposal_status', 
        'proposal_submissiondate', 'proposal_feedback', 'proposal_priority', 'created_date', 'updated_date'
      ];

      // Create or get worksheet
      await this.createWorksheet(this.config.worksheetNames.proposals, headers);

      // Convert proposals to rows
      const rows = proposals.map(proposal => 
        headers.map(header => proposal[header] || '')
      );

      // Write data (skip header row)
      if (rows.length > 0) {
        await this.writeDataToWorksheet(
          this.config.worksheetNames.proposals, 
          rows, 
          'A2'
        );
      }

      console.log(`📊 Synchronized ${proposals.length} proposals to Excel`);
      return true;
    } catch (error) {
      console.error('Error syncing proposals to Excel:', error);
      throw error;
    }
  },

  async syncBudgetToExcel(budgetItems) {
    try {
      const headers = [
        'ip_id', 'proposal_id', 'itemname', 'itemid', 
        'unitcost', 'quantity', 'frequency', 'totalcost', 'created_date'
      ];

      await this.createWorksheet(this.config.worksheetNames.budget, headers);

      const rows = budgetItems.map(item => 
        headers.map(header => item[header] || '')
      );

      if (rows.length > 0) {
        await this.writeDataToWorksheet(
          this.config.worksheetNames.budget, 
          rows, 
          'A2'
        );
      }

      console.log(`💰 Synchronized ${budgetItems.length} budget items to Excel`);
      return true;
    } catch (error) {
      console.error('Error syncing budget to Excel:', error);
      throw error;
    }
  },

  async syncCostItemsToExcel(costItems) {
    try {
      const headers = ['itemid', 'itemname', 'unitcost', 'category', 'created_date'];

      await this.createWorksheet(this.config.worksheetNames.costItems, headers);

      const rows = costItems.map(item => 
        headers.map(header => item[header] || '')
      );

      if (rows.length > 0) {
        await this.writeDataToWorksheet(
          this.config.worksheetNames.costItems, 
          rows, 
          'A2'
        );
      }

      console.log(`🛠️ Synchronized ${costItems.length} cost items to Excel`);
      return true;
    } catch (error) {
      console.error('Error syncing cost items to Excel:', error);
      throw error;
    }
  },

  // ======================================
  // SERVER INTEGRATION
  // ======================================

  async syncWithServer() {
    try {
      console.log('🔄 Starting server sync...');
      
      // Make API call to sync with server
      const response = await fetch(`${this.config.apiBaseUrl}/excel/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          action: 'full_sync',
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`Server sync failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success) {
        console.log('✅ Server sync completed successfully');
        return result;
      } else {
        throw new Error(result.message || 'Server sync failed');
      }
    } catch (error) {
      console.error('❌ Server sync error:', error);
      throw error;
    }
  },

  // ======================================
  // WORKBOOK PROTECTION
  // ======================================

  async enableWorkbookProtection() {
    if (!this.state.isOfficeReady) {
      throw new Error('Office not ready');
    }

    try {
      return await Excel.run(async (context) => {
        const worksheets = context.workbook.worksheets;
        worksheets.load('items');
        await context.sync();

        // Protect each worksheet
        for (let i = 0; i < worksheets.items.length; i++) {
          const worksheet = worksheets.items[i];
          
          // Allow specific operations while protecting structure
          const protectionOptions = {
            allowAutoFilter: true,
            allowDeleteColumns: false,
            allowDeleteRows: false,
            allowFormatCells: true,
            allowFormatColumns: true,
            allowFormatRows: true,
            allowInsertColumns: false,
            allowInsertHyperlinks: false,
            allowInsertRows: false,
            allowPivotTables: false,
            allowSort: true
          };

          worksheet.protection.protect(protectionOptions);
        }

        await context.sync();
        this.state.protectionEnabled = true;
        console.log('🔒 Workbook protection enabled');
        return true;
      });
    } catch (error) {
      console.error('Error enabling workbook protection:', error);
      throw error;
    }
  },

  async disableWorkbookProtection() {
    if (!this.state.isOfficeReady) {
      throw new Error('Office not ready');
    }

    try {
      return await Excel.run(async (context) => {
        const worksheets = context.workbook.worksheets;
        worksheets.load('items');
        await context.sync();

        // Unprotect each worksheet
        for (let i = 0; i < worksheets.items.length; i++) {
          const worksheet = worksheets.items[i];
          if (worksheet.protection.protected) {
            worksheet.protection.unprotect();
          }
        }

        await context.sync();
        this.state.protectionEnabled = false;
        console.log('🔓 Workbook protection disabled');
        return true;
      });
    } catch (error) {
      console.error('Error disabling workbook protection:', error);
      throw error;
    }
  },

  // ======================================
  // UTILITY FUNCTIONS
  // ======================================

  getColumnLetter(columnNumber) {
    let letter = '';
    while (columnNumber > 0) {
      columnNumber--;
      letter = String.fromCharCode(65 + (columnNumber % 26)) + letter;
      columnNumber = Math.floor(columnNumber / 26);
    }
    return letter;
  },

  async insertProposalFromForm(proposalData) {
    try {
      const headers = [
        proposalData.year || '',
        proposalData.field_office || '',
        proposalData.state || '',
        proposalData.outcome || '',
        proposalData.specialist_name || '',
        proposalData.specialist_email || '',
        proposalData.specialist_phone || '',
        proposalData.output || '',
        proposalData.intervention || '',
        proposalData.activity || '',
        proposalData.activity_id || '',
        proposalData.ip_name || '',
        proposalData.ip_email || '',
        proposalData.ip_id || '',
        proposalData.ip_phone || '',
        proposalData.micro_activity || '',
        proposalData.micro_activity_id || '',
        proposalData.timeline || '',
        proposalData.proposal_entry_date || new Date().toISOString(),
        proposalData.proposal_id || this.generateProposalId(),
        proposalData.proposal_title || '',
        proposalData.proposal_description || '',
        proposalData.proposal_objectives || '',
        proposalData.proposal_activities || '',
        proposalData.proposal_outcomes || '',
        proposalData.proposal_totalbudget || 0,
        proposalData.proposal_duration || '',
        proposalData.proposal_startdate || '',
        proposalData.proposal_enddate || '',
        proposalData.proposal_location || '',
        proposalData.proposal_beneficiaries || '',
        proposalData.proposal_risks || '',
        proposalData.proposal_mitigation || '',
        proposalData.proposal_sustainability || '',
        proposalData.proposal_monitoring || '',
        'pending', // default status
        new Date().toISOString(), // submission date
        '', // feedback
        'medium', // default priority
        new Date().toISOString(), // created date
        new Date().toISOString()  // updated date
      ];

      await this.appendRowToWorksheet(this.config.worksheetNames.proposals, headers);
      
      console.log('📝 Proposal inserted into Excel');
      return { success: true, proposalId: headers[19] }; // proposal_id is at index 19
    } catch (error) {
      console.error('Error inserting proposal:', error);
      throw error;
    }
  },

  async appendRowToWorksheet(worksheetName, rowData) {
    if (!this.state.isOfficeReady) {
      throw new Error('Office not ready');
    }

    try {
      return await Excel.run(async (context) => {
        const worksheet = context.workbook.worksheets.getItem(worksheetName);
        const usedRange = worksheet.getUsedRange();
        usedRange.load('rowCount');
        await context.sync();

        const newRowIndex = usedRange.rowCount + 1;
        const newRowRange = worksheet.getRange(`A${newRowIndex}:${this.getColumnLetter(rowData.length)}${newRowIndex}`);
        newRowRange.values = [rowData];
        
        await context.sync();
        console.log(`📝 Row appended to worksheet '${worksheetName}'`);
        return newRowIndex;
      });
    } catch (error) {
      console.error(`Error appending row to worksheet '${worksheetName}':`, error);
      throw error;
    }
  },

  generateProposalId() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const time = String(now.getTime()).slice(-4);
    return `PROP-${year}${month}${day}-${time}`;
  },

  // ======================================
  // EVENT HANDLERS
  // ======================================

  onWorksheetChanged(handler) {
    if (!this.state.isOfficeReady) return;

    Excel.run(async (context) => {
      const worksheets = context.workbook.worksheets;
      worksheets.onChanged.add(handler);
      await context.sync();
    });
  },

  onWorksheetAdded(handler) {
    if (!this.state.isOfficeReady) return;

    Excel.run(async (context) => {
      const worksheets = context.workbook.worksheets;
      worksheets.onAdded.add(handler);
      await context.sync();
    });
  },

  // ======================================
  // STATUS AND DIAGNOSTICS
  // ======================================

  isReady() {
    return this.state.isOfficeReady && this.state.isInitialized;
  },

  getOfficeInfo() {
    if (typeof Office !== 'undefined' && Office.context) {
      return {
        host: Office.context.host,
        platform: Office.context.platform,
        version: Office.context.version,
        isReady: this.state.isOfficeReady
      };
    }
    return null;
  },

  getConnectionStatus() {
    return this.state.connectionStatus;
  },

  async getWorkbookInfo() {
    if (!this.state.isOfficeReady) {
      return null;
    }

    try {
      return await Excel.run(async (context) => {
        const workbook = context.workbook;
        const worksheets = workbook.worksheets;
        worksheets.load('items/name');
        await context.sync();

        const sheetInfo = {};
        for (const worksheet of worksheets.items) {
          try {
            const usedRange = worksheet.getUsedRange();
            usedRange.load('rowCount,columnCount');
            await context.sync();
            
            sheetInfo[worksheet.name] = {
              rows: usedRange.rowCount || 0,
              columns: usedRange.columnCount || 0
            };
          } catch (error) {
            sheetInfo[worksheet.name] = {
              rows: 0,
              columns: 0,
              error: 'Unable to read range'
            };
          }
        }

        return {
          sheets: worksheets.items.length,
          sheetNames: worksheets.items.map(ws => ws.name),
          details: sheetInfo,
          protectionEnabled: this.state.protectionEnabled
        };
      });
    } catch (error) {
      console.error('Error getting workbook info:', error);
      return null;
    }
  }
};

// Auto-initialize when Office is ready
if (typeof Office !== 'undefined') {
  Office.onReady(() => {
    window.OfficeIntegration.init();
  });
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.OfficeIntegration;
}