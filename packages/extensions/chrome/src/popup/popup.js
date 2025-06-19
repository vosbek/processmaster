// ProcessMaster Pro Extension Popup

class PopupController {
  constructor() {
    this.isRecording = false;
    this.recordingStartTime = null;
    this.durationTimer = null;
    this.user = null;
    
    this.initializeElements();
    this.setupEventListeners();
    this.initialize();
  }

  initializeElements() {
    // Status elements
    this.statusIndicator = document.getElementById('statusIndicator');
    this.statusDot = document.getElementById('statusDot');
    this.statusText = document.getElementById('statusText');

    // Auth elements
    this.authSection = document.getElementById('authSection');
    this.authRequired = document.getElementById('authRequired');
    this.authSuccess = document.getElementById('authSuccess');
    this.signInBtn = document.getElementById('signInBtn');
    this.signOutBtn = document.getElementById('signOutBtn');
    this.userName = document.getElementById('userName');
    this.userEmail = document.getElementById('userEmail');
    this.userAvatar = document.getElementById('userAvatar');

    // Recording elements
    this.recordingSection = document.getElementById('recordingSection');
    this.recordingTitle = document.getElementById('recordingTitle');
    this.recordingDetails = document.getElementById('recordingDetails');
    this.startCaptureBtn = document.getElementById('startCaptureBtn');
    this.stopCaptureBtn = document.getElementById('stopCaptureBtn');
    this.recordingStats = document.getElementById('recordingStats');
    this.screenshotCount = document.getElementById('screenshotCount');
    this.interactionCount = document.getElementById('interactionCount');
    this.duration = document.getElementById('duration');

    // Quick actions
    this.quickActions = document.getElementById('quickActions');
    this.viewGuidesBtn = document.getElementById('viewGuidesBtn');
    this.settingsBtn = document.getElementById('settingsBtn');

    // Utility elements
    this.loadingOverlay = document.getElementById('loadingOverlay');
    this.loadingText = document.getElementById('loadingText');
    this.errorMessage = document.getElementById('errorMessage');
    this.errorText = document.getElementById('errorText');
    this.dismissErrorBtn = document.getElementById('dismissErrorBtn');
  }

