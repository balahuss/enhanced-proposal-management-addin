// ======================================
// FULLSCREEN APPLICATION - COMPLETE DASHBOARD
// ======================================

import '../styles/fullscreen.css';

// Application state management
const FullscreenApp = {
  // Core state
  state: {
    isInitialized: false,
    isLoggedIn: false,
    currentUser: null,
    currentView: 'dashboard',
    isLoading: false,
    
    // Data state
    proposals: [],
    costItems: [],
    budgetItems: [],
    stats: {},
    
    // UI state
    searchTerm: '',
    currentPage: 1,
    pageSize: 10,
    filters: {},
    selectedProposal: null,
    
    // Excel integration
    excelStatus: 'ready', // ready, syncing, error
    protectionEnabled: false
  },

  // Configuration
  config: {
    apiBaseUrl: process.env.NODE_ENV === 'production' 
      ? 'https://localhost:3001/api' 
      : 'http://localhost:3001/api',
    refreshInterval: 60000, // 1 minute
    debounceDelay: 300,
    maxRetries: 3
  },

  // DOM elements cache
  elements: {},

  // Event handlers cache
  handlers: {},

  // ======================================
  // INITIALIZATION
  // ======================================

  async init() {
    console.log('🚀 Initializing Fullscreen App...');
    
    try {
      // Show loading
      this.showLoading();
      
      // Cache DOM elements
      this.cacheElements();
      
      // Setup event handlers
      this.setupEventHandlers();
      
      // Parse URL parameters
      this.parseUrlParams();
      
      // Initialize Office integration
      await this.initializeOfficeIntegration();
      
      // Check authentication
      await this.checkAuthStatus();
      
      // Setup periodic refresh
      this.setupPeriodicRefresh();
      
      this.state.isInitialized = true;
      console.log('✅ Fullscreen App initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize Fullscreen App:', error);
      this.showError('Failed to initialize application', error.message);
    } finally {
      this.hideLoading();
    }
  },

  cacheElements() {
    this.elements = {
      // Navigation
      navTabs: document.querySelectorAll('.nav-tab'),
      
      // Views
      loginView: document.getElementById('login-view'),
      dashboardView: document.getElementById('dashboard-view'),
      proposalsView: document.getElementById('proposals-view'),
      budgetView: document.getElementById('budget-view'),
      settingsView: document.getElementById('settings-view'),
      
      // Login form
      loginForm: document.getElementById('login-form'),
      loginUsername: document.getElementById('login-username'),
      loginPassword: document.getElementById('login-password'),
      loginMessage: document.getElementById('login-message'),
      
      // Header elements
      userName: document.getElementById('user-name'),
      userRole: document.getElementById('user-role'),
      logoutBtn: document.getElementById('logout-btn'),
      excelIndicator: document.getElementById('excel-indicator'),
      excelStatusText: document.getElementById('excel-status-text'),
      
      // Dashboard stats
      statTotalProposals: document.getElementById('stat-total-proposals'),
      statPendingProposals: document.getElementById('stat-pending-proposals'),
      statApprovedProposals: document.getElementById('stat-approved-proposals'),
      statTotalBudget: document.getElementById('stat-total-budget'),
      recentActivity: document.getElementById('recent-activity'),
      
      // Proposals
      proposalsSearch: document.getElementById('proposals-search'),
      statusFilter: document.getElementById('status-filter'),
      proposalsTableContainer: document.getElementById('proposals-table-container'),
      
      // Budget
      budgetContent: document.getElementById('budget-content'),
      
      // Settings
      systemStatus: document.getElementById('system-status'),
      
      // Global elements
      loadingOverlay: document.getElementById('loading-overlay'),
      messageContainer: document.getElementById('message-container'),
      modalContainer: document.getElementById('modal-container')
    };
  },

  setupEventHandlers() {
    // Login form
    if (this.elements.loginForm) {
      this.elements.loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleLogin();
      });
    }

    // Navigation tabs
    this.elements.navTabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        const view = e.target.dataset.view;
        if (view) {
          this.showView(view);
        }
      });
    });

    // Search with debouncing
    if (this.elements.proposalsSearch) {
      this.handlers.searchDebounced = this.debounce(() => {
        this.state.searchTerm = this.elements.proposalsSearch.value;
        this.state.currentPage = 1;
        this.loadProposals();
      }, this.config.debounceDelay);

      this.elements.proposalsSearch.addEventListener('input', this.handlers.searchDebounced);
    }

    // Status filter
    if (this.elements.statusFilter) {
      this.elements.statusFilter.addEventListener('change', () => {
        this.state.filters.status = this.elements.statusFilter.value;
        this.state.currentPage = 1;
        this.loadProposals();
      });
    }

    // Office integration
    Office.onReady(() => {
      console.log('📊 Office integration ready');
      this.updateExcelStatus('ready');
    });

    // Global keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'r':
            e.preventDefault();
            this.refreshCurrentView();
            break;
          case 'n':
            if (this.state.currentView === 'proposals') {
              e.preventDefault();
              this.openNewProposalModal();
            }
            break;
          case 's':
            e.preventDefault();
            this.syncWithExcel();
            break;
        }
      }
      
      // Escape key handling
      if (e.key === 'Escape') {
        this.closeAllModals();
      }
    });

    // Window events
    window.addEventListener('beforeunload', () => {
      this.cleanup();
    });

    // Handle window resize
    window.addEventListener('resize', this.debounce(() => {
      this.handleResize();
    }, 250));
  },

  parseUrlParams() {
    const params = new URLSearchParams(window.location.search);
    
    // Check for specific proposal to view
    const proposalId = params.get('proposal');
    if (proposalId) {
      this.state.selectedProposal = proposalId;
    }
    
    // Check for specific view to show
    const view = params.get('view');
    if (view && ['dashboard', 'proposals', 'budget', 'settings'].includes(view)) {
      this.state.currentView = view;
    }
  },

  async initializeOfficeIntegration() {
    try {
      if (typeof Office !== 'undefined') {
        return new Promise((resolve) => {
          Office.onReady(() => {
            console.log('📊 Office integration initialized');
            resolve();
          });
        });
      } else {
        console.warn('Office not available - running in standalone mode');
      }
    } catch (error) {
      console.warn('Office integration failed:', error);
    }
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
        this.updateUserDisplay();
        this.showMainInterface();
        await this.loadInitialData();
      } else {
        this.showLoginView();
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      this.showLoginView();
    }
  },

  async handleLogin() {
    const username = this.elements.loginUsername.value.trim();
    const password = this.elements.loginPassword.value.trim();

    if (!username || !password) {
      this.showLoginMessage('Please enter both username and password', 'error');
      return;
    }

    try {
      this.setLoginLoading(true);
      
      const response = await this.apiCall('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });

      if (response.success) {
        this.state.isLoggedIn = true;
        this.state.currentUser = response.user;
        
        this.showLoginMessage('Login successful!', 'success');
        this.updateUserDisplay();
        this.showMainInterface();
        await this.loadInitialData();
        
        // Clear form
        this.elements.loginForm.reset();
      } else {
        this.showLoginMessage(response.message || 'Login failed', 'error');
      }
    } catch (error) {
      console.error('Login error:', error);
      this.showLoginMessage('Login failed. Please check your connection.', 'error');
    } finally {
      this.setLoginLoading(false);
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
    this.showLoginView();
    this.showMessage('Logged out successfully', 'success');
  },

  showLoginView() {
    this.hideAllViews();
    if (this.elements.loginView) {
      this.elements.loginView.style.display = 'block';
    }
    if (this.elements.logoutBtn) {
      this.elements.logoutBtn.style.display = 'none';
    }
  },

  showMainInterface() {
    this.hideAllViews();
    this.showView(this.state.currentView);
    if (this.elements.logoutBtn) {
      this.elements.logoutBtn.style.display = 'inline-block';
    }
  },

  updateUserDisplay() {
    if (this.state.currentUser) {
      if (this.elements.userName) {
        this.elements.userName.textContent = this.state.currentUser.full_name || this.state.currentUser.username;
      }
      if (this.elements.userRole) {
        this.elements.userRole.textContent = this.state.currentUser.role === 'specialist' ? 'Specialist' : 'Implementing Partner';
      }
    }
  },

  setLoginLoading(loading) {
    const submitBtn = this.elements.loginForm?.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = loading;
      submitBtn.textContent = loading ? 'Signing in...' : 'Sign In';
    }
  },

  showLoginMessage(message, type) {
    if (this.elements.loginMessage) {
      this.elements.loginMessage.innerHTML = `<div class="message message-${type}">${this.escapeHtml(message)}</div>`;
    }
  },

  // ======================================
  // VIEW MANAGEMENT
  // ======================================

  showView(viewName) {
    // Update navigation
    this.updateNavigation(viewName);
    
    // Hide all views
    this.hideAllViews();
    
    // Show target view
    const viewElement = this.elements[`${viewName}View`];
    if (viewElement) {
      viewElement.style.display = 'block';
      this.state.currentView = viewName;
      
      // Load view-specific data
      this.loadViewData(viewName);
    }
  },

  hideAllViews() {
    const views = ['login', 'dashboard', 'proposals', 'budget', 'settings'];
    views.forEach(view => {
      const element = this.elements[`${view}View`];
      if (element) {
        element.style.display = 'none';
      }
    });
  },

  updateNavigation(activeView) {
    this.elements.navTabs.forEach(tab => {
      if (tab.dataset.view === activeView) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });
  },

  async loadViewData(viewName) {
    switch (viewName) {
      case 'dashboard':
        await this.loadDashboardData();
        break;
      case 'proposals':
        await this.loadProposals();
        break;
      case 'budget':
        await this.loadBudgetData();
        break;
      case 'settings':
        await this.loadSettingsData();
        break;
    }
  },

  // ======================================
  // DASHBOARD
  // ======================================

  async loadDashboardData() {
    try {
      const [statsResponse, recentResponse] = await Promise.all([
        this.apiCall('/proposals/stats/summary'),
        this.apiCall('/proposals?page=1&pageSize=5')
      ]);

      if (statsResponse.success) {
        this.state.stats = statsResponse.stats;
        this.updateStatsDisplay();
      }

      if (recentResponse.success) {
        this.renderRecentActivity(recentResponse.data);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      this.showError('Failed to load dashboard data');
    }
  },

  updateStatsDisplay() {
    const { totalProposals, pendingProposals, approvedProposals, totalBudget } = this.state.stats;
    
    if (this.elements.statTotalProposals) {
      this.elements.statTotalProposals.textContent = totalProposals || '0';
    }
    
    if (this.elements.statPendingProposals) {
      this.elements.statPendingProposals.textContent = pendingProposals || '0';
    }
    
    if (this.elements.statApprovedProposals) {
      this.elements.statApprovedProposals.textContent = approvedProposals || '0';
    }
    
    if (this.elements.statTotalBudget) {
      this.elements.statTotalBudget.textContent = this.formatCurrency(totalBudget || 0);
    }
  },

  renderRecentActivity(proposals) {
    if (!this.elements.recentActivity) return;

    if (!proposals || !proposals.length) {
      this.elements.recentActivity.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📝</div>
          <div class="empty-state-title">No Recent Activity</div>
          <div class="empty-state-subtitle">Recent proposals will appear here</div>
        </div>
      `;
      return;
    }

    const html = `
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Proposal</th>
              <th>Status</th>
              <th>Budget</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${proposals.map(proposal => `
              <tr>
                <td>
                  <strong>${this.escapeHtml(proposal.proposal_title)}</strong>
                  <br><small style="color: #605e5c;">${this.escapeHtml(proposal.specialist_name)}</small>
                </td>
                <td>
                  <span class="status-badge status-${proposal.proposal_status}">
                    ${proposal.proposal_status}
                  </span>
                </td>
                <td class="currency">${this.formatCurrency(proposal.proposal_totalbudget)}</td>
                <td>${this.formatDate(proposal.proposal_submissiondate)}</td>
                <td>
                  <button class="btn btn-small" onclick="FullscreenApp.viewProposal('${proposal.proposal_id}')">
                    View
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    this.elements.recentActivity.innerHTML = html;
  },

  async refreshDashboard() {
    this.showMessage('Refreshing dashboard...', 'info');
    await this.loadDashboardData();
    this.showMessage('Dashboard refreshed', 'success');
  },

  // ======================================
  // PROPOSALS MANAGEMENT
  // ======================================

  async loadProposals() {
    try {
      this.showProposalsLoading();
      
      const params = new URLSearchParams({
        page: this.state.currentPage,
        pageSize: this.state.pageSize,
        search: this.state.searchTerm || '',
        status: this.state.filters.status || ''
      });

      const response = await this.apiCall(`/proposals?${params}`);
      
      if (response.success) {
        this.state.proposals = response.data;
        this.renderProposalsTable(response);
      } else {
        throw new Error(response.message || 'Failed to load proposals');
      }
    } catch (error) {
      console.error('Error loading proposals:', error);
      this.renderProposalsError(error.message);
    }
  },

  showProposalsLoading() {
    if (this.elements.proposalsTableContainer) {
      this.elements.proposalsTableContainer.innerHTML = `
        <div class="loading">
          <div class="loading-spinner"></div>
          Loading proposals...
        </div>
      `;
    }
  },

  renderProposalsTable(response) {
    if (!this.elements.proposalsTableContainer) return;

    const { data: proposals, totalCount, totalPages, currentPage } = response;

    if (!proposals || !proposals.length) {
      this.elements.proposalsTableContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📋</div>
          <div class="empty-state-title">No Proposals Found</div>
          <div class="empty-state-subtitle">
            ${this.state.searchTerm ? 'Try adjusting your search criteria' : 'Create your first proposal to get started'}
          </div>
        </div>
      `;
      return;
    }

    const canEdit = this.state.currentUser?.role !== 'specialist';
    const canReview = this.state.currentUser?.role === 'specialist';

    const html = `
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Status</th>
              <th>Budget</th>
              <th>Specialist</th>
              <th>Submitted</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${proposals.map(proposal => {
              const canEditThis = canEdit && proposal.ip_email === this.state.currentUser.email && 
                                 ['pending', 'resubmit'].includes(proposal.proposal_status);
              const canReviewThis = canReview && proposal.specialist_email === this.state.currentUser.email;
              
              return `
                <tr>
                  <td>
                    <strong>${this.escapeHtml(proposal.proposal_title)}</strong>
                    <br><small style="color: #605e5c;">${this.escapeHtml(proposal.field_office)} • ${this.escapeHtml(proposal.state)}</small>
                  </td>
                  <td>
                    <span class="status-badge status-${proposal.proposal_status}">
                      ${proposal.proposal_status}
                    </span>
                  </td>
                  <td class="currency">${this.formatCurrency(proposal.proposal_totalbudget)}</td>
                  <td>
                    ${this.escapeHtml(proposal.specialist_name)}
                    <br><small style="color: #605e5c;">${this.escapeHtml(proposal.specialist_email)}</small>
                  </td>
                  <td>${this.formatDate(proposal.proposal_submissiondate)}</td>
                  <td>
                    <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                      <button class="btn btn-small" onclick="FullscreenApp.viewProposal('${proposal.proposal_id}')">
                        👁️ View
                      </button>
                      ${canEditThis ? `
                        <button class="btn btn-success btn-small" onclick="FullscreenApp.editProposal('${proposal.proposal_id}')">
                          ✏️ Edit
                        </button>
                      ` : ''}
                      ${canReviewThis ? `
                        <button class="btn btn-warning btn-small" onclick="FullscreenApp.reviewProposal('${proposal.proposal_id}')">
                          🔍 Review
                        </button>
                      ` : ''}
                      <button class="btn btn-small" onclick="FullscreenApp.generateProposalPdf('${proposal.proposal_id}')">
                        📄 PDF
                      </button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
      
      ${this.renderPagination(totalPages, currentPage, totalCount)}
    `;

    this.elements.proposalsTableContainer.innerHTML = html;
  },

  renderPagination(totalPages, currentPage, totalCount) {
    if (totalPages <= 1) return '';

    let html = '<div class="pagination">';
    
    html += `<button onclick="FullscreenApp.goToPage(${currentPage - 1})" ${currentPage <= 1 ? 'disabled' : ''}>
               ⬅️ Previous
             </button>`;
    
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);
    
    if (startPage > 1) {
      html += `<button onclick="FullscreenApp.goToPage(1)">1</button>`;
      if (startPage > 2) {
        html += `<button disabled>...</button>`;
      }
    }
    
    for (let i = startPage; i <= endPage; i++) {
      html += `<button onclick="FullscreenApp.goToPage(${i})" ${i === currentPage ? 'class="active"' : ''}>${i}</button>`;
    }
    
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        html += `<button disabled>...</button>`;
      }
      html += `<button onclick="FullscreenApp.goToPage(${totalPages})">${totalPages}</button>`;
    }
    
    html += `<button onclick="FullscreenApp.goToPage(${currentPage + 1})" ${currentPage >= totalPages ? 'disabled' : ''}>
               Next ➡️
             </button>`;
    
    const startRecord = (currentPage - 1) * this.state.pageSize + 1;
    const endRecord = Math.min(currentPage * this.state.pageSize, totalCount);
    html += `<div class="page-info">
               Showing ${startRecord}-${endRecord} of ${totalCount} proposals
             </div>`;
    
    html += '</div>';
    return html;
  },

  renderProposalsError(errorMessage) {
    if (this.elements.proposalsTableContainer) {
      this.elements.proposalsTableContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">⚠️</div>
          <div class="empty-state-title">Error Loading Proposals</div>
          <div class="empty-state-subtitle">${this.escapeHtml(errorMessage)}</div>
          <button class="btn btn-primary" onclick="FullscreenApp.loadProposals()">
            Retry
          </button>
        </div>
      `;
    }
  },

  goToPage(page) {
    this.state.currentPage = page;
    this.loadProposals();
  },

  searchProposals() {
    // This is called by the debounced handler
  },

  filterProposals() {
    // This is called by the status filter change handler
  },

  async refreshProposals() {
    this.showMessage('Refreshing proposals...', 'info');
    await this.loadProposals();
    this.showMessage('Proposals refreshed', 'success');
  },

  // ======================================
  // PROPOSAL ACTIONS
  // ======================================

  newProposal() {
    this.openNewProposalModal();
  },

  viewProposal(proposalId) {
    this.openProposalModal(proposalId, 'view');
  },

  editProposal(proposalId) {
    this.openProposalModal(proposalId, 'edit');
  },

  reviewProposal(proposalId) {
    this.openProposalModal(proposalId, 'review');
  },

  async generateProposalPdf(proposalId) {
    try {
      this.showMessage('Generating PDF...', 'info');
      
      const response = await this.apiCall(`/proposals/${proposalId}/pdf`, {
        method: 'POST'
      });
      
      if (response.success) {
        // Open PDF in new tab
        window.open(response.downloadUrl, '_blank');
        this.showMessage('PDF generated successfully', 'success');
      } else {
        throw new Error(response.message || 'PDF generation failed');
      }
    } catch (error) {
      console.error('PDF generation error:', error);
      this.showMessage('Failed to generate PDF', 'error');
    }
  },

  openNewProposalModal() {
    // Implementation would show a modal for creating new proposals
    this.showMessage('New proposal modal would open here', 'info');
  },

  openProposalModal(proposalId, mode) {
    // Implementation would show a modal for viewing/editing proposals
    this.showMessage(`${mode} proposal ${proposalId} modal would open here`, 'info');
  },

  // ======================================
  // BUDGET MANAGEMENT
  // ======================================

  async loadBudgetData() {
    try {
      this.showBudgetLoading();
      
      const response = await this.apiCall('/budget/cost-items');
      
      if (response.success) {
        this.state.costItems = response.data;
        this.renderBudgetContent();
      } else {
        throw new Error(response.message || 'Failed to load budget data');
      }
    } catch (error) {
      console.error('Error loading budget data:', error);
      this.renderBudgetError(error.message);
    }
  },

  showBudgetLoading() {
    if (this.elements.budgetContent) {
      this.elements.budgetContent.innerHTML = `
        <div class="loading">
          <div class="loading-spinner"></div>
          Loading budget data...
        </div>
      `;
    }
  },

  renderBudgetContent() {
    if (!this.elements.budgetContent) return;

    const html = `
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Item ID</th>
              <th>Item Name</th>
              <th>Unit Cost</th>
              <th>Category</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${this.state.costItems.map(item => `
              <tr>
                <td><code>${this.escapeHtml(item.itemid)}</code></td>
                <td><strong>${this.escapeHtml(item.itemname)}</strong></td>
                <td class="currency">${this.formatCurrency(item.unitcost)}</td>
                <td>${this.escapeHtml(item.category || 'Uncategorized')}</td>
                <td>
                  <button class="btn btn-small" onclick="FullscreenApp.editCostItem('${item.itemid}')">
                    ✏️ Edit
                  </button>
                  <button class="btn btn-danger btn-small" onclick="FullscreenApp.deleteCostItem('${item.itemid}')">
                    🗑️ Delete
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    this.elements.budgetContent.innerHTML = html;
  },

  renderBudgetError(errorMessage) {
    if (this.elements.budgetContent) {
      this.elements.budgetContent.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">⚠️</div>
          <div class="empty-state-title">Error Loading Budget Data</div>
          <div class="empty-state-subtitle">${this.escapeHtml(errorMessage)}</div>
          <button class="btn btn-primary" onclick="FullscreenApp.loadBudgetData()">
            Retry
          </button>
        </div>
      `;
    }
  },

  addCostItem() {
    this.showMessage('Add cost item modal would open here', 'info');
  },

  editCostItem(itemId) {
    this.showMessage(`Edit cost item ${itemId} modal would open here`, 'info');
  },

  deleteCostItem(itemId) {
    if (confirm('Are you sure you want to delete this cost item?')) {
      this.showMessage(`Delete cost item ${itemId}`, 'info');
    }
  },

  // ======================================
  // SETTINGS
  // ======================================

  async loadSettingsData() {
    try {
      this.showSettingsLoading();
      
      const response = await this.apiCall('/excel/workbook/info');
      
      if (response.success) {
        this.renderSystemStatus(response.workbookInfo);
      } else {
        throw new Error(response.message || 'Failed to load settings');
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      this.renderSettingsError(error.message);
    }
  },

  showSettingsLoading() {
    if (this.elements.systemStatus) {
      this.elements.systemStatus.innerHTML = `
        <div class="loading">
          <div class="loading-spinner"></div>
          Checking system status...
        </div>
      `;
    }
  },

  renderSystemStatus(info) {
    if (!this.elements.systemStatus) return;

    const html = `
      <div class="card">
        <div class="card-header">
          <h4 class="card-title">📊 System Information</h4>
        </div>
        <div class="card-body">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Sheets</label>
              <div>${info.sheets || 0} worksheets</div>
            </div>
            <div class="form-group">
              <label class="form-label">Last Modified</label>
              <div>${this.formatDate(info.lastModified)}</div>
            </div>
          </div>
          
          <div class="form-group">
            <label class="form-label">Sheet Details</label>
            <div class="table-container">
              <table class="table">
                <thead>
                  <tr>
                    <th>Sheet Name</th>
                    <th>Columns</th>
                    <th>Rows</th>
                  </tr>
                </thead>
                <tbody>
                  ${Object.entries(info.details || {}).map(([name, detail]) => `
                    <tr>
                      <td><strong>${this.escapeHtml(name)}</strong></td>
                      <td>${detail.columns || 0}</td>
                      <td>${detail.rows || 0}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;

    this.elements.systemStatus.innerHTML = html;
  },

  renderSettingsError(errorMessage) {
    if (this.elements.systemStatus) {
      this.elements.systemStatus.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">⚠️</div>
          <div class="empty-state-title">Error Loading Settings</div>
          <div class="empty-state-subtitle">${this.escapeHtml(errorMessage)}</div>
        </div>
      `;
    }
  },

  // ======================================
  // EXCEL INTEGRATION
  // ======================================

  async syncWithExcel() {
    try {
      this.updateExcelStatus('syncing');
      this.showMessage('Syncing with Excel...', 'info');
      
      const response = await this.apiCall('/excel/sync', {
        method: 'POST',
        body: JSON.stringify({
          sheetName: 'Proposals',
          action: 'read'
        })
      });

      if (response.success) {
        this.updateExcelStatus('ready');
        this.showMessage('Excel sync completed successfully', 'success');
        await this.refreshCurrentView();
      } else {
        throw new Error(response.message || 'Sync failed');
      }
    } catch (error) {
      console.error('Excel sync error:', error);
      this.updateExcelStatus('error');
      this.showMessage('Excel sync failed', 'error');
    }
  },

  async toggleProtection() {
    try {
      const action = this.state.protectionEnabled ? 'remove' : 'apply';
      
      this.showMessage(`${action === 'apply' ? 'Enabling' : 'Disabling'} protection...`, 'info');
      
      const response = await this.apiCall(`/excel/protection/${action}`, {
        method: 'POST',
        body: JSON.stringify({
          protectionLevel: 'read-only'
        })
      });

      if (response.success) {
        this.state.protectionEnabled = !this.state.protectionEnabled;
        
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

  updateExcelStatus(status) {
    this.state.excelStatus = status;
    
    if (this.elements.excelIndicator) {
      this.elements.excelIndicator.className = `excel-indicator ${status === 'ready' ? '' : status}`;
    }
    
    if (this.elements.excelStatusText) {
      const statusText = {
        ready: 'Excel: Ready',
        syncing: 'Excel: Syncing...',
        error: 'Excel: Error'
      };
      this.elements.excelStatusText.textContent = statusText[status] || 'Excel: Unknown';
    }
  },

  // ======================================
  // DATA LOADING AND REFRESH
  // ======================================

  async loadInitialData() {
    try {
      // Load current view data
      await this.loadViewData(this.state.currentView);
      
      // Handle specific proposal if provided in URL
      if (this.state.selectedProposal) {
        this.viewProposal(this.state.selectedProposal);
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
      this.showError('Failed to load initial data');
    }
  },

  async refreshCurrentView() {
    await this.loadViewData(this.state.currentView);
  },

  setupPeriodicRefresh() {
    // Setup interval for periodic refresh
    this.refreshInterval = setInterval(() => {
      if (this.state.isLoggedIn && !this.state.isLoading) {
        // Only refresh dashboard stats periodically, not full data
        if (this.state.currentView === 'dashboard') {
          this.loadDashboardData();
        }
      }
    }, this.config.refreshInterval);
  },

  cleanup() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  },

  // ======================================
  // UI UTILITIES
  // ======================================

  showLoading() {
    if (this.elements.loadingOverlay) {
      this.elements.loadingOverlay.style.display = 'flex';
    }
    this.state.isLoading = true;
  },

  hideLoading() {
    if (this.elements.loadingOverlay) {
      this.elements.loadingOverlay.style.display = 'none';
    }
    this.state.isLoading = false;
  },

  showMessage(message, type = 'info', duration = 4000) {
    if (!this.elements.messageContainer) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${type}`;
    messageDiv.innerHTML = `
      <span>${this.escapeHtml(message)}</span>
      <button onclick="this.parentElement.remove()" style="background: none; border: none; color: inherit; cursor: pointer; margin-left: 8px; font-size: 16px;">&times;</button>
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

  showError(title, details = '') {
    const message = details ? `${title}: ${details}` : title;
    this.showMessage(message, 'error', 0); // Don't auto-remove errors
  },

  closeAllModals() {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
      modal.style.display = 'none';
    });
  },

  handleResize() {
    // Handle responsive adjustments if needed
    console.log('Window resized');
  },

  // ======================================
  // HELPER FUNCTIONS
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

  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
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
        year: 'numeric',
        month: 'short',
        day: 'numeric'
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

// Make FullscreenApp available globally for HTML onclick handlers
window.FullscreenApp = FullscreenApp;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    FullscreenApp.init();
  });
} else {
  FullscreenApp.init();
}

// Export for module usage
export default FullscreenApp;