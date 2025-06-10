const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const ExcelUtils = require('../utils/excelUtils');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// Validation schemas
const loginSchema = Joi.object({
  username: Joi.string().min(3).max(50).required(),
  password: Joi.string().min(1).required()
});

const registerSchema = Joi.object({
  fullName: Joi.string().min(2).max(100).required(),
  username: Joi.string().min(3).max(50).required(),
  password: Joi.string().min(6).max(100).required(),
  email: Joi.string().email().required(),
  phone: Joi.string().allow('').optional()
});

// Helper function to generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user.username,
      email: user.email,
      role: user.role 
    },
    process.env.JWT_SECRET || 'your-jwt-secret-change-in-production',
    { expiresIn: '24h' }
  );
};

// Helper function to find user by username
const findUserByUsername = async (username) => {
  try {
    const userData = await ExcelUtils.getSheetData('Users');
    const userRow = userData.rows.find(row => row[0] === username);
    
    if (!userRow) return null;
    
    return {
      username: userRow[0],
      password: userRow[1],
      email: userRow[2],
      role: userRow[3],
      full_name: userRow[4],
      phone: userRow[5] || '',
      created_date: userRow[6]
    };
  } catch (error) {
    console.error('Error finding user:', error);
    throw new Error('Database error');
  }
};

// Helper function to find user by email
const findUserByEmail = async (email) => {
  try {
    const userData = await ExcelUtils.getSheetData('Users');
    const userRow = userData.rows.find(row => row[2] === email);
    
    if (!userRow) return null;
    
    return {
      username: userRow[0],
      password: userRow[1],
      email: userRow[2],
      role: userRow[3],
      full_name: userRow[4],
      phone: userRow[5] || '',
      created_date: userRow[6]
    };
  } catch (error) {
    console.error('Error finding user by email:', error);
    throw new Error('Database error');
  }
};

// Login endpoint
router.post('/login', asyncHandler(async (req, res) => {
  try {
    // Validate input
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid input data',
        errors: error.details.map(detail => detail.message)
      });
    }

    const { username, password } = value;

    // Find user
    const user = await findUserByUsername(username);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password'
      });
    }

    // Verify password (assuming plain text for now, should be hashed in production)
    if (password !== user.password) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password'
      });
    }

    // Generate token
    const token = generateToken(user);

    // Store user in session
    req.session.user = {
      username: user.username,
      email: user.email,
      role: user.role,
      full_name: user.full_name,
      phone: user.phone
    };

    req.session.loginTime = new Date().toISOString();

    // Return success response
    res.json({
      success: true,
      message: 'Login successful',
      user: {
        username: user.username,
        email: user.email,
        role: user.role,
        full_name: user.full_name,
        phone: user.phone
      },
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed due to server error'
    });
  }
}));

// Logout endpoint
router.post('/logout', asyncHandler(async (req, res) => {
  try {
    // Destroy session
    req.session.destroy((err) => {
      if (err) {
        console.error('Session destruction error:', err);
        return res.status(500).json({
          success: false,
          message: 'Failed to logout properly'
        });
      }

      res.json({
        success: true,
        message: 'Logout successful'
      });
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed due to server error'
    });
  }
}));

// Get current user endpoint
router.get('/me', asyncHandler(async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated'
      });
    }

    res.json({
      success: true,
      user: req.session.user
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user information'
    });
  }
}));

// Check authentication status
router.get('/status', asyncHandler(async (req, res) => {
  try {
    const isAuthenticated = !!req.session.user;
    
    res.json({
      success: true,
      authenticated: isAuthenticated,
      user: isAuthenticated ? req.session.user : null
    });
  } catch (error) {
    console.error('Auth status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check authentication status'
    });
  }
}));

module.exports = router;