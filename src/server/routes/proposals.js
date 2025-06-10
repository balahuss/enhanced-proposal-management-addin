const express = require('express');
const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const ExcelUtils = require('../utils/excelUtils');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// Validation schemas
const proposalSchema = Joi.object({
  year: Joi.string().required(),
  field_office: Joi.string().required(),
  state: Joi.string().required(),
  outcome: Joi.string().required(),
  specialist_name: Joi.string().required(),
  specialist_email: Joi.string().email().required(),
  specialist_phone: Joi.string().allow('').optional(),
  output: Joi.string().required(),
  intervention: Joi.string().required(),
  activity: Joi.string().required(),
  activity_id: Joi.string().required(),
  ip_name: Joi.string().required(),
  ip_email: Joi.string().email().required(),
  ip_id: Joi.string().required(),
  ip_phone: Joi.string().allow('').optional(),
  micro_activity: Joi.string().required(),
  micro_activity_id: Joi.string().required(),
  timeline: Joi.string().required(),
  proposal_entry_date: Joi.date().iso().required(),
  proposal_title: Joi.string().min(5).max(200).required(),
  proposal_description: Joi.string().min(10).required(),
  proposal_objectives: Joi.string().min(10).required(),
  proposal_activities: Joi.string().min(10).required(),
  proposal_outcomes: Joi.string().min(10).required(),
  proposal_totalbudget: Joi.number().min(0).required(),
  proposal_duration: Joi.string().required(),
  proposal_startdate: Joi.date().iso().required(),
  proposal_enddate: Joi.date().iso().required(),
  proposal_location: Joi.string().required(),
  proposal_beneficiaries: Joi.string().required(),
  proposal_risks: Joi.string().allow('').optional(),
  proposal_mitigation: Joi.string().allow('').optional(),
  proposal_sustainability: Joi.string().allow('').optional(),
  proposal_monitoring: Joi.string().allow('').optional(),
  proposal_priority: Joi.string().valid('low', 'medium', 'high').default('medium')
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

// Get all proposals with pagination and filtering
router.get('/', asyncHandler(async (req, res) => {
  const { 
    page = 1, 
    pageSize = 10, 
    search = '', 
    status = '', 
    year = '',
    field_office = '',
    state = '' 
  } = req.query;

  const user = req.session.user;
  
  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'User not authenticated'
    });
  }

  try {
    const proposalData = await ExcelUtils.getSheetData('Proposals');
    
    if (!proposalData.rows || proposalData.rows.length === 0) {
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

    const headers = proposalData.headers;
    let proposals = proposalData.rows.map(row => rowToObject(row, headers));

    // Filter by user role - implementing partners see only their proposals
    if (user.role === 'implementing_partner') {
      proposals = proposals.filter(proposal => 
        proposal.ip_email === user.email || proposal.ip_id === user.username
      );
    }

    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      proposals = proposals.filter(proposal =>
        proposal.proposal_title?.toLowerCase().includes(searchLower) ||
        proposal.proposal_description?.toLowerCase().includes(searchLower) ||
        proposal.ip_name?.toLowerCase().includes(searchLower) ||
        proposal.specialist_name?.toLowerCase().includes(searchLower)
      );
    }

    // Apply status filter
    if (status) {
      proposals = proposals.filter(proposal => proposal.proposal_status === status);
    }

    // Apply year filter
    if (year) {
      proposals = proposals.filter(proposal => proposal.year === year);
    }

    // Apply field office filter
    if (field_office) {
      proposals = proposals.filter(proposal => proposal.field_office === field_office);
    }

    // Apply state filter
    if (state) {
      proposals = proposals.filter(proposal => proposal.state === state);
    }

    // Sort by creation date (newest first)
    proposals.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

    // Calculate pagination
    const total = proposals.length;
    const totalPages = Math.ceil(total / pageSize);
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + parseInt(pageSize);
    const paginatedProposals = proposals.slice(startIndex, endIndex);

    res.json({
      success: true,
      data: paginatedProposals,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total,
        totalPages
      }
    });

  } catch (error) {
    console.error('Error getting proposals:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get proposals'
    });
  }
}));