  setupEventListeners() {
    // Auth buttons
    this.signInBtn.addEventListener('click', () => this.handleSignIn());
    this.signOutBtn.addEventListener('click', () => this.handleSignOut());

    // Recording buttons
    this.startCaptureBtn.addEventListener('click', () => this.handleStartCapture());
    this.stopCaptureBtn.addEventListener('click', () => this.handleStopCapture());

    // Quick action buttons
    this.viewGuidesBtn.addEventListener('click', () => this.handleViewGuides());
    this.settingsBtn.addEventListener('click', () => this.handleSettings());

    // Error handling
    this.dismissErrorBtn.addEventListener('click', () => this.hideError());

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => this.handleKeyboard(e));
  }

  async initialize() {
    this.showLoading('Initializing...');
    
    try {
      // Check authentication status
      await this.checkAuthStatus();
      
      // Check recording status
      await this.checkRecordingStatus();
      
      this.hideLoading();
    } catch (error) {
      this.hideLoading();
      this.showError('Failed to initialize: ' + error.message);
    }
  }

  async checkAuthStatus() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'AUTH_STATUS' });
      
      if (response.isAuthenticated) {
        this.user = response.user;
        this.showAuthenticatedState();
      } else {
        this.showUnauthenticatedState();
      }
    } catch (error) {
      console.error('Failed to check auth status:', error);
      this.showUnauthenticatedState();
    }
  }

  async checkRecordingStatus() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
      
      if (response.isRecording) {
        this.isRecording = true;
        this.updateRecordingUI(response);
        this.startDurationTimer();
      } else {
        this.isRecording = false;
        this.updateReadyUI();
      }
    } catch (error) {
      console.error('Failed to check recording status:', error);
    }
  }

  showAuthenticatedState() {
    this.authRequired.style.display = 'none';
    this.authSuccess.style.display = 'block';
    this.recordingSection.style.display = 'block';
    this.quickActions.style.display = 'block';

    // Update user info
    if (this.user) {
      this.userName.textContent = `${this.user.firstName} ${this.user.lastName}`;
      this.userEmail.textContent = this.user.email;
      
      // Set avatar (you could use gravatar or initials)
      const initials = `${this.user.firstName?.[0] || ''}${this.user.lastName?.[0] || ''}`;
      this.userAvatar.textContent = initials || '👤';
    }

    this.updateStatus('Ready', 'ready');
  }

  showUnauthenticatedState() {
    this.authRequired.style.display = 'block';
    this.authSuccess.style.display = 'none';
    this.recordingSection.style.display = 'none';
    this.quickActions.style.display = 'none';

    this.updateStatus('Sign in required', 'error');
  }

  updateRecordingUI(status) {
    this.recordingTitle.textContent = 'Recording in Progress';
    this.recordingDetails.textContent = 'Capturing your process interactions...';
    
    this.startCaptureBtn.style.display = 'none';
    this.stopCaptureBtn.style.display = 'block';
    this.recordingStats.style.display = 'block';

    // Update stats
    this.screenshotCount.textContent = status.screenshotCount || 0;
    this.interactionCount.textContent = status.interactionCount || 0;

    this.updateStatus('Recording', 'recording');
  }

  updateReadyUI() {
    this.recordingTitle.textContent = 'Ready to Record';
    this.recordingDetails.textContent = 'Click "Start Capture" to begin recording your process';
    
    this.startCaptureBtn.style.display = 'block';
    this.stopCaptureBtn.style.display = 'none';
    this.recordingStats.style.display = 'none';

    this.updateStatus('Ready', 'ready');
    
    if (this.durationTimer) {
      clearInterval(this.durationTimer);
      this.durationTimer = null;
    }
  }

  updateStatus(text, type) {
    this.statusText.textContent = text;
    this.statusDot.className = `status-dot ${type}`;
  }

  async handleSignIn() {
    try {
      // Open the web app login page
      chrome.tabs.create({
        url: 'http://localhost:3000/auth/login?source=extension'
      });
      
      // Close popup
      window.close();
    } catch (error) {
      this.showError('Failed to open sign in page: ' + error.message);
    }
  }

  async handleSignOut() {
    try {
      this.showLoading('Signing out...');
      
      // Clear stored auth token
      await chrome.storage.local.remove(['authToken']);
      
      this.hideLoading();
      this.showUnauthenticatedState();
    } catch (error) {
      this.hideLoading();
      this.showError('Failed to sign out: ' + error.message);
    }
  }

  async handleStartCapture() {
    if (this.isRecording) return;

    try {
      this.showLoading('Starting capture...');
      
      const response = await chrome.runtime.sendMessage({ type: 'START_CAPTURE' });
      
      if (response.success) {
        this.isRecording = true;
        this.recordingStartTime = Date.now();
        this.updateRecordingUI({ screenshotCount: 0, interactionCount: 0 });
        this.startDurationTimer();
        this.hideLoading();
      } else {
        throw new Error(response.error || 'Failed to start capture');
      }
    } catch (error) {
      this.hideLoading();
      this.showError('Failed to start capture: ' + error.message);
    }
  }

  async handleStopCapture() {
    if (!this.isRecording) return;

    try {
      this.showLoading('Stopping capture and processing...');
      
      const response = await chrome.runtime.sendMessage({ type: 'STOP_CAPTURE' });
      
      if (response.success) {
        this.isRecording = false;
        this.updateReadyUI();
        this.hideLoading();
        
        // Show success message
        this.showSuccessMessage('Capture completed! Processing with AI...');
        
        // Close popup after a delay
        setTimeout(() => {
          window.close();
        }, 2000);
      } else {
        throw new Error(response.error || 'Failed to stop capture');
      }
    } catch (error) {
      this.hideLoading();
      this.showError('Failed to stop capture: ' + error.message);
    }
  }

  handleViewGuides() {
    chrome.tabs.create({
      url: 'http://localhost:3000/guides'
    });
    window.close();
  }

  handleSettings() {
    chrome.tabs.create({
      url: 'http://localhost:3000/settings'
    });
    window.close();
  }

  handleKeyboard(event) {
    if (event.ctrlKey && event.shiftKey) {
      if (event.key === 'S') {
        event.preventDefault();
        if (!this.isRecording) {
          this.handleStartCapture();
        }
      } else if (event.key === 'E') {
        event.preventDefault();
        if (this.isRecording) {
          this.handleStopCapture();
        }
      }
    }
  }

  startDurationTimer() {
    this.durationTimer = setInterval(() => {
      if (this.recordingStartTime) {
        const elapsed = Date.now() - this.recordingStartTime;
        const minutes = Math.floor(elapsed / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        this.duration.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      }
    }, 1000);
  }

  showLoading(text) {
    this.loadingText.textContent = text;
    this.loadingOverlay.style.display = 'flex';
  }

  hideLoading() {
    this.loadingOverlay.style.display = 'none';
  }

  showError(message) {
    this.errorText.textContent = message;
    this.errorMessage.style.display = 'block';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      this.hideError();
    }, 5000);
  }

  hideError() {
    this.errorMessage.style.display = 'none';
  }

  showSuccessMessage(message) {
    // Create a temporary success message
    const successEl = document.createElement('div');
    successEl.className = 'success-message';
    successEl.style.cssText = `
      position: absolute;
      top: 16px;
      left: 16px;
      right: 16px;
      background: #d1fae5;
      border: 1px solid #a7f3d0;
      border-radius: 6px;
      padding: 12px;
      z-index: 1002;
      color: #065f46;
      font-size: 13px;
      text-align: center;
    `;
    successEl.textContent = message;
    
    document.body.appendChild(successEl);
    
    // Remove after 3 seconds
    setTimeout(() => {
      if (successEl.parentNode) {
        successEl.parentNode.removeChild(successEl);
      }
    }, 3000);
  }

  // Periodically update stats while recording
  startStatsUpdateInterval() {
    setInterval(async () => {
      if (this.isRecording) {
        try {
          const response = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
          if (response.isRecording) {
            this.screenshotCount.textContent = response.screenshotCount || 0;
            this.interactionCount.textContent = response.interactionCount || 0;
          }
        } catch (error) {
          // Silently handle errors during status updates
        }
      }
    }, 2000);
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});