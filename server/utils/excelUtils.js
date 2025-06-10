// ======================================
// EXCEL UTILITIES - ENHANCED WORKBOOK MANAGEMENT
// ======================================

const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs').promises;

class ExcelUtils {
  constructor() {
    this.workbookPath = path.join(__dirname, '../../../data/proposal_management.xlsx');
    this.workbook = null;
  }

  // Initialize workbook with all required sheets
  async initializeWorkbook() {
    try {
      console.log('🔧 Initializing Excel workbook...');
      
      // Ensure data directory exists
      await this.ensureDirectoryExists(path.dirname(this.workbookPath));
      
      // Check if workbook exists
      const workbookExists = await this.fileExists(this.workbookPath);
      
      if (!workbookExists) {
        console.log('📝 Creating new workbook...');
        await this.createNewWorkbook();
      } else {
        console.log('📖 Loading existing workbook...');
        await this.loadWorkbook();
      }
      
      // Verify all required sheets exist
      await this.ensureRequiredSheets();
      
      // Initialize with sample data if sheets are empty
      await this.initializeSampleData();
      
      // Save workbook
      await this.saveWorkbook();
      
      console.log('✅ Workbook initialization complete');
      
      return {
        success: true,
        message: 'Workbook initialized successfully',
        path: this.workbookPath,
        sheets: this.getSheetNames()
      };
      
    } catch (error) {
      console.error('❌ Workbook initialization failed:', error);
      throw new Error(`Failed to initialize workbook: ${error.message}`);
    }
  }

  // Create new workbook with basic structure
  async createNewWorkbook() {
    this.workbook = XLSX.utils.book_new();
    
    // Define sheet structures
    const sheets = {
      'Users': [
        ['username', 'password', 'email', 'role', 'full_name', 'phone', 'created_date']
      ],
      'Proposals': this.getProposalHeaders(),
      'Budget': [
        ['ip_id', 'proposal_id', 'itemname', 'itemid', 'unitcost', 'quantity', 'frequency', 'totalcost', 'created_date']
      ],
      'Cost': [
        ['itemid', 'itemname', 'unitcost', 'category', 'created_date']
      ],
      'Workplan': [
        ['year', 'field_office', 'state', 'outcome', 'specialist_name', 'specialist_email', 'specialist_phone', 'output', 'intervention', 'activity', 'activity_id', 'micro_activity', 'micro_activity_id']
      ],
      'System_Config': [
        ['config_key', 'config_value', 'description', 'updated_date']
      ]
    };

    // Create worksheets
    Object.entries(sheets).forEach(([sheetName, headers]) => {
      const worksheet = XLSX.utils.aoa_to_sheet([headers]);
      XLSX.utils.book_append_sheet(this.workbook, worksheet, sheetName);
    });
  }

  // Load existing workbook
  async loadWorkbook() {
    const buffer = await fs.readFile(this.workbookPath);
    this.workbook = XLSX.read(buffer, { type: 'buffer' });
  }

  // Save workbook to file
  async saveWorkbook() {
    if (!this.workbook) {
      throw new Error('No workbook to save');
    }
    
    const buffer = XLSX.write(this.workbook, { type: 'buffer', bookType: 'xlsx' });
    await fs.writeFile(this.workbookPath, buffer);
  }

  // Get data from a specific sheet
  async getSheetData(sheetName) {
    try {
      if (!this.workbook) {
        await this.loadWorkbook();
      }

      const worksheet = this.workbook.Sheets[sheetName];
      if (!worksheet) {
        throw new Error(`Sheet '${sheetName}' not found`);
      }

      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      if (data.length === 0) {
        return { headers: [], rows: [] };
      }

      const headers = data[0];
      const rows = data.slice(1);

      return { headers, rows };
    } catch (error) {
      console.error(`Error reading sheet '${sheetName}':`, error);
      throw error;
    }
  }

  // Append row to sheet
  async appendRow(sheetName, rowData) {
    try {
      if (!this.workbook) {
        await this.loadWorkbook();
      }

      const worksheet = this.workbook.Sheets[sheetName];
      if (!worksheet) {
        throw new Error(`Sheet '${sheetName}' not found`);
      }

      // Get current data
      const currentData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      // Add new row
      currentData.push(rowData);
      
      // Update worksheet
      const newWorksheet = XLSX.utils.aoa_to_sheet(currentData);
      this.workbook.Sheets[sheetName] = newWorksheet;
      
      // Save workbook
      await this.saveWorkbook();
      
      return { success: true, rowNumber: currentData.length };
    } catch (error) {
      console.error(`Error appending to sheet '${sheetName}':`, error);
      throw error;
    }
  }