// Get proposal by ID
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = req.session.user;

  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'User not authenticated'
    });
  }

  try {
    const proposalData = await ExcelUtils.getSheetData('Proposals');
    const headers = proposalData.headers;
    const proposalIdIndex = headers.indexOf('proposal_id');
    
    const proposalRow = proposalData.rows.find(row => row[proposalIdIndex] === id);
    
    if (!proposalRow) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found'
      });
    }

    const proposal = rowToObject(proposalRow, headers);

    // Check access permissions
    if (user.role === 'implementing_partner') {
      if (proposal.ip_email !== user.email && proposal.ip_id !== user.username) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this proposal'
        });
      }
    }

    res.json({
      success: true,
      data: proposal
    });

  } catch (error) {
    console.error('Error getting proposal:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get proposal'
    });
  }
}));

// Create new proposal
router.post('/', asyncHandler(async (req, res) => {
  const user = req.session.user;
  
  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'User not authenticated'
    });
  }

  // Validate input
  const { error, value } = proposalSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Invalid proposal data',
      errors: error.details.map(detail => detail.message)
    });
  }

  try {
    // Generate unique proposal ID
    const proposalId = `PROP-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const currentDate = new Date().toISOString();

    // Get proposal headers
    const proposalData = await ExcelUtils.getSheetData('Proposals');
    const headers = proposalData.headers;

    // Create proposal object with all required fields
    const newProposal = {
      ...value,
      proposal_id: proposalId,
      proposal_status: 'pending',
      proposal_submissiondate: currentDate,
      proposal_feedback: '',
      created_date: currentDate,
      updated_date: currentDate
    };

    // Convert to row format
    const newRow = objectToRow(newProposal, headers);

    // Add to Excel sheet
    await ExcelUtils.appendRow('Proposals', newRow);

    res.status(201).json({
      success: true,
      message: 'Proposal created successfully',
      data: {
        proposal_id: proposalId,
        ...newProposal
      }
    });

  } catch (error) {
    console.error('Error creating proposal:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create proposal'
    });
  }
}));

// Get proposal statistics/summary
router.get('/stats/summary', asyncHandler(async (req, res) => {
  const user = req.session.user;
  
  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'User not authenticated'
    });
  }

  try {
    const proposalData = await ExcelUtils.getSheetData('Proposals');
    
    if (!proposalData.rows || proposalData.rows.length === 0) {
      return res.json({
        success: true,
        stats: {
          total: 0,
          pending: 0,
          approved: 0,
          rejected: 0,
          resubmit: 0,
          totalBudget: 0,
          averageBudget: 0
        }
      });
    }

    const headers = proposalData.headers;
    let proposals = proposalData.rows.map(row => rowToObject(row, headers));

    // Filter by user role
    if (user.role === 'implementing_partner') {
      proposals = proposals.filter(proposal => 
        proposal.ip_email === user.email || proposal.ip_id === user.username
      );
    }

    // Calculate statistics
    const stats = {
      total: proposals.length,
      pending: proposals.filter(p => p.proposal_status === 'pending').length,
      approved: proposals.filter(p => p.proposal_status === 'approved').length,
      rejected: proposals.filter(p => p.proposal_status === 'rejected').length,
      resubmit: proposals.filter(p => p.proposal_status === 'resubmit').length,
      totalBudget: proposals.reduce((sum, p) => sum + (parseFloat(p.proposal_totalbudget) || 0), 0),
      averageBudget: 0
    };

    if (stats.total > 0) {
      stats.averageBudget = stats.totalBudget / stats.total;
    }

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('Error getting proposal statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get proposal statistics'
    });
  }
}));

module.exports = router;