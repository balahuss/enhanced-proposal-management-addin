// ======================================
// APP.JS - MAIN APPLICATION JAVASCRIPT
// ======================================

// Global application state and utilities
window.ProposalApp = {
  // Application configuration
  config: {
    apiBaseUrl: process.env.NODE_ENV === 'production' 
      ? 'https://localhost:3001/api' 
      : 'http://localhost:3001/api',
    refreshInterval: 30000, // 30 seconds
    debounceDelay: 300,
    maxRetries: 3,
    retryDelay: 1000
  },

  // Global state
  state: {
    isInitialized: false,
    isLoggedIn: false,
    currentUser: null,
    isLoading: false,
    lastSync: null,
    connectionStatus: 'disconnected',
    officeContext: null
  },

  // Event handlers registry
  handlers: new Map(),

  // ======================================
  // INITIALIZATION
  // ======================================

  async init() {
    console.log('🚀 Initializing ProposalApp...');
    
    try {
      this.setupGlobalErrorHandling();
      this.setupPeriodicSync();
      
      // Initialize Office integration if available
      await this.initializeOfficeIntegration();
      
      this.state.isInitialized = true;
      
      console.log('✅ ProposalApp initialized successfully');
      
      // Emit app ready event
      this.emit('app:ready');
      
    } catch (error) {
      console.error('❌ Failed to initialize ProposalApp:', error);
      this.emit('app:error', { error });
    }
  },

  async initializeOfficeIntegration() {
    try {
      if (typeof Office !== 'undefined') {
        return new Promise((resolve) => {
          Office.onReady((info) => {
            this.state.officeContext = info;
            console.log('📊 Office integration ready:', info);
            this.emit('office:ready', info);
            resolve(info);
          });
        });
      } else {
        console.warn('Office.js not available - running in standalone mode');
      }
    } catch (error) {
      console.warn('Office integration failed:', error);
    }
  },

  // ======================================
  // EVENT SYSTEM
  // ======================================

  on(eventName, handler) {
    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, []);
    }
    this.handlers.get(eventName).push(handler);
  },

  off(eventName, handler) {
    if (this.handlers.has(eventName)) {
      const handlers = this.handlers.get(eventName);
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  },

  emit(eventName, data = {}) {
    if (this.handlers.has(eventName)) {
      this.handlers.get(eventName).forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in event handler for ${eventName}:`, error);
        }
      });
    }
  },

  // ======================================
  // API UTILITIES
  // ======================================

  async apiCall(endpoint, options = {}) {
    const url = `${this.config.apiBaseUrl}${endpoint}`;
    
    const defaultOptions = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      credentials: 'include'
    };

    const mergedOptions = { ...defaultOptions, ...options };
    
    let retries = 0;
    
    while (retries < this.config.maxRetries) {
      try {
        const response = await fetch(url, mergedOptions);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        this.updateConnectionStatus('connected');
        return data;
        
      } catch (error) {
        retries++;
        console.warn(`API call attempt ${retries} failed:`, error);
        
        if (retries >= this.config.maxRetries) {
          this.updateConnectionStatus('error');
          throw new Error(`API call failed after ${retries} attempts: ${error.message}`);
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * retries));
      }
    }
  },

  // ======================================
  // AUTHENTICATION UTILITIES
  // ======================================

  async checkAuthStatus() {
    try {
      const response = await this.apiCall('/auth/status');
      
      if (response.success && response.authenticated) {
        this.state.isLoggedIn = true;
        this.state.currentUser = response.user;
        this.emit('auth:login', { user: response.user });
        return true;
      } else {
        this.state.isLoggedIn = false;
        this.state.currentUser = null;
        this.emit('auth:logout');
        return false;
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      this.state.isLoggedIn = false;
      this.state.currentUser = null;
      this.emit('auth:error', { error });
      return false;
    }
  },

  async login(username, password) {
    try {
      const response = await this.apiCall('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });

      if (response.success) {
        this.state.isLoggedIn = true;
        this.state.currentUser = response.user;
        this.emit('auth:login', { user: response.user });
        return { success: true, user: response.user };
      } else {
        this.emit('auth:loginFailed', { message: response.message });
        return { success: false, message: response.message };
      }
    } catch (error) {
      console.error('Login error:', error);
      this.emit('auth:error', { error });
      return { success: false, message: error.message };
    }
  },

  async logout() {
    try {
      await this.apiCall('/auth/logout', { method: 'POST' });
    } catch (error) {
      console.warn('Logout API call failed:', error);
    } finally {
      this.state.isLoggedIn = false;
      this.state.currentUser = null;
      this.emit('auth:logout');
    }
  },

  // ======================================
  // CONNECTION STATUS
  // ======================================

  updateConnectionStatus(status) {
    const previousStatus = this.state.connectionStatus;
    this.state.connectionStatus = status;
    
    if (previousStatus !== status) {
      this.emit('connection:statusChanged', { 
        status, 
        previousStatus,
        timestamp: new Date().toISOString()
      });
    }
  },

  // ======================================
  // PERIODIC SYNC
  // ======================================

  setupPeriodicSync() {
    setInterval(async () => {
      if (this.state.isLoggedIn) {
        try {
          await this.syncData();
        } catch (error) {
          console.warn('Periodic sync failed:', error);
        }
      }
    }, this.config.refreshInterval);
  },

  async syncData() {
    try {
      this.emit('sync:start');
      
      // Basic health check
      const response = await this.apiCall('/health');
      
      if (response.status === 'OK') {
        this.state.lastSync = new Date().toISOString();
        this.emit('sync:success', { timestamp: this.state.lastSync });
      } else {
        this.emit('sync:error', { error: 'Health check failed' });
      }
    } catch (error) {
      console.error('Sync error:', error);
      this.emit('sync:error', { error });
    }
  },

  // ======================================
  // OFFICE INTEGRATION UTILITIES
  // ======================================

  async syncWithExcel() {
    try {
      this.emit('excel:syncStart');
      
      const response = await this.apiCall('/excel/sync', {
        method: 'POST',
        body: JSON.stringify({
          action: 'full_sync',
          timestamp: new Date().toISOString()
        })
      });

      if (response.success) {
        this.emit('excel:syncSuccess', response);
        return response;
      } else {
        throw new Error(response.message || 'Excel sync failed');
      }
    } catch (error) {
      console.error('Excel sync error:', error);
      this.emit('excel:syncError', { error });
      throw error;
    }
  },

  async protectWorkbook() {
    try {
      const response = await this.apiCall('/excel/lock', {
        method: 'POST',
        body: JSON.stringify({
          protectionLevel: 'read-only'
        })
      });

      if (response.success) {
        this.emit('excel:protected', response);
        return response;
      } else {
        throw new Error(response.message || 'Workbook protection failed');
      }
    } catch (error) {
      console.error('Workbook protection error:', error);
      this.emit('excel:protectionError', { error });
      throw error;
    }
  },

  async unprotectWorkbook() {
    try {
      const response = await this.apiCall('/excel/unlock', {
        method: 'POST'
      });

      if (response.success) {
        this.emit('excel:unprotected', response);
        return response;
      } else {
        throw new Error(response.message || 'Workbook unprotection failed');
      }
    } catch (error) {
      console.error('Workbook unprotection error:', error);
      this.emit('excel:protectionError', { error });
      throw error;
    }
  },

  // ======================================
  // ERROR HANDLING
  // ======================================

  setupGlobalErrorHandling() {
    window.addEventListener('error', (event) => {
      console.error('Global error:', event.error);
      this.emit('app:globalError', { 
        error: event.error,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection:', event.reason);
      this.emit('app:unhandledRejection', { reason: event.reason });
    });
  },

  // ======================================
  // UTILITY METHODS
  // ======================================

  formatCurrency(amount, currency = 'NGN') {
    if (typeof amount !== 'number' || isNaN(amount)) {
      return '₦0.00';
    }
    
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2
    }).format(amount);
  },

  formatDate(date, format = 'short') {
    if (!date) return '';
    
    const dateObj = date instanceof Date ? date : new Date(date);
    
    if (isNaN(dateObj.getTime())) {
      return 'Invalid Date';
    }
    
    const options = {
      short: { year: 'numeric', month: 'short', day: 'numeric' },
      long: { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      },
      time: { hour: '2-digit', minute: '2-digit' }
    };
    
    return dateObj.toLocaleDateString('en-US', options[format] || options.short);
  },

  debounce(func, delay) {
    let timeoutId;
    return function (...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
  },

  generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  // ======================================
  // LOADING STATES
  // ======================================

  showGlobalLoading(message = 'Loading...') {
    this.state.isLoading = true;
    this.emit('loading:show', { message });
  },

  hideGlobalLoading() {
    this.state.isLoading = false;
    this.emit('loading:hide');
  },

  // ======================================
  // NOTIFICATION SYSTEM
  // ======================================

  showMessage(message, type = 'info', duration = 5000) {
    this.emit('message:show', { 
      message, 
      type, 
      duration,
      id: this.generateId()
    });
  },

  showError(message, error = null) {
    console.error('App Error:', message, error);
    this.showMessage(message, 'error');
  },

  showSuccess(message) {
    this.showMessage(message, 'success');
  },

  showWarning(message) {
    this.showMessage(message, 'warning');
  },

  // ======================================
  // DATA MANAGEMENT
  // ======================================

  async getProposals(filters = {}) {
    try {
      const params = new URLSearchParams(filters);
      const response = await this.apiCall(`/proposals?${params}`);
      
      if (response.success) {
        return response.data;
      } else {
        throw new Error(response.message || 'Failed to get proposals');
      }
    } catch (error) {
      console.error('Error getting proposals:', error);
      throw error;
    }
  },

  async createProposal(proposalData) {
    try {
      const response = await this.apiCall('/proposals', {
        method: 'POST',
        body: JSON.stringify(proposalData)
      });

      if (response.success) {
        this.emit('proposal:created', response.data);
        return response.data;
      } else {
        throw new Error(response.message || 'Failed to create proposal');
      }
    } catch (error) {
      console.error('Error creating proposal:', error);
      throw error;
    }
  },

  async getBudgetItems(proposalId) {
    try {
      const response = await this.apiCall(`/budget/proposals/${proposalId}/items`);
      
      if (response.success) {
        return response.data;
      } else {
        throw new Error(response.message || 'Failed to get budget items');
      }
    } catch (error) {
      console.error('Error getting budget items:', error);
      throw error;
    }
  },

  async getCostItems(filters = {}) {
    try {
      const params = new URLSearchParams(filters);
      const response = await this.apiCall(`/budget/cost-items?${params}`);
      
      if (response.success) {
        return response.data;
      } else {
        throw new Error(response.message || 'Failed to get cost items');
      }
    } catch (error) {
      console.error('Error getting cost items:', error);
      throw error;
    }
  },

  // ======================================
  // NAVIGATION HELPERS
  // ======================================

  openFullscreen(view = 'dashboard', params = {}) {
    try {
      const baseUrl = window.location.origin + '/fullscreen.html';
      const searchParams = new URLSearchParams({ view, ...params });
      const url = `${baseUrl}?${searchParams}`;
      
      window.open(url, '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes');
    } catch (error) {
      console.error('Error opening fullscreen:', error);
      this.showError('Failed to open fullscreen view');
    }
  },

  // ======================================
  // CLEANUP
  // ======================================

  cleanup() {
    // Clear intervals and event listeners
    this.handlers.clear();
    
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
  }
};

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.ProposalApp.init();
});

// Also handle Office.onReady for Office Add-ins
if (typeof Office !== 'undefined') {
  Office.onReady(() => {
    console.log('📊 Office is ready');
    window.ProposalApp.emit('office:ready');
  });
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.ProposalApp;
}