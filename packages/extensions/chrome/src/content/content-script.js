// ProcessMaster Pro Content Script - Tracks user interactions

class InteractionTracker {
  constructor() {
    this.isActive = false;
    this.lastInteraction = null;
    this.interactionQueue = [];
    this.debounceTimer = null;
    
    this.setupEventListeners();
    this.checkRecordingStatus();
  }

  setupEventListeners() {
    // Mouse events
    document.addEventListener('click', (e) => this.handleClick(e), true);
    document.addEventListener('mousedown', (e) => this.handleMouseDown(e), true);
    document.addEventListener('mouseup', (e) => this.handleMouseUp(e), true);
    document.addEventListener('mouseover', (e) => this.handleMouseOver(e), true);

    // Keyboard events
    document.addEventListener('keydown', (e) => this.handleKeyDown(e), true);
    document.addEventListener('keyup', (e) => this.handleKeyUp(e), true);

    // Form events
    document.addEventListener('input', (e) => this.handleInput(e), true);
    document.addEventListener('change', (e) => this.handleChange(e), true);
    document.addEventListener('submit', (e) => this.handleSubmit(e), true);

    // Scroll events
    document.addEventListener('scroll', (e) => this.handleScroll(e), true);

    // Focus events
    document.addEventListener('focus', (e) => this.handleFocus(e), true);
    document.addEventListener('blur', (e) => this.handleBlur(e), true);

    // Page events
    window.addEventListener('beforeunload', () => this.handlePageUnload());

    // Listen for messages from service worker
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'START_TRACKING') {
        this.startTracking();
        sendResponse({ success: true });
      } else if (message.type === 'STOP_TRACKING') {
        this.stopTracking();
        sendResponse({ success: true });
      }
    });
  }

  async checkRecordingStatus() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
      if (response.isRecording) {
        this.startTracking();
      }
    } catch (error) {
      console.error('Failed to check recording status:', error);
    }
  }

  startTracking() {
    this.isActive = true;
    this.addVisualIndicator();
    console.log('ProcessMaster Pro: Interaction tracking started');
  }

  stopTracking() {
    this.isActive = false;
    this.removeVisualIndicator();
    console.log('ProcessMaster Pro: Interaction tracking stopped');
  }

  handleClick(event) {
    if (!this.isActive) return;

    const element = event.target;
    const interaction = {
      type: 'click',
      element: this.getElementInfo(element),
      coordinates: { x: event.clientX, y: event.clientY },
      timestamp: new Date().toISOString(),
      modifiers: {
        ctrl: event.ctrlKey,
        shift: event.shiftKey,
        alt: event.altKey,
        meta: event.metaKey
      }
    };

    this.recordInteraction(interaction);
  }

  handleMouseDown(event) {
    if (!this.isActive) return;

    // Only track right-clicks and middle-clicks
    if (event.button !== 0) {
      const interaction = {
        type: 'mousedown',
        button: event.button,
        element: this.getElementInfo(event.target),
        coordinates: { x: event.clientX, y: event.clientY },
        timestamp: new Date().toISOString()
      };

      this.recordInteraction(interaction);
    }
  }

  handleMouseUp(event) {
    // Currently not tracking mouseup separately
  }

  handleMouseOver(event) {
    if (!this.isActive) return;

    // Debounce hover events
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      const element = event.target;
      
      // Only track hover on interactive elements
      if (this.isInteractiveElement(element)) {
        const interaction = {
          type: 'hover',
          element: this.getElementInfo(element),
          coordinates: { x: event.clientX, y: event.clientY },
          timestamp: new Date().toISOString()
        };

        this.recordInteraction(interaction);
      }
    }, 500);
  }

  handleKeyDown(event) {
    if (!this.isActive) return;

    // Track significant key events
    if (event.key === 'Enter' || event.key === 'Tab' || event.key === 'Escape' || 
        event.ctrlKey || event.metaKey || event.altKey) {
      
      const interaction = {
        type: 'keydown',
        key: event.key,
        code: event.code,
        element: this.getElementInfo(event.target),
        modifiers: {
          ctrl: event.ctrlKey,
          shift: event.shiftKey,
          alt: event.altKey,
          meta: event.metaKey
        },
        timestamp: new Date().toISOString()
      };

      this.recordInteraction(interaction);
    }
  }

  handleKeyUp(event) {
    // Currently not tracking keyup separately
  }

  handleInput(event) {
    if (!this.isActive) return;

    const element = event.target;
    const interaction = {
      type: 'input',
      element: this.getElementInfo(element),
      value: this.sanitizeValue(element.value, element.type),
      timestamp: new Date().toISOString()
    };

    // Debounce input events
    clearTimeout(this.inputDebounceTimer);
    this.inputDebounceTimer = setTimeout(() => {
      this.recordInteraction(interaction);
    }, 1000);
  }

  handleChange(event) {
    if (!this.isActive) return;

    const element = event.target;
    const interaction = {
      type: 'change',
      element: this.getElementInfo(element),
      value: this.sanitizeValue(element.value, element.type),
      timestamp: new Date().toISOString()
    };

    this.recordInteraction(interaction);
  }

  handleSubmit(event) {
    if (!this.isActive) return;

    const form = event.target;
    const interaction = {
      type: 'submit',
      element: this.getElementInfo(form),
      formData: this.getFormData(form),
      timestamp: new Date().toISOString()
    };

    this.recordInteraction(interaction);
  }

  handleScroll(event) {
    if (!this.isActive) return;

    // Debounce scroll events
    clearTimeout(this.scrollDebounceTimer);
    this.scrollDebounceTimer = setTimeout(() => {
      const interaction = {
        type: 'scroll',
        element: this.getElementInfo(event.target),
        scrollPosition: {
          x: window.scrollX,
          y: window.scrollY
        },
        timestamp: new Date().toISOString()
      };

      this.recordInteraction(interaction);
    }, 500);
  }

  handleFocus(event) {
    if (!this.isActive) return;

    const element = event.target;
    if (this.isInteractiveElement(element)) {
      const interaction = {
        type: 'focus',
        element: this.getElementInfo(element),
        timestamp: new Date().toISOString()
      };

      this.recordInteraction(interaction);
    }
  }

  handleBlur(event) {
    if (!this.isActive) return;

    const element = event.target;
    if (this.isInteractiveElement(element)) {
      const interaction = {
        type: 'blur',
        element: this.getElementInfo(element),
        timestamp: new Date().toISOString()
      };

      this.recordInteraction(interaction);
    }
  }

  handlePageUnload() {
    if (this.isActive) {
      const interaction = {
        type: 'page_unload',
        url: window.location.href,
        timestamp: new Date().toISOString()
      };

      this.recordInteraction(interaction, true); // Force immediate send
    }
  }

  getElementInfo(element) {
    if (!element) return null;

    const rect = element.getBoundingClientRect();
    
    return {
      tagName: element.tagName.toLowerCase(),
      id: element.id || null,
      className: element.className || null,
      text: this.getElementText(element),
      attributes: this.getRelevantAttributes(element),
      selector: this.generateSelector(element),
      position: {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height
      },
      visible: this.isElementVisible(element)
    };
  }

  getElementText(element) {
    if (!element) return null;

    // For form elements, get their value or placeholder
    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
      return element.placeholder || element.value || null;
    }

    // For other elements, get their text content (truncated)
    const text = element.textContent?.trim();
    return text ? text.substring(0, 100) : null;
  }

  getRelevantAttributes(element) {
    const relevantAttrs = ['type', 'name', 'placeholder', 'role', 'aria-label', 'title', 'href'];
    const attributes = {};

    relevantAttrs.forEach(attr => {
      const value = element.getAttribute(attr);
      if (value) {
        attributes[attr] = value;
      }
    });

    return Object.keys(attributes).length > 0 ? attributes : null;
  }

  generateSelector(element) {
    try {
      // Try to generate a unique selector
      if (element.id) {
        return `#${element.id}`;
      }

      let selector = element.tagName.toLowerCase();
      
      if (element.className) {
        const classes = element.className.split(' ').filter(c => c.trim());
        if (classes.length > 0) {
          selector += '.' + classes.slice(0, 2).join('.');
        }
      }

      // Add position if needed
      const siblings = Array.from(element.parentNode?.children || [])
        .filter(sibling => sibling.tagName === element.tagName);
      
      if (siblings.length > 1) {
        const index = siblings.indexOf(element);
        selector += `:nth-of-type(${index + 1})`;
      }

      return selector;
    } catch (error) {
      return element.tagName.toLowerCase();
    }
  }

  isInteractiveElement(element) {
    const interactiveTags = ['a', 'button', 'input', 'select', 'textarea', 'label'];
    const interactiveRoles = ['button', 'link', 'tab', 'option', 'menuitem'];
    
    return interactiveTags.includes(element.tagName.toLowerCase()) ||
           interactiveRoles.includes(element.getAttribute('role')) ||
           element.hasAttribute('onclick') ||
           element.style.cursor === 'pointer';
  }

  isElementVisible(element) {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && 
           rect.top >= 0 && rect.left >= 0 &&
           rect.bottom <= window.innerHeight && 
           rect.right <= window.innerWidth;
  }

  sanitizeValue(value, inputType) {
    // Don't record sensitive information
    const sensitiveTypes = ['password', 'credit-card', 'social-security'];
    
    if (sensitiveTypes.includes(inputType)) {
      return '[REDACTED]';
    }

    // Truncate long values
    if (typeof value === 'string' && value.length > 100) {
      return value.substring(0, 100) + '...';
    }

    return value;
  }

  getFormData(form) {
    const formData = {};
    const formElements = form.querySelectorAll('input, select, textarea');
    
    formElements.forEach(element => {
      if (element.name) {
        formData[element.name] = this.sanitizeValue(element.value, element.type);
      }
    });

    return formData;
  }

  recordInteraction(interaction, immediate = false) {
    if (!this.isActive) return;

    // Add to queue
    this.interactionQueue.push(interaction);

    // Send to service worker
    if (immediate || this.interactionQueue.length >= 5) {
      this.flushInteractionQueue();
    } else {
      // Debounce sending
      clearTimeout(this.sendTimer);
      this.sendTimer = setTimeout(() => {
        this.flushInteractionQueue();
      }, 2000);
    }
  }

  async flushInteractionQueue() {
    if (this.interactionQueue.length === 0) return;

    const interactions = [...this.interactionQueue];
    this.interactionQueue = [];

    try {
      for (const interaction of interactions) {
        await chrome.runtime.sendMessage({
          type: 'USER_INTERACTION',
          data: interaction
        });
      }
    } catch (error) {
      console.error('Failed to send interactions:', error);
      // Put interactions back in queue to retry
      this.interactionQueue.unshift(...interactions);
    }
  }

  addVisualIndicator() {
    // Remove existing indicator
    this.removeVisualIndicator();

    // Create recording indicator
    const indicator = document.createElement('div');
    indicator.id = 'processmaster-recording-indicator';
    indicator.innerHTML = '🔴 ProcessMaster Recording';
    indicator.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: rgba(255, 0, 0, 0.9);
      color: white;
      padding: 8px 12px;
      border-radius: 4px;
      font-family: Arial, sans-serif;
      font-size: 12px;
      font-weight: bold;
      z-index: 999999;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      pointer-events: none;
      animation: processmaster-pulse 2s infinite;
    `;

    // Add animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes processmaster-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
      }
    `;
    document.head.appendChild(style);

    document.body.appendChild(indicator);
  }

  removeVisualIndicator() {
    const indicator = document.getElementById('processmaster-recording-indicator');
    if (indicator) {
      indicator.remove();
    }
  }
}

// Initialize interaction tracker
const tracker = new InteractionTracker();