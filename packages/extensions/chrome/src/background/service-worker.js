// ProcessMaster Pro Chrome Extension Service Worker

const API_BASE_URL = 'http://localhost:3001/api/v1';

class ProcessMasterExtension {
  constructor() {
    this.captureSession = null;
    this.isRecording = false;
    this.screenshots = [];
    this.interactions = [];
    this.sequenceNumber = 0;
    
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Handle extension installation
    chrome.runtime.onInstalled.addListener(() => {
      console.log('ProcessMaster Pro extension installed');
      this.createContextMenus();
    });

    // Handle keyboard shortcuts
    chrome.commands.onCommand.addListener((command) => {
      if (command === 'start-capture') {
        this.startCapture();
      } else if (command === 'stop-capture') {
        this.stopCapture();
      }
    });

    // Handle messages from content scripts and popup
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep message channel open for async response
    });

    // Handle tab updates to capture page changes
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (this.isRecording && changeInfo.status === 'complete') {
        this.capturePageChange(tab);
      }
    });
  }

  createContextMenus() {
    chrome.contextMenus.create({
      id: 'processmaster-start-capture',
      title: 'Start ProcessMaster Capture',
      contexts: ['page']
    });

    chrome.contextMenus.create({
      id: 'processmaster-stop-capture',
      title: 'Stop ProcessMaster Capture',
      contexts: ['page'],
      enabled: false
    });

    chrome.contextMenus.onClicked.addListener((info, tab) => {
      if (info.menuItemId === 'processmaster-start-capture') {
        this.startCapture();
      } else if (info.menuItemId === 'processmaster-stop-capture') {
        this.stopCapture();
      }
    });
  }

  async handleMessage(message, sender, sendResponse) {
    try {
      switch (message.type) {
        case 'START_CAPTURE':
          await this.startCapture();
          sendResponse({ success: true, sessionId: this.captureSession?.id });
          break;

        case 'STOP_CAPTURE':
          await this.stopCapture();
          sendResponse({ success: true });
          break;

        case 'GET_STATUS':
          sendResponse({
            isRecording: this.isRecording,
            sessionId: this.captureSession?.id,
            screenshotCount: this.screenshots.length,
            interactionCount: this.interactions.length
          });
          break;

        case 'USER_INTERACTION':
          this.recordInteraction(message.data, sender.tab);
          sendResponse({ success: true });
          break;

        case 'TAKE_SCREENSHOT':
          await this.takeScreenshot(sender.tab);
          sendResponse({ success: true });
          break;

        case 'AUTH_STATUS':
          const authStatus = await this.checkAuthStatus();
          sendResponse(authStatus);
          break;

        default:
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async startCapture() {
    if (this.isRecording) {
      throw new Error('Capture session already active');
    }

    try {
      // Check authentication first
      const authStatus = await this.checkAuthStatus();
      if (!authStatus.isAuthenticated) {
        throw new Error('Please log in to ProcessMaster Pro first');
      }

      // Get current tab
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Create capture session
      this.captureSession = await this.createCaptureSession(activeTab);
      this.isRecording = true;
      this.screenshots = [];
      this.interactions = [];
      this.sequenceNumber = 0;

      // Take initial screenshot
      await this.takeScreenshot(activeTab);

      // Inject content script for interaction tracking
      await this.injectContentScript(activeTab.id);

      // Update UI
      this.updateExtensionState();
      
      console.log('Capture session started:', this.captureSession.id);
    } catch (error) {
      console.error('Failed to start capture:', error);
      this.showNotification('Failed to start capture: ' + error.message, 'error');
      throw error;
    }
  }

  async stopCapture() {
    if (!this.isRecording) {
      throw new Error('No active capture session');
    }

    try {
      // Take final screenshot
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await this.takeScreenshot(activeTab);

      // Stop the session
      await this.stopCaptureSession();

      // Process with AI
      await this.processWithAI();

      this.isRecording = false;
      this.updateExtensionState();

      this.showNotification('Capture completed! Processing with AI...', 'success');
      
      console.log('Capture session stopped and processing started');
    } catch (error) {
      console.error('Failed to stop capture:', error);
      this.showNotification('Failed to stop capture: ' + error.message, 'error');
      throw error;
    }
  }

  async createCaptureSession(tab) {
    const response = await fetch(`${API_BASE_URL}/capture/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getAuthToken()}`
      },
      body: JSON.stringify({
        title: `Process capture: ${tab.title}`,
        url: tab.url,
        browserInfo: {
          userAgent: navigator.userAgent,
          viewport: {
            width: screen.width,
            height: screen.height
          }
        }
      })
    });

    if (!response.ok) {
      throw new Error('Failed to create capture session');
    }

    return await response.json();
  }

  async stopCaptureSession() {
    const response = await fetch(`${API_BASE_URL}/capture/stop`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getAuthToken()}`
      },
      body: JSON.stringify({
        sessionId: this.captureSession.id
      })
    });

    if (!response.ok) {
      throw new Error('Failed to stop capture session');
    }

    return await response.json();
  }

  async takeScreenshot(tab) {
    try {
      // Request screen capture
      const streamId = await new Promise((resolve, reject) => {
        chrome.desktopCapture.chooseDesktopMedia(['tab'], tab, (streamId) => {
          if (streamId) {
            resolve(streamId);
          } else {
            reject(new Error('User cancelled screen capture or permission denied'));
          }
        });
      });

      // Capture visible tab
      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
        format: 'png',
        quality: 90
      });

      // Convert to blob
      const response = await fetch(dataUrl);
      const blob = await response.blob();

      // Upload screenshot
      await this.uploadScreenshot(blob, tab);

      this.sequenceNumber++;
    } catch (error) {
      console.error('Failed to take screenshot:', error);
      // Don't throw - continue capture even if screenshot fails
    }
  }

  async uploadScreenshot(blob, tab) {
    const formData = new FormData();
    formData.append('screenshot', blob, `screenshot-${this.sequenceNumber}.png`);
    formData.append('sequenceNumber', this.sequenceNumber.toString());
    formData.append('url', tab.url);
    formData.append('title', tab.title);
    formData.append('timestamp', new Date().toISOString());

    const response = await fetch(`${API_BASE_URL}/capture/${this.captureSession.id}/screenshot`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${await this.getAuthToken()}`
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error('Failed to upload screenshot');
    }

    const result = await response.json();
    this.screenshots.push(result);
    return result;
  }

  recordInteraction(interaction, tab) {
    if (!this.isRecording) return;

    const interactionData = {
      ...interaction,
      sequenceNumber: this.sequenceNumber,
      url: tab.url,
      timestamp: new Date().toISOString(),
      tabInfo: {
        title: tab.title,
        url: tab.url
      }
    };

    this.interactions.push(interactionData);

    // Send to backend
    this.sendInteractionToBackend(interactionData);

    // Take screenshot after interaction
    setTimeout(() => {
      this.takeScreenshot(tab);
    }, 100);
  }

  async sendInteractionToBackend(interaction) {
    try {
      await fetch(`${API_BASE_URL}/capture/${this.captureSession.id}/interaction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAuthToken()}`
        },
        body: JSON.stringify(interaction)
      });
    } catch (error) {
      console.error('Failed to send interaction to backend:', error);
    }
  }

  async processWithAI() {
    try {
      const response = await fetch(`${API_BASE_URL}/capture/${this.captureSession.id}/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to start AI processing');
      }

      const result = await response.json();
      
      // Open results page
      chrome.tabs.create({
        url: `http://localhost:3000/guides/${result.guideId}`
      });

    } catch (error) {
      console.error('AI processing failed:', error);
      this.showNotification('AI processing failed: ' + error.message, 'error');
    }
  }

  async injectContentScript(tabId) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['src/content/content-script.js']
      });
    } catch (error) {
      console.error('Failed to inject content script:', error);
    }
  }

  async capturePageChange(tab) {
    if (this.isRecording) {
      // Record navigation interaction
      this.recordInteraction({
        type: 'navigate',
        url: tab.url,
        title: tab.title
      }, tab);
    }
  }

  updateExtensionState() {
    // Update context menus
    chrome.contextMenus.update('processmaster-start-capture', {
      enabled: !this.isRecording
    });
    chrome.contextMenus.update('processmaster-stop-capture', {
      enabled: this.isRecording
    });

    // Update badge
    chrome.action.setBadgeText({
      text: this.isRecording ? 'REC' : ''
    });
    chrome.action.setBadgeBackgroundColor({
      color: this.isRecording ? '#ff0000' : '#000000'
    });
  }

  async checkAuthStatus() {
    try {
      const token = await this.getAuthToken();
      if (!token) {
        return { isAuthenticated: false };
      }

      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const user = await response.json();
        return { isAuthenticated: true, user };
      } else {
        return { isAuthenticated: false };
      }
    } catch (error) {
      return { isAuthenticated: false, error: error.message };
    }
  }

  async getAuthToken() {
    const result = await chrome.storage.local.get(['authToken']);
    return result.authToken;
  }

  showNotification(message, type = 'info') {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon-48.png',
      title: 'ProcessMaster Pro',
      message: message
    });
  }
}

// Initialize extension
const extension = new ProcessMasterExtension();