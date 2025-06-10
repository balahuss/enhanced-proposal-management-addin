// ======================================
// TASKPANE.JS - QUICK ACCESS MODE APPLICATION
// ======================================

// Taskpane application state and functionality
const TaskpaneApp = {
  // State management
  state: {
    isInitialized: false,
    isLoggedIn: false,
    currentUser: null,
    connectionStatus: 'connecting',
    protectionEnabled: false,
    syncStatus: 'ready',
    proposals: [],
    stats: {
      totalProposals: 0,
      pendingProposals: 0,
      totalBudget: 0
    },
    lastSync: null
  },

  // Configuration
  config: {
    apiBaseUrl: process.env.NODE_ENV === 'production' 
      ? 'https://localhost:3001/api' 
      : 'http://localhost:3001/api',
    syncInterval: 30000, // 30 seconds
    maxRetries: 3,
    retryDelay: 1000
  },

  // DOM elements cache
  elements: {},

  // ======================================
  // INITIALIZATION
  // ======================================

  async init() {
    console.log('🚀 Initializing Taskpane App...');
    
    try {
      // Cache DOM elements
      this.cacheElements();
      
      // Setup event listeners
      this.setupEventListeners();
      
      // Initialize Office
      await this.initializeOffice();
      
      // Check authentication
      await this.checkAuthStatus();
      
      // Setup auto-sync if logged in
      if (this.state.isLoggedIn) {
        this.setupAutoSync();
      }
      
      this.state.isInitialized = true;
      this.updateConnectionStatus('connected');
      
      console.log('✅ Taskpane App initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize Taskpane App:', error);
      this.showView('error');
      this.updateConnectionStatus('error');
    }
  },

  cacheElements() {
    this.elements = {
      // Views
      loginView: document.getElementById('login-view'),
      mainView: document.getElementById('main-view'),
      loadingView: document.getElementById('loading-view'),
      errorView: document.getElementById('error-view'),
      
      // Login form
      loginForm: document.getElementById('login-form'),
      loginMessage: document.getElementById('login-message'),
      usernameInput: document.getElementById('username'),
      passwordInput: document.getElementById('password'),
      
      // Status indicators
      connectionDot: document.getElementById('connection-dot'),
      connectionStatus: document.getElementById('connection-status'),
      protectionIndicator: document.getElementById('protection-indicator'),
      syncIndicator: document.getElementById('sync-indicator'),
      syncStatusText: document.getElementById('sync-status-text'),
      
      // Stats
      totalProposals: document.getElementById('total-proposals'),
      pendingProposals: document.getElementById('pending-proposals'),
      totalBudget: document.getElementById('total-budget'),
      
      // Recent proposals
      recentProposals: document.getElementById('recent-proposals'),
      
      // Message container
      messageContainer: document.getElementById('message-container')
    };
  },

  setupEventListeners() {
    // Login form
    if (this.elements.loginForm) {
      this.elements.loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleLogin();
      });
    }

    // Office events
    if (typeof Office !== 'undefined') {
      Office.onReady(() => {
        console.log('📊 Office is ready');
      });
    }

    // Window events
    window.addEventListener('beforeunload', () => {
      this.cleanup();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'r':
            e.preventDefault();
            this.refreshData();
            break;
          case 'n':
            e.preventDefault();
            this.newProposal();
            break;
        }
      }
    });
  },

  async initializeOffice() {
    if (typeof Office === 'undefined') {
      console.warn('Office.js not available');
      return;
    }

    return new Promise((resolve, reject) => {
      Office.onReady((info) => {
        console.log('📊 Office initialized:', info);
        resolve(info);
      }).catch(reject);
    });
  },

  // ======================================
  // AUTHENTICATION
  // ======================================

  async checkAuthStatus() {
    try {
      const response = await this.apiCall('/auth/status');
      
      if (response.success && response.authenticated) {
        this.state.isLoggedIn = true;
        this.state.currentUser = response.user;
        this.showView('main');
        await this.loadInitialData();
      } else {
        this.state.isLoggedIn = false;
        this.state.currentUser = null;
        this.showView('login');
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
      this.showView('login');
    }
  },

  async handleLogin() {
    const username = this.elements.usernameInput.value.trim();
    const password = this.elements.passwordInput.value.trim();

    if (!username || !password) {
      this.showMessage('Please enter both username and password', 'error');
      return;
    }

    try {
      this.showLoginLoading(true);
      
      const response = await this.apiCall('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });

      if (response.success) {
        this.state.isLoggedIn = true;
        this.state.currentUser = response.user;
        
        this.showMessage('Login successful!', 'success');
        this.showView('main');
        this.setupAutoSync();
        await this.loadInitialData();
        
        // Clear form
        this.elements.loginForm.reset();
      } else {
        this.showMessage(response.message || 'Login failed', 'error');
      }
    } catch (error) {
      console.error('Login error:', error);
      this.showMessage('Login failed. Please check your connection.', 'error');
    } finally {
      this.showLoginLoading(false);
    }
  },

  async logout() {
    try {
      await this.apiCall('/auth/logout', { method: 'POST' });
    } catch (error) {
      console.warn('Logout request failed:', error);
    }

    this.state.isLoggedIn = false;
    this.state.currentUser = null;
    this.cleanup();
    this.showView('login');
    this.showMessage('Logged out successfully', 'success');
  },

  showLoginLoading(show) {
    const submitBtn = this.elements.loginForm?.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = show;
      submitBtn.textContent = show ? 'Signing in...' : 'Sign In';
    }
  },

  // ======================================
  // DATA MANAGEMENT
  // ======================================

  async loadInitialData() {
    try {
      await Promise.all([
        this.loadStats(),
        this.loadRecentProposals()
      ]);
    } catch (error) {
      console.error('Error loading initial data:', error);
      this.showMessage('Error loading data', 'error');
    }
  },

  async loadStats() {
    try {
      const response = await this.apiCall('/proposals/stats/summary');
      
      if (response.success) {
        this.state.stats = response.stats;
        this.updateStatsDisplay();
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  },

  async loadRecentProposals() {
    try {
      const response = await this.apiCall('/proposals?page=1&pageSize=5');
      
      if (response.success) {
        this.state.proposals = response.data;
        this.renderRecentProposals();
      }
    } catch (error) {
      console.error('Error loading recent proposals:', error);
      this.renderRecentProposalsError();
    }
  },

  updateStatsDisplay() {
    const { total, pending, totalBudget } = this.state.stats;
    
    if (this.elements.totalProposals) {
      this.elements.totalProposals.textContent = total || '0';
    }
    
    if (this.elements.pendingProposals) {
      this.elements.pendingProposals.textContent = pending || '0';
    }
    
    if (this.elements.totalBudget) {
      this.elements.totalBudget.textContent = this.formatCurrency(totalBudget || 0);
    }
  },

  renderRecentProposals() {
    if (!this.elements.recentProposals) return;

    if (!this.state.proposals.length) {
      this.elements.recentProposals.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📝</div>
          <div class="empty-state-title">No Proposals Yet</div>
          <div class="empty-state-subtitle">Create your first proposal to get started</div>
        </div>
      `;
      return;
    }

    const html = this.state.proposals.map(proposal => `
      <div class="recent-item" onclick="TaskpaneApp.viewProposal('${proposal.proposal_id}')">
        <div class="recent-item-title">${this.escapeHtml(proposal.proposal_title)}</div>
        <div class="recent-item-meta">
          <span>${this.formatDate(proposal.proposal_submissiondate)}</span>
          <span class="status-badge status-${proposal.proposal_status}">
            ${proposal.proposal_status}
          </span>
        </div>
      </div>
    `).join('');

    this.elements.recentProposals.innerHTML = html;
  },

  renderRecentProposalsError() {
    if (!this.elements.recentProposals) return;

    this.elements.recentProposals.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <div class="empty-state-title">Error Loading</div>
        <div class="empty-state-subtitle">Unable to load recent proposals</div>
      </div>
    `;
  },

  async refreshData() {
    this.updateSyncStatus('syncing');
    this.showMessage('Refreshing data...', 'info');
    
    try {
      await this.loadInitialData();
      this.state.lastSync = new Date().toISOString();
      this.updateSyncStatus('ready');
      this.showMessage('Data refreshed successfully', 'success');
    } catch (error) {
      console.error('Error refreshing data:', error);
      this.updateSyncStatus('error');
      this.showMessage('Error refreshing data', 'error');
    }
  },

  // ======================================
  // EXCEL INTEGRATION
  // ======================================

  async syncWithExcel() {
    this.updateSyncStatus('syncing');
    this.showMessage('Syncing with Excel...', 'info');

    try {
      // Sync data with server
      const response = await this.apiCall('/excel/sync', {
        method: 'POST',
        body: JSON.stringify({
          action: 'read',
          timestamp: new Date().toISOString()
        })
      });

      if (response.success) {
        await this.refreshData();
        this.updateSyncStatus('ready');
        this.showMessage('Excel sync completed', 'success');
      } else {
        throw new Error(response.message || 'Sync failed');
      }
    } catch (error) {
      console.error('Excel sync error:', error);
      this.updateSyncStatus('error');
      this.showMessage('Excel sync failed', 'error');
    }
  },

  async toggleProtection() {
    try {
      const action = this.state.protectionEnabled ? 'unlock' : 'lock';
      
      const response = await this.apiCall(`/excel/${action}`, {
        method: 'POST',
        body: JSON.stringify({
          protectionLevel: 'read-only'
        })
      });

      if (response.success) {
        this.state.protectionEnabled = !this.state.protectionEnabled;
        this.updateProtectionIndicator();
        
        const message = this.state.protectionEnabled 
          ? 'Workbook protection enabled' 
          : 'Workbook protection disabled';
        this.showMessage(message, 'success');
      } else {
        throw new Error(response.message || 'Protection toggle failed');
      }
    } catch (error) {
      console.error('Protection toggle error:', error);
      this.showMessage('Failed to toggle protection', 'error');
    }
  },

  updateProtectionIndicator() {
    if (this.elements.protectionIndicator) {
      if (this.state.protectionEnabled) {
        this.elements.protectionIndicator.classList.add('active');
      } else {
        this.elements.protectionIndicator.classList.remove('active');
      }
    }
  },

  updateSyncStatus(status) {
    this.state.syncStatus = status;
    
    if (this.elements.syncIndicator) {
      this.elements.syncIndicator.className = `sync-indicator ${status === 'ready' ? '' : status}`;
    }
    
    if (this.elements.syncStatusText) {
      const statusText = {
        ready: 'Ready',
        syncing: 'Syncing...',
        error: 'Error'
      };
      this.elements.syncStatusText.textContent = statusText[status] || 'Ready';
    }
  },

  // ======================================
  // NAVIGATION AND ACTIONS
  // ======================================

  openFullscreen() {
    try {
      // Open the fullscreen interface
      const fullscreenUrl = window.location.origin + '/fullscreen.html';
      window.open(fullscreenUrl, '_blank', 'width=1200,height=800');
    } catch (error) {
      console.error('Error opening fullscreen:', error);
      this.showMessage('Failed to open fullscreen view', 'error');
    }
  },

  newProposal() {
    this.showMessage('Opening new proposal form...', 'info');
    this.openFullscreen();
  },

  viewProposal(proposalId) {
    this.showMessage('Opening proposal details...', 'info');
    const url = `${window.location.origin}/fullscreen.html?proposal=${proposalId}`;
    window.open(url, '_blank', 'width=1200,height=800');
  },

  showSettings() {
    this.showMessage('Opening settings...', 'info');
    // For now, redirect to fullscreen settings
    const url = `${window.location.origin}/fullscreen.html?view=settings`;
    window.open(url, '_blank', 'width=1200,height=800');
  },

  retry() {
    this.showView('loading');
    setTimeout(() => {
      this.init();
    }, 1000);
  },

  // ======================================
  // AUTO-SYNC SETUP
  // ======================================

  setupAutoSync() {
    // Clear any existing interval
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    // Setup new interval for auto-sync
    this.syncInterval = setInterval(() => {
      if (this.state.isLoggedIn && this.state.syncStatus !== 'syncing') {
        this.loadStats(); // Lightweight refresh
      }
    }, this.config.syncInterval);
  },

  cleanup() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
  },

  // ======================================
  // UI HELPERS
  // ======================================

  showView(viewName) {
    // Hide all views
    const views = ['login', 'main', 'loading', 'error'];
    views.forEach(view => {
      const element = this.elements[`${view}View`];
      if (element) {
        element.style.display = 'none';
      }
    });

    // Show requested view
    const targetView = this.elements[`${viewName}View`];
    if (targetView) {
      targetView.style.display = 'block';
    }
  },

  showMessage(message, type = 'info', duration = 3000) {
    if (!this.elements.messageContainer) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${type}`;
    messageDiv.innerHTML = `
      <span>${this.escapeHtml(message)}</span>
      <button onclick="this.parentElement.remove()" style="background: none; border: none; color: inherit; cursor: pointer; margin-left: 8px;">&times;</button>
    `;

    this.elements.messageContainer.appendChild(messageDiv);

    // Auto-remove after duration
    if (duration > 0) {
      setTimeout(() => {
        if (messageDiv.parentNode) {
          messageDiv.remove();
        }
      }, duration);
    }
  },

  updateConnectionStatus(status) {
    this.state.connectionStatus = status;
    
    if (this.elements.connectionDot) {
      this.elements.connectionDot.className = `status-dot ${status === 'connected' ? '' : 'disconnected'}`;
    }
    
    if (this.elements.connectionStatus) {
      const statusText = {
        connecting: 'Connecting...',
        connected: 'Connected',
        error: 'Connection error'
      };
      this.elements.connectionStatus.textContent = statusText[status] || 'Unknown';
    }
  },

  // ======================================
  // API AND UTILITIES
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

    const finalOptions = { ...defaultOptions, ...options };

    try {
      const response = await fetch(url, finalOptions);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`API call failed: ${endpoint}`, error);
      throw error;
    }
  },

  formatCurrency(amount) {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  },

  formatDate(dateString) {
    if (!dateString) return 'N/A';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return 'Invalid date';
    }
  },

  escapeHtml(text) {
    if (typeof text !== 'string') return '';
    
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

// ======================================
// GLOBAL EXPOSURE AND INITIALIZATION
// ======================================

// Make TaskpaneApp available globally for HTML onclick handlers
window.TaskpaneApp = TaskpaneApp;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    TaskpaneApp.init();
  });
} else {
  TaskpaneApp.init();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TaskpaneApp;
}