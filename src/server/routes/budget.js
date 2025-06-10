const express = require('express');
const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');
const ExcelUtils = require('../utils/excelUtils');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// Validation schemas
const costItemSchema = Joi.object({
  itemname: Joi.string().min(2).max(200).required(),
  unitcost: Joi.number().min(0).required(),
  category: Joi.string().allow('').optional()
});

const budgetItemSchema = Joi.object({
  proposalId: Joi.string().required(),
  itemId: Joi.string().required(),
  itemName: Joi.string().required(),
  unitCost: Joi.number().min(0).required(),
  quantity: Joi.number().min(1).required(),
  frequency: Joi.number().min(1).required()
});

// Helper function to convert row to object
const rowToObject = (row, headers) => {
  const obj = {};
  headers.forEach((header, index) => {
    obj[header] = row[index] || '';
  });
  return obj;
};

// Helper function to convert object to row
const objectToRow = (obj, headers) => {
  return headers.map(header => obj[header] || '');
};

// Get all cost items with pagination
router.get('/cost-items', asyncHandler(async (req, res) => {
  const { page = 1, pageSize = 10, category = '', search = '' } = req.query;

  try {
    const costData = await ExcelUtils.getSheetData('Cost');
    
    if (!costData.rows || costData.rows.length === 0) {
      return res.json({
        success: true,
        data: [],
        pagination: {
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          total: 0,
          totalPages: 0
        }
      });
    }

    const headers = costData.headers;
    let costItems = costData.rows.map(row => rowToObject(row, headers));

    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      costItems = costItems.filter(item =>
        item.itemname?.toLowerCase().includes(searchLower) ||
        item.category?.toLowerCase().includes(searchLower)
      );
    }

    // Apply category filter
    if (category) {
      costItems = costItems.filter(item => item.category === category);
    }

    // Sort by item name
    costItems.sort((a, b) => (a.itemname || '').localeCompare(b.itemname || ''));

    // Calculate pagination
    const total = costItems.length;
    const totalPages = Math.ceil(total / pageSize);
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + parseInt(pageSize);
    const paginatedItems = costItems.slice(startIndex, endIndex);

    // Convert unit costs to numbers
    const formattedItems = paginatedItems.map(item => ({
      ...item,
      unitcost: parseFloat(item.unitcost) || 0
    }));

    res.json({
      success: true,
      data: formattedItems,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total,
        totalPages
      }
    });

  } catch (error) {
    console.error('Error getting cost items:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get cost items'
    });
  }
}));

// Add new cost item (specialist only)
router.post('/cost-items', asyncHandler(async (req, res) => {
  const user = req.session.user;
  
  if (!user || user.role !== 'specialist') {
    return res.status(403).json({
      success: false,
      message: 'Only specialists can add cost items'
    });
  }

  // Validate input
  const { error, value } = costItemSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Invalid cost item data',
      errors: error.details.map(detail => detail.message)
    });
  }

  try {
    // Generate unique item ID
    const itemId = `ITEM-${Date.now().toString().slice(-6)}`;
    const currentDate = new Date().toISOString();

    // Create new cost item row
    const newRow = [
      itemId,
      value.itemname,
      value.unitcost,
      value.category || '',
      currentDate
    ];

    // Add to Excel sheet
    await ExcelUtils.appendRow('Cost', newRow);

    const newItem = {
      itemid: itemId,
      itemname: value.itemname,
      unitcost: value.unitcost,
      category: value.category || '',
      created_date: currentDate
    };

    res.status(201).json({
      success: true,
      message: 'Cost item added successfully',
      data: newItem
    });

  } catch (error) {
    console.error('Error adding cost item:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add cost item'
    });
  }
}));

// Get budget items for a specific proposal
router.get('/proposals/:proposalId/items', asyncHandler(async (req, res) => {
  const { proposalId } = req.params;
  const user = req.session.user;

  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'User not authenticated'
    });
  }

  try {
    const budgetData = await ExcelUtils.getSheetData('Budget');
    
    if (!budgetData.rows || budgetData.rows.length === 0) {
      return res.json({
        success: true,
        data: []
      });
    }

    const headers = budgetData.headers;
    const proposalIdIndex = headers.indexOf('proposal_id');
    
    if (proposalIdIndex === -1) {
      return res.status(500).json({
        success: false,
        message: 'Budget sheet is missing the proposal_id column'
      });
    }

    // Filter budget items for this proposal
    const matchingRows = budgetData.rows.filter(row => {
      const rowProposalId = (row[proposalIdIndex] || '').toString().trim();
      return rowProposalId === proposalId.toString().trim();
    });

    // Convert to budget item objects
    const budgetItems = matchingRows.map(row => {
      const item = rowToObject(row, headers);
      
      // Ensure numeric fields are properly converted
      return {
        ...item,
        unitcost: parseFloat(item.unitcost) || 0,
        quantity: parseInt(item.quantity) || 0,
        frequency: parseInt(item.frequency) || 0,
        totalcost: parseFloat(item.totalcost) || 0
      };
    });

    res.json({
      success: true,
      data: budgetItems
    });

  } catch (error) {
    console.error('Error getting budget items:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get budget items'
    });
  }
}));

// Add budget item to proposal
router.post('/proposals/:proposalId/items', asyncHandler(async (req, res) => {
  const { proposalId } = req.params;
  const user = req.session.user;

  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'User not authenticated'
    });
  }

  // Validate input
  const budgetItemData = { ...req.body, proposalId };
  const { error, value } = budgetItemSchema.validate(budgetItemData);
  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Invalid budget item data',
      errors: error.details.map(detail => detail.message)
    });
  }

  try {
    const { itemId, itemName, unitCost, quantity, frequency } = value;
    
    const totalCost = unitCost * quantity * frequency;
    const currentDate = new Date().toISOString();

    // Create new budget item row
    const newRow = [
      user.username,     // ip_id
      proposalId,        // proposal_id
      itemName,          // itemname
      itemId,            // itemid
      unitCost,          // unitcost
      quantity,          // quantity
      frequency,         // frequency
      totalCost,         // totalcost
      currentDate        // created_date
    ];

    // Add to Excel sheet
    await ExcelUtils.appendRow('Budget', newRow);

    // Update proposal total budget
    await this.updateProposalTotal(proposalId);

    const newItem = {
      ip_id: user.username,
      proposal_id: proposalId,
      itemname: itemName,
      itemid: itemId,
      unitcost: unitCost,
      quantity: quantity,
      frequency: frequency,
      totalcost: totalCost
    };

    res.status(201).json({
      success: true,
      message: 'Budget item added successfully',
      item: newItem
    });

  } catch (error) {
    console.error('Error adding budget item:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add budget item'
    });
  }
}));

// Helper method to update proposal total budget
router.updateProposalTotal = async function(proposalId, providedTotal = null) {
  try {
    let totalBudget = providedTotal;

    // If no total provided, calculate from budget items
    if (totalBudget === null) {
      const budgetData = await ExcelUtils.getSheetData('Budget');
      const headers = budgetData.headers;
      const proposalIdIndex = headers.indexOf('proposal_id');
      const totalCostIndex = headers.indexOf('totalcost');

      const matchingRows = budgetData.rows.filter(row => 
        String(row[proposalIdIndex]) === String(proposalId)
      );

      totalBudget = matchingRows.reduce((sum, row) => {
        return sum + (parseFloat(row[totalCostIndex]) || 0);
      }, 0);
    }

    // Update proposal total
    const proposalData = await ExcelUtils.getSheetData('Proposals');
    const proposalHeaders = proposalData.headers;
    const proposalIdIndex = proposalHeaders.indexOf('proposal_id');
    const totalBudgetIndex = proposalHeaders.indexOf('proposal_totalbudget');

    let rowIndex = -1;
    for (let i = 0; i < proposalData.rows.length; i++) {
      if (proposalData.rows[i][proposalIdIndex] === proposalId) {
        rowIndex = i + 1; // +1 for header row
        break;
      }
    }

    if (rowIndex !== -1) {
      const proposalRowData = proposalData.rows[rowIndex - 1]; // -1 to get actual row
      proposalRowData[totalBudgetIndex] = totalBudget;
      proposalRowData[proposalHeaders.indexOf('updated_date')] = new Date().toISOString();
      
      await ExcelUtils.updateRow('Proposals', rowIndex, proposalRowData);
    }

    return { success: true, newTotal: totalBudget };

  } catch (error) {
    console.error('Error updating proposal total:', error);
    throw error;
  }
};

// Get budget categories
router.get('/categories', asyncHandler(async (req, res) => {
  try {
    const costData = await ExcelUtils.getSheetData('Cost');
    
    if (!costData.rows || costData.rows.length === 0) {
      return res.json({
        success: true,
        data: []
      });
    }

    const headers = costData.headers;
    const categoryIndex = headers.indexOf('category');

    if (categoryIndex === -1) {
      return res.json({
        success: true,
        data: []
      });
    }

    // Extract unique categories
    const categories = [...new Set(
      costData.rows
        .map(row => row[categoryIndex])
        .filter(category => category && category.trim())
    )].sort();

    res.json({
      success: true,
      data: categories
    });

  } catch (error) {
    console.error('Error getting budget categories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get budget categories'
    });
  }
}));

module.exports = router;