  // Update specific row
  async updateRow(sheetName, rowIndex, rowData) {
    try {
      if (!this.workbook) {
        await this.loadWorkbook();
      }

      const worksheet = this.workbook.Sheets[sheetName];
      if (!worksheet) {
        throw new Error(`Sheet '${sheetName}' not found`);
      }

      // Get current data
      const currentData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      if (rowIndex < 1 || rowIndex >= currentData.length) {
        throw new Error(`Invalid row index: ${rowIndex}`);
      }
      
      // Update row (rowIndex is 1-based, including header)
      currentData[rowIndex] = rowData;
      
      // Update worksheet
      const newWorksheet = XLSX.utils.aoa_to_sheet(currentData);
      this.workbook.Sheets[sheetName] = newWorksheet;
      
      // Save workbook
      await this.saveWorkbook();
      
      return { success: true };
    } catch (error) {
      console.error(`Error updating row in sheet '${sheetName}':`, error);
      throw error;
    }
  }

  // Delete row
  async deleteRow(sheetName, rowIndex) {
    try {
      if (!this.workbook) {
        await this.loadWorkbook();
      }

      const worksheet = this.workbook.Sheets[sheetName];
      if (!worksheet) {
        throw new Error(`Sheet '${sheetName}' not found`);
      }

      // Get current data
      const currentData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      if (rowIndex < 1 || rowIndex >= currentData.length) {
        throw new Error(`Invalid row index: ${rowIndex}`);
      }
      
      // Remove row (rowIndex is 1-based, including header)
      currentData.splice(rowIndex, 1);
      
      // Update worksheet
      const newWorksheet = XLSX.utils.aoa_to_sheet(currentData);
      this.workbook.Sheets[sheetName] = newWorksheet;
      
      // Save workbook
      await this.saveWorkbook();
      
      return { success: true };
    } catch (error) {
      console.error(`Error deleting row from sheet '${sheetName}':`, error);
      throw error;
    }
  }

  // Find row index by column value
  async findRowIndex(sheetName, columnName, value) {
    try {
      const { headers, rows } = await this.getSheetData(sheetName);
      const columnIndex = headers.indexOf(columnName);
      
      if (columnIndex === -1) {
        throw new Error(`Column '${columnName}' not found in sheet '${sheetName}'`);
      }
      
      for (let i = 0; i < rows.length; i++) {
        if (rows[i][columnIndex] === value) {
          return i + 1; // Return 1-based index (including header)
        }
      }
      
      return -1; // Not found
    } catch (error) {
      console.error(`Error finding row in sheet '${sheetName}':`, error);
      throw error;
    }
  }

  // Ensure required sheets exist
  async ensureRequiredSheets() {
    const requiredSheets = [
      'Users', 'Proposals', 'Budget', 'Cost', 'Workplan', 'System_Config'
    ];

    for (const sheetName of requiredSheets) {
      if (!this.workbook.Sheets[sheetName]) {
        console.log(`📋 Creating missing sheet: ${sheetName}`);
        
        let headers = [];
        switch (sheetName) {
          case 'Users':
            headers = ['username', 'password', 'email', 'role', 'full_name', 'phone', 'created_date'];
            break;
          case 'Proposals':
            headers = this.getProposalHeaders();
            break;
          case 'Budget':
            headers = ['ip_id', 'proposal_id', 'itemname', 'itemid', 'unitcost', 'quantity', 'frequency', 'totalcost', 'created_date'];
            break;
          case 'Cost':
            headers = ['itemid', 'itemname', 'unitcost', 'category', 'created_date'];
            break;
          case 'Workplan':
            headers = ['year', 'field_office', 'state', 'outcome', 'specialist_name', 'specialist_email', 'specialist_phone', 'output', 'intervention', 'activity', 'activity_id', 'micro_activity', 'micro_activity_id'];
            break;
          case 'System_Config':
            headers = ['config_key', 'config_value', 'description', 'updated_date'];
            break;
        }
        
        const worksheet = XLSX.utils.aoa_to_sheet([headers]);
        XLSX.utils.book_append_sheet(this.workbook, worksheet, sheetName);
      }
    }
  }

