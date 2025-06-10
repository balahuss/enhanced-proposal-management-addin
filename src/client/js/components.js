// ======================================
// COMPONENTS.JS - REUSABLE UI COMPONENTS
// ======================================

// Collection of reusable UI components for the proposal management system
window.Components = {

  // ======================================
  // MODAL COMPONENT
  // ======================================

  Modal: {
    create(options = {}) {
      const {
        title = 'Modal',
        content = '',
        size = 'medium', // small, medium, large
        closable = true,
        onClose = null,
        onConfirm = null,
        confirmText = 'Confirm',
        cancelText = 'Cancel',
        showFooter = true
      } = options;

      const modal = Utils.createElement('div', {
        className: 'modal',
        onclick: (e) => {
          if (e.target === modal) {
            this.close(modal);
          }
        }
      });

      const dialog = Utils.createElement('div', {
        className: `modal-dialog modal-${size}`
      });

      const header = Utils.createElement('div', { className: 'modal-header' }, [
        Utils.createElement('h3', { className: 'modal-title', textContent: title }),
        closable ? Utils.createElement('button', {
          className: 'modal-close',
          innerHTML: '&times;',
          onclick: () => this.close(modal)
        }) : null
      ].filter(Boolean));

      const body = Utils.createElement('div', {
        className: 'modal-body',
        innerHTML: content
      });

      const footer = showFooter ? Utils.createElement('div', { className: 'modal-footer' }, [
        Utils.createElement('button', {
          className: 'btn btn-secondary',
          textContent: cancelText,
          onclick: () => this.close(modal)
        }),
        onConfirm ? Utils.createElement('button', {
          className: 'btn btn-primary',
          textContent: confirmText,
          onclick: () => {
            onConfirm(modal);
          }
        }) : null
      ].filter(Boolean)) : null;

      dialog.appendChild(header);
      dialog.appendChild(body);
      if (footer) dialog.appendChild(footer);
      modal.appendChild(dialog);

      // Store cleanup function
      modal._cleanup = () => {
        if (onClose) onClose();
      };

      return modal;
    },

    show(modal) {
      document.body.appendChild(modal);
      modal.classList.remove('hidden');
      
      // Focus management
      const firstFocusable = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (firstFocusable) {
        firstFocusable.focus();
      }
    },

    close(modal) {
      if (modal._cleanup) modal._cleanup();
      modal.classList.add('hidden');
      setTimeout(() => {
        if (modal.parentNode) {
          modal.parentNode.removeChild(modal);
        }
      }, 300);
    },

    confirm(message, title = 'Confirm') {
      return new Promise((resolve) => {
        const modal = this.create({
          title,
          content: `<p>${Utils.escapeHtml(message)}</p>`,
          onConfirm: () => {
            this.close(modal);
            resolve(true);
          },
          onClose: () => resolve(false)
        });
        this.show(modal);
      });
    },

    alert(message, title = 'Alert', type = 'info') {
      return new Promise((resolve) => {
        const icon = {
          info: 'ℹ️',
          success: '✅',
          warning: '⚠️',
          error: '❌'
        }[type] || 'ℹ️';

        const modal = this.create({
          title,
          content: `<div class="alert alert-${type}"><span class="alert-icon">${icon}</span> ${Utils.escapeHtml(message)}</div>`,
          showFooter: false,
          onClose: () => resolve()
        });
        
        // Auto-close after 3 seconds for success messages
        if (type === 'success') {
          setTimeout(() => this.close(modal), 3000);
        }
        
        this.show(modal);
      });
    }
  },

  // ======================================
  // NOTIFICATION COMPONENT
  // ======================================

  Notification: {
    container: null,

    init() {
      if (!this.container) {
        this.container = Utils.createElement('div', {
          className: 'notification-container',
          style: 'position: fixed; top: 16px; right: 16px; z-index: 1001; max-width: 320px;'
        });
        document.body.appendChild(this.container);
      }
    },

    show(message, type = 'info', duration = 5000) {
      this.init();

      const icons = {
        info: 'ℹ️',
        success: '✅',
        warning: '⚠️',
        error: '❌'
      };

      const notification = Utils.createElement('div', {
        className: `alert alert-${type} alert-dismissible`,
        style: 'margin-bottom: 8px; animation: slideInRight 0.3s ease;'
      }, [
        Utils.createElement('span', { textContent: icons[type] || icons.info }),
        Utils.createElement('span', { textContent: message }),
        Utils.createElement('button', {
          className: 'alert-close',
          innerHTML: '&times;',
          onclick: () => this.remove(notification)
        })
      ]);

      this.container.appendChild(notification);

      // Auto-remove after duration
      if (duration > 0) {
        setTimeout(() => this.remove(notification), duration);
      }

      return notification;
    },

    remove(notification) {
      if (notification && notification.parentNode) {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
        }, 300);
      }
    },

    success(message, duration = 3000) {
      return this.show(message, 'success', duration);
    },

    error(message, duration = 0) {
      return this.show(message, 'error', duration);
    },

    warning(message, duration = 5000) {
      return this.show(message, 'warning', duration);
    },

    info(message, duration = 5000) {
      return this.show(message, 'info', duration);
    }
  },

  // ======================================
  // LOADING COMPONENT
  // ======================================

  Loading: {
    overlay: null,

    show(message = 'Loading...') {
      this.hide(); // Remove any existing overlay

      this.overlay = Utils.createElement('div', {
        className: 'loading-overlay'
      }, [
        Utils.createElement('div', { className: 'loading' }, [
          Utils.createElement('div', { className: 'loading-spinner' }),
          Utils.createElement('span', { textContent: message })
        ])
      ]);

      document.body.appendChild(this.overlay);
    },

    hide() {
      if (this.overlay && this.overlay.parentNode) {
        this.overlay.parentNode.removeChild(this.overlay);
        this.overlay = null;
      }
    },

    button(button, loadingText = 'Loading...') {
      const originalText = button.textContent;
      const originalDisabled = button.disabled;

      button.disabled = true;
      button.textContent = loadingText;

      return {
        stop: () => {
          button.disabled = originalDisabled;
          button.textContent = originalText;
        }
      };
    }
  },

  // ======================================
  // TABLE COMPONENT
  // ======================================

  Table: {
    create(options = {}) {
      const {
        columns = [],
        data = [],
        className = 'table',
        sortable = false,
        selectable = false,
        onRowClick = null,
        onSelectionChange = null,
        emptyMessage = 'No data available'
      } = options;

      const table = Utils.createElement('table', { className });
      
      // Create header
      const thead = Utils.createElement('thead');
      const headerRow = Utils.createElement('tr');
      
      if (selectable) {
        const selectAllTh = Utils.createElement('th', { style: 'width: 40px;' });
        const selectAllCheckbox = Utils.createElement('input', {
          type: 'checkbox',
          onchange: (e) => {
            const checkboxes = table.querySelectorAll('tbody input[type="checkbox"]');
            checkboxes.forEach(cb => cb.checked = e.target.checked);
            if (onSelectionChange) {
              onSelectionChange(Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value));
            }
          }
        });
        selectAllTh.appendChild(selectAllCheckbox);
        headerRow.appendChild(selectAllTh);
      }

      columns.forEach(column => {
        const th = Utils.createElement('th', {
          textContent: column.title || column.key,
          style: column.width ? `width: ${column.width};` : ''
        });
        
        if (sortable && column.sortable !== false) {
          th.style.cursor = 'pointer';
          th.addEventListener('click', () => {
            // Implement sorting logic here
            console.log('Sort by:', column.key);
          });
        }
        
        headerRow.appendChild(th);
      });

      thead.appendChild(headerRow);
      table.appendChild(thead);

      // Create body
      const tbody = Utils.createElement('tbody');
      
      if (data.length === 0) {
        const emptyRow = Utils.createElement('tr');
        const emptyCell = Utils.createElement('td', {
          textContent: emptyMessage,
          colspan: columns.length + (selectable ? 1 : 0),
          style: 'text-align: center; color: #605e5c; padding: 32px;'
        });
        emptyRow.appendChild(emptyCell);
        tbody.appendChild(emptyRow);
      } else {
        data.forEach((row, index) => {
          const tr = Utils.createElement('tr');
          
          if (onRowClick) {
            tr.style.cursor = 'pointer';
            tr.addEventListener('click', () => onRowClick(row, index));
          }

          if (selectable) {
            const selectTd = Utils.createElement('td');
            const checkbox = Utils.createElement('input', {
              type: 'checkbox',
              value: row.id || index,
              onchange: () => {
                if (onSelectionChange) {
                  const selected = Array.from(table.querySelectorAll('tbody input[type="checkbox"]:checked'))
                    .map(cb => cb.value);
                  onSelectionChange(selected);
                }
              }
            });
            selectTd.appendChild(checkbox);
            tr.appendChild(selectTd);
          }

          columns.forEach(column => {
            const td = Utils.createElement('td');
            
            if (column.render) {
              const rendered = column.render(row[column.key], row, index);
              if (typeof rendered === 'string') {
                td.innerHTML = rendered;
              } else {
                td.appendChild(rendered);
              }
            } else {
              td.textContent = row[column.key] || '';
            }
            
            tr.appendChild(td);
          });

          tbody.appendChild(tr);
        });
      }

      table.appendChild(tbody);
      return table;
    }
  },

  // ======================================
  // FORM COMPONENT
  // ======================================

  Form: {
    create(options = {}) {
      const {
        fields = [],
        onSubmit = null,
        submitText = 'Submit',
        resetText = 'Reset',
        showReset = true,
        className = ''
      } = options;

      const form = Utils.createElement('form', {
        className: `form ${className}`,
        onsubmit: (e) => {
          e.preventDefault();
          if (onSubmit) {
            const formData = Utils.serializeForm(form);
            onSubmit(formData, form);
          }
        }
      });

      fields.forEach(field => {
        const formGroup = this.createField(field);
        form.appendChild(formGroup);
      });

      // Add form actions
      const actions = Utils.createElement('div', { className: 'form-actions' }, [
        Utils.createElement('button', {
          type: 'submit',
          className: 'btn btn-primary',
          textContent: submitText
        }),
        showReset ? Utils.createElement('button', {
          type: 'button',
          className: 'btn btn-secondary',
          textContent: resetText,
          onclick: () => Utils.resetForm(form)
        }) : null
      ].filter(Boolean));

      form.appendChild(actions);
      return form;
    },

    createField(field) {
      const {
        type = 'text',
        name,
        label,
        placeholder = '',
        required = false,
        options = [],
        validation = {},
        className = ''
      } = field;

      const formGroup = Utils.createElement('div', { className: 'form-group' });

      if (label) {
        const labelEl = Utils.createElement('label', {
          className: `form-label ${required ? 'required' : ''}`,
          textContent: label,
          for: name
        });
        formGroup.appendChild(labelEl);
      }

      let input;

      switch (type) {
        case 'select':
          input = Utils.createElement('select', {
            className: `form-select ${className}`,
            name,
            id: name,
            required
          });
          
          options.forEach(option => {
            const optionEl = Utils.createElement('option', {
              value: option.value,
              textContent: option.label || option.value
            });
            input.appendChild(optionEl);
          });
          break;

        case 'textarea':
          input = Utils.createElement('textarea', {
            className: `form-textarea ${className}`,
            name,
            id: name,
            placeholder,
            required
          });
          break;

        case 'checkbox':
          input = Utils.createElement('input', {
            type: 'checkbox',
            name,
            id: name,
            value: field.value || '1'
          });
          break;

        default:
          input = Utils.createElement('input', {
            type,
            className: `form-input ${className}`,
            name,
            id: name,
            placeholder,
            required
          });
      }

      // Add validation
      if (validation.pattern) {
        input.pattern = validation.pattern;
      }
      if (validation.min !== undefined) {
        input.min = validation.min;
      }
      if (validation.max !== undefined) {
        input.max = validation.max;
      }

      formGroup.appendChild(input);

      // Add validation message container
      const messageContainer = Utils.createElement('div', {
        className: 'field-messages'
      });
      formGroup.appendChild(messageContainer);

      return formGroup;
    },

    validate(form) {
      const errors = {};
      const formData = new FormData(form);

      // Basic HTML5 validation
      const fields = form.querySelectorAll('input, select, textarea');
      fields.forEach(field => {
        if (!field.checkValidity()) {
          errors[field.name] = field.validationMessage;
        }
      });

      return {
        isValid: Object.keys(errors).length === 0,
        errors
      };
    },

    showFieldError(form, fieldName, message) {
      const field = form.querySelector(`[name="${fieldName}"]`);
      if (field) {
        field.classList.add('error');
        const messageContainer = field.parentNode.querySelector('.field-messages');
        if (messageContainer) {
          messageContainer.innerHTML = `<span class="error-message">${Utils.escapeHtml(message)}</span>`;
        }
      }
    },

    clearFieldErrors(form) {
      const fields = form.querySelectorAll('.error');
      fields.forEach(field => {
        field.classList.remove('error');
        const messageContainer = field.parentNode.querySelector('.field-messages');
        if (messageContainer) {
          messageContainer.innerHTML = '';
        }
      });
    }
  },

  // ======================================
  // PAGINATION COMPONENT
  // ======================================

  Pagination: {
    create(options = {}) {
      const {
        currentPage = 1,
        totalPages = 1,
        onPageChange = null,
        maxVisible = 5
      } = options;

      const pagination = Utils.createElement('div', { className: 'pagination' });

      // Previous button
      const prevBtn = Utils.createElement('button', {
        className: `btn btn-secondary ${currentPage === 1 ? 'disabled' : ''}`,
        textContent: '‹ Previous',
        disabled: currentPage === 1,
        onclick: () => {
          if (currentPage > 1 && onPageChange) {
            onPageChange(currentPage - 1);
          }
        }
      });
      pagination.appendChild(prevBtn);

      // Page numbers
      const startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
      const endPage = Math.min(totalPages, startPage + maxVisible - 1);

      for (let i = startPage; i <= endPage; i++) {
        const pageBtn = Utils.createElement('button', {
          className: `btn ${i === currentPage ? 'btn-primary' : 'btn-secondary'}`,
          textContent: i.toString(),
          onclick: () => {
            if (i !== currentPage && onPageChange) {
              onPageChange(i);
            }
          }
        });
        pagination.appendChild(pageBtn);
      }

      // Next button
      const nextBtn = Utils.createElement('button', {
        className: `btn btn-secondary ${currentPage === totalPages ? 'disabled' : ''}`,
        textContent: 'Next ›',
        disabled: currentPage === totalPages,
        onclick: () => {
          if (currentPage < totalPages && onPageChange) {
            onPageChange(currentPage + 1);
          }
        }
      });
      pagination.appendChild(nextBtn);

      return pagination;
    }
  },

  // ======================================
  // SEARCH BAR COMPONENT
  // ======================================

  SearchBar: {
    create(options = {}) {
      const {
        placeholder = 'Search...',
        onSearch = null,
        debounceDelay = 300,
        showClearButton = true
      } = options;

      const searchContainer = Utils.createElement('div', { className: 'search-container' });

      const searchInput = Utils.createElement('input', {
        type: 'text',
        className: 'form-input search-input',
        placeholder
      });

      const clearBtn = Utils.createElement('button', {
        className: 'btn btn-link search-clear',
        innerHTML: '&times;',
        style: 'display: none;',
        onclick: () => {
          searchInput.value = '';
          clearBtn.style.display = 'none';
          if (onSearch) onSearch('');
        }
      });

      if (onSearch) {
        const debouncedSearch = Utils.debounce((value) => {
          onSearch(value);
          clearBtn.style.display = value ? 'block' : 'none';
        }, debounceDelay);

        searchInput.addEventListener('input', (e) => {
          debouncedSearch(e.target.value);
        });
      }

      searchContainer.appendChild(searchInput);
      if (showClearButton) {
        searchContainer.appendChild(clearBtn);
      }

      return searchContainer;
    }
  },

  // ======================================
  // STATUS BADGE COMPONENT
  // ======================================

  StatusBadge: {
    create(status, customClasses = {}) {
      const statusClasses = {
        pending: 'status-pending',
        approved: 'status-approved',
        rejected: 'status-rejected',
        resubmit: 'status-resubmit',
        draft: 'status-draft',
        ...customClasses
      };

      const badge = Utils.createElement('span', {
        className: `status-badge ${statusClasses[status] || ''}`,
        textContent: Utils.capitalizeFirst(status)
      });

      return badge;
    }
  },

  // ======================================
  // CURRENCY INPUT COMPONENT
  // ======================================

  CurrencyInput: {
    create(options = {}) {
      const {
        name,
        value = 0,
        currency = 'NGN',
        onChange = null
      } = options;

      const container = Utils.createElement('div', { className: 'currency-input-container' });

      const symbol = Utils.createElement('span', {
        className: 'currency-symbol',
        textContent: currency === 'NGN' ? '₦' : '$'
      });

      const input = Utils.createElement('input', {
        type: 'text',
        className: 'form-input currency-input',
        name,
        value: Utils.formatNumber(value, 2)
      });

      input.addEventListener('input', (e) => {
        const numericValue = Utils.parseNumber(e.target.value);
        e.target.value = Utils.formatNumber(numericValue, 2);
        if (onChange) onChange(numericValue);
      });

      container.appendChild(symbol);
      container.appendChild(input);

      return container;
    }
  }
};

// Add CSS animations for components
const componentStyles = `
  @keyframes slideInRight {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  
  @keyframes slideOutRight {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
  }
  
  .search-container {
    position: relative;
    display: inline-block;
  }
  
  .search-clear {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    cursor: pointer;
    font-size: 18px;
    color: #605e5c;
  }
  
  .currency-input-container {
    display: flex;
    align-items: center;
    border: 1px solid #8a8886;
    border-radius: 2px;
    background: white;
  }
  
  .currency-symbol {
    padding: 8px 12px;
    background: #f3f2f1;
    border-right: 1px solid #8a8886;
    font-weight: 500;
  }
  
  .currency-input {
    border: none;
    text-align: right;
  }
  
  .currency-input:focus {
    outline: none;
    box-shadow: none;
  }
  
  .currency-input-container:focus-within {
    border-color: #0078d4;
    box-shadow: 0 0 0 2px rgba(0, 120, 212, 0.3);
  }
  
  .pagination {
    display: flex;
    gap: 4px;
    align-items: center;
    justify-content: center;
    margin: 16px 0;
  }
  
  .pagination .btn {
    min-width: 40px;
  }
  
  .form-actions {
    margin-top: 24px;
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }
`;

// Inject component styles
const styleSheet = document.createElement('style');
styleSheet.textContent = componentStyles;
document.head.appendChild(styleSheet);

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.Components;
}