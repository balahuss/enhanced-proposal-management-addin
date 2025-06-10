// ======================================
// UTILS.JS - UTILITY FUNCTIONS
// ======================================

// Collection of utility functions used across the application
window.Utils = {
  
  // ======================================
  // STRING UTILITIES
  // ======================================

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  unescapeHtml(html) {
    if (!html) return '';
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  },

  truncateText(text, maxLength = 100, suffix = '...') {
    if (!text || text.length <= maxLength) return text || '';
    return text.substring(0, maxLength - suffix.length) + suffix;
  },

  capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  },

  toTitleCase(str) {
    if (!str) return '';
    return str.replace(/\w\S*/g, (txt) => 
      txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    );
  },

  slugify(text) {
    if (!text) return '';
    return text
      .toLowerCase()
      .replace(/[^\w ]+/g, '')
      .replace(/ +/g, '-');
  },

  generateId(prefix = '') {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return prefix ? `${prefix}-${timestamp}-${random}` : `${timestamp}-${random}`;
  },

  // ======================================
  // DATE UTILITIES
  // ======================================

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
      time: { hour: '2-digit', minute: '2-digit' },
      full: {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }
    };
    
    return dateObj.toLocaleDateString('en-US', options[format] || options.short);
  },

  formatRelativeTime(date) {
    if (!date) return '';
    
    const dateObj = date instanceof Date ? date : new Date(date);
    const now = new Date();
    const diffMs = now - dateObj;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return 'just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    return this.formatDate(dateObj, 'short');
  },

  isValidDate(date) {
    const dateObj = date instanceof Date ? date : new Date(date);
    return !isNaN(dateObj.getTime());
  },

  addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  },

  // ======================================
  // NUMBER UTILITIES
  // ======================================

  formatCurrency(amount, currency = 'NGN', locale = 'en-NG') {
    if (typeof amount !== 'number' || isNaN(amount)) {
      return currency === 'NGN' ? '₦0.00' : '$0.00';
    }
    
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(amount);
    } catch (error) {
      // Fallback for unsupported locales
      const symbol = currency === 'NGN' ? '₦' : '$';
      return `${symbol}${amount.toLocaleString(undefined, { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
      })}`;
    }
  },

  formatNumber(number, decimals = 0) {
    if (typeof number !== 'number' || isNaN(number)) {
      return '0';
    }
    
    return number.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  },

  parseNumber(value) {
    if (typeof value === 'number') return value;
    if (!value) return 0;
    
    // Remove currency symbols and commas
    const cleaned = String(value).replace(/[₦$,\s]/g, '');
    const parsed = parseFloat(cleaned);
    
    return isNaN(parsed) ? 0 : parsed;
  },

  isValidNumber(value) {
    return !isNaN(parseFloat(value)) && isFinite(value);
  },

  // ======================================
  // ARRAY UTILITIES
  // ======================================

  groupBy(array, key) {
    return array.reduce((groups, item) => {
      const group = typeof key === 'function' ? key(item) : item[key];
      groups[group] = groups[group] || [];
      groups[group].push(item);
      return groups;
    }, {});
  },

  sortBy(array, key, direction = 'asc') {
    return [...array].sort((a, b) => {
      const aVal = typeof key === 'function' ? key(a) : a[key];
      const bVal = typeof key === 'function' ? key(b) : b[key];
      
      if (aVal < bVal) return direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  },

  unique(array, key = null) {
    if (!key) {
      return [...new Set(array)];
    }
    
    const seen = new Set();
    return array.filter(item => {
      const value = typeof key === 'function' ? key(item) : item[key];
      if (seen.has(value)) return false;
      seen.add(value);
      return true;
    });
  },

  chunk(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  },

  // ======================================
  // OBJECT UTILITIES
  // ======================================

  deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (obj instanceof Array) return obj.map(item => this.deepClone(item));
    
    const cloned = {};
    for (let key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = this.deepClone(obj[key]);
      }
    }
    return cloned;
  },

  isEmpty(obj) {
    if (!obj) return true;
    if (Array.isArray(obj)) return obj.length === 0;
    if (typeof obj === 'object') return Object.keys(obj).length === 0;
    return false;
  },

  pick(obj, keys) {
    const result = {};
    keys.forEach(key => {
      if (key in obj) {
        result[key] = obj[key];
      }
    });
    return result;
  },

  omit(obj, keys) {
    const result = { ...obj };
    keys.forEach(key => {
      delete result[key];
    });
    return result;
  },

  // ======================================
  // VALIDATION UTILITIES
  // ======================================

  isEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  isPhone(phone) {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
  },

  isUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  },

  validateRequired(value, fieldName = 'Field') {
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      return `${fieldName} is required`;
    }
    return null;
  },

  validateEmail(email, fieldName = 'Email') {
    if (!email) return `${fieldName} is required`;
    if (!this.isEmail(email)) return `${fieldName} must be a valid email address`;
    return null;
  },

  validateMinLength(value, minLength, fieldName = 'Field') {
    if (!value) return `${fieldName} is required`;
    if (value.length < minLength) {
      return `${fieldName} must be at least ${minLength} characters long`;
    }
    return null;
  },

  // ======================================
  // DOM UTILITIES
  // ======================================

  $(selector, context = document) {
    return context.querySelector(selector);
  },

  $$(selector, context = document) {
    return context.querySelectorAll(selector);
  },

  createElement(tag, attributes = {}, children = []) {
    const element = document.createElement(tag);
    
    Object.entries(attributes).forEach(([key, value]) => {
      if (key === 'className') {
        element.className = value;
      } else if (key === 'innerHTML') {
        element.innerHTML = value;
      } else if (key === 'textContent') {
        element.textContent = value;
      } else if (key.startsWith('on') && typeof value === 'function') {
        element.addEventListener(key.slice(2).toLowerCase(), value);
      } else {
        element.setAttribute(key, value);
      }
    });
    
    children.forEach(child => {
      if (typeof child === 'string') {
        element.appendChild(document.createTextNode(child));
      } else if (child instanceof Node) {
        element.appendChild(child);
      }
    });
    
    return element;
  },

  addEventListeners(element, events) {
    Object.entries(events).forEach(([event, handler]) => {
      element.addEventListener(event, handler);
    });
  },

  // ======================================
  // ASYNC UTILITIES
  // ======================================

  debounce(func, delay) {
    let timeoutId;
    return function (...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
  },

  throttle(func, limit) {
    let inThrottle;
    return function (...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  },

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  async retry(fn, maxAttempts = 3, delay = 1000) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (attempt === maxAttempts) break;
        await this.sleep(delay * attempt);
      }
    }
    
    throw lastError;
  },

  // ======================================
  // LOCAL STORAGE UTILITIES
  // ======================================

  storage: {
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (error) {
        console.warn('Storage set failed:', error);
        return false;
      }
    },

    get(key, defaultValue = null) {
      try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
      } catch (error) {
        console.warn('Storage get failed:', error);
        return defaultValue;
      }
    },

    remove(key) {
      try {
        localStorage.removeItem(key);
        return true;
      } catch (error) {
        console.warn('Storage remove failed:', error);
        return false;
      }
    },

    clear() {
      try {
        localStorage.clear();
        return true;
      } catch (error) {
        console.warn('Storage clear failed:', error);
        return false;
      }
    }
  },

  // ======================================
  // ERROR UTILITIES
  // ======================================

  createError(message, code = null, details = {}) {
    const error = new Error(message);
    error.code = code;
    error.details = details;
    error.timestamp = new Date().toISOString();
    return error;
  },

  formatError(error) {
    if (!error) return 'Unknown error occurred';
    
    if (typeof error === 'string') return error;
    
    if (error.message) {
      return error.code ? `${error.code}: ${error.message}` : error.message;
    }
    
    return 'An unexpected error occurred';
  },

  // ======================================
  // FORM UTILITIES
  // ======================================

  serializeForm(form) {
    const formData = new FormData(form);
    const data = {};
    
    for (let [key, value] of formData.entries()) {
      if (data[key]) {
        // Handle multiple values (checkboxes, multiple selects)
        if (Array.isArray(data[key])) {
          data[key].push(value);
        } else {
          data[key] = [data[key], value];
        }
      } else {
        data[key] = value;
      }
    }
    
    return data;
  },

  populateForm(form, data) {
    Object.entries(data).forEach(([key, value]) => {
      const field = form.elements[key];
      if (field) {
        if (field.type === 'checkbox' || field.type === 'radio') {
          field.checked = Boolean(value);
        } else {
          field.value = value || '';
        }
      }
    });
  },

  resetForm(form) {
    form.reset();
    
    // Clear any custom validation messages
    const fields = form.querySelectorAll('.field-error, .field-success');
    fields.forEach(field => {
      field.classList.remove('field-error', 'field-success');
    });
    
    const messages = form.querySelectorAll('.error-message, .success-message');
    messages.forEach(message => message.remove());
  }
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.Utils;
}