  // Initialize with sample data if empty
  async initializeSampleData() {
    try {
      // Check if Users sheet is empty and add default users
      const userData = await this.getSheetData('Users');
      if (userData.rows.length === 0) {
        console.log('👥 Adding default users...');
        
        const defaultUsers = [
          ['admin', 'admin123', 'admin@unicef.org', 'specialist', 'System Administrator', '+234-800-000-0001', new Date().toISOString()],
          ['specialist1', 'spec123', 'specialist1@unicef.org', 'specialist', 'Dr. Jane Smith', '+234-800-000-0002', new Date().toISOString()],
          ['partner1', 'partner123', 'partner1@ngo.org', 'implementing_partner', 'John Doe', '+234-800-000-0003', new Date().toISOString()]
        ];

        for (const user of defaultUsers) {
          await this.appendRow('Users', user);
        }
      }

      // Check if Cost sheet is empty and add sample cost items
      const costData = await this.getSheetData('Cost');
      if (costData.rows.length === 0) {
        console.log('💰 Adding sample cost items...');
        await this.populateCostItemsWithSampleData();
      }

    } catch (error) {
      console.error('Error initializing sample data:', error);
      throw new Error('Failed to initialize sample data');
    }
  }

  // Populate cost items with sample data
  async populateCostItemsWithSampleData() {
    const costItems = [
      ['ITEM-001', 'Project Manager (per day)', 125000.00, 'Personnel', new Date().toISOString()],
      ['ITEM-002', 'Technical Specialist (per day)', 150000.00, 'Personnel', new Date().toISOString()],
      ['ITEM-003', 'Field Officer (per day)', 75000.00, 'Personnel', new Date().toISOString()],
      ['ITEM-004', 'Training Materials (per set)', 22500.00, 'Materials', new Date().toISOString()],
      ['ITEM-005', 'Transportation (per trip)', 37500.00, 'Transport', new Date().toISOString()],
      ['ITEM-006', 'Accommodation (per night)', 60000.00, 'Accommodation', new Date().toISOString()],
      ['ITEM-007', 'Meeting Venue (per day)', 100000.00, 'Venue', new Date().toISOString()],
      ['ITEM-008', 'Equipment Rental (per day)', 90000.00, 'Equipment', new Date().toISOString()],
      ['ITEM-009', 'Stationery Package', 12500.00, 'Materials', new Date().toISOString()],
      ['ITEM-010', 'Communication (per month)', 25000.00, 'Communication', new Date().toISOString()]
    ];

    for (const item of costItems) {
      await this.appendRow('Cost', item);
    }
  }

  // Get proposal headers
  getProposalHeaders() {
    return [
      'year', 'field_office', 'state', 'outcome', 'specialist_name', 'specialist_email', 'specialist_phone',
      'output', 'intervention', 'activity', 'activity_id', 'ip_name', 'ip_email', 'ip_id', 'ip_phone',
      'micro_activity', 'micro_activity_id', 'timeline', 'proposal_entry_date', 'proposal_id', 'proposal_title',
      'proposal_description', 'proposal_objectives', 'proposal_activities', 'proposal_outcomes',
      'proposal_totalbudget', 'proposal_duration', 'proposal_startdate', 'proposal_enddate',
      'proposal_location', 'proposal_beneficiaries', 'proposal_risks', 'proposal_mitigation',
      'proposal_sustainability', 'proposal_monitoring', 'proposal_status', 'proposal_submissiondate',
      'proposal_feedback', 'proposal_priority', 'created_date', 'updated_date'
    ];
  }

  // Get sheet names
  getSheetNames() {
    if (!this.workbook) return [];
    return this.workbook.SheetNames;
  }

  // Check connection/workbook availability
  async checkConnection() {
    try {
      if (!this.workbook) {
        await this.loadWorkbook();
      }
      return { success: true, sheets: this.getSheetNames() };
    } catch (error) {
      throw new Error(`Excel connection failed: ${error.message}`);
    }
  }

  // Reset workbook (dangerous operation)
  async resetWorkbook() {
    try {
      console.log('⚠️ RESETTING WORKBOOK - ALL DATA WILL BE LOST');
      
      // Create new workbook
      await this.createNewWorkbook();
      
      // Initialize with sample data
      await this.initializeSampleData();
      
      // Save workbook
      await this.saveWorkbook();
      
      return {
        success: true,
        message: 'Workbook reset successfully',
        warning: 'All previous data has been lost'
      };
    } catch (error) {
      console.error('Error resetting workbook:', error);
      throw error;
    }
  }

  // Helper methods
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async ensureDirectoryExists(dirPath) {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }
}

// Export singleton instance
module.exports = new ExcelUtils();