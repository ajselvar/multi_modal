// Amazon Connect Multi-Modal Demo
// Main application logic

import { config } from './config.js';
import { ChatWidget } from './chat.js';
import { VoiceWidget } from './voice.js';

console.log('Application initialized with config:', {
  region: config.aws.region,
  apiEndpoint: config.api.endpoint
});

// Application state
const AppState = {
  apiEndpoint: config.api.endpoint,
  chatActive: false,
  voiceActive: false,
  interactionMode: null // 'chat-only' or 'voice-chat'
};

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, initializing application...');
  initApp();
});

function initApp() {
  // Set up widget toggle functionality
  const widgetToggle = document.getElementById('widget-toggle');
  const widgetPanel = document.getElementById('widget-panel');
  const widgetClose = document.getElementById('widget-close');
  
  if (widgetToggle) {
    widgetToggle.addEventListener('click', () => {
      const isVisible = widgetPanel.style.display !== 'none';
      widgetPanel.style.display = isVisible ? 'none' : 'flex';
    });
  }
  
  if (widgetClose) {
    widgetClose.addEventListener('click', () => {
      widgetPanel.style.display = 'none';
    });
  }
  
  // Set up expand functionality
  const widgetExpand = document.getElementById('widget-expand');
  if (widgetExpand) {
    widgetExpand.addEventListener('click', () => {
      const isExpanded = widgetPanel.classList.contains('expanded');
      if (isExpanded) {
        widgetPanel.classList.remove('expanded');
        widgetExpand.innerHTML = `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15,3 21,3 21,9"></polyline>
            <polyline points="9,21 3,21 3,15"></polyline>
            <line x1="21" y1="3" x2="14" y2="10"></line>
            <line x1="3" y1="21" x2="10" y2="14"></line>
          </svg>
        `;
        widgetExpand.title = 'Expand';
      } else {
        widgetPanel.classList.add('expanded');
        widgetExpand.innerHTML = `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="4,14 10,14 10,20"></polyline>
            <polyline points="20,10 14,10 14,4"></polyline>
            <line x1="14" y1="10" x2="21" y2="3"></line>
            <line x1="3" y1="21" x2="10" y2="14"></line>
          </svg>
        `;
        widgetExpand.title = 'Collapse';
      }
    });
  }
  
  // Set up event listeners for chat/voice functionality
  const callBtn = document.getElementById('call-btn');
  const startChatBtn = document.getElementById('start-chat-btn');
  const startCallBtn = document.getElementById('start-call-btn');
  const sendMessageBtn = document.getElementById('send-message-btn');
  const chatInput = document.getElementById('chat-input');
  
  // End call buttons
  const hangupBtn = document.getElementById('hangup-btn');
  const continueChatBtn = document.getElementById('continue-chat-btn');
  const endChatBtn = document.getElementById('end-chat-btn');
  
  // Mode selection event handlers are handled in main.js
  // Removed duplicate handlers to prevent double chat creation
  
  if (callBtn) {
    callBtn.addEventListener('click', startVoice);
  }
  
  if (hangupBtn) {
    hangupBtn.addEventListener('click', () => VoiceWidget.hangupAll());
  }
  
  if (continueChatBtn) {
    continueChatBtn.addEventListener('click', () => VoiceWidget.endVoiceOnly());
  }
  
  if (endChatBtn) {
    endChatBtn.addEventListener('click', endChat);
  }
  
  if (sendMessageBtn) {
    sendMessageBtn.addEventListener('click', () => {
      const input = document.getElementById('chat-input');
      if (input && input.value && !input.disabled) {
        ChatWidget.sendMessage(input.value);
        input.value = '';
      }
    });
  }
  
  if (chatInput) {
    chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !chatInput.disabled && chatInput.value) {
        ChatWidget.sendMessage(chatInput.value);
        chatInput.value = '';
      }
    });
  }
  
  // Vehicle category tabs functionality
  const categoryTabs = document.querySelectorAll('.category-tab');
  categoryTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      categoryTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      // Here you could add logic to filter vehicles by category
    });
  });
  
  console.log('Application initialized successfully');
}

async function startChat() {
  console.log('Start chat button clicked');
  
  // Use ChatWidget to start chat
  await ChatWidget.start();
}

async function startChatOnly() {
  console.log('Start chat-only mode');
  
  // Hide mode selection and show chat interface
  showModeSelection(false);
  
  // Set interaction mode to chat-only
  AppState.interactionMode = 'chat-only';
  
  // Update status
  updateStatus('Connecting to chat...');
  
  try {
    // Use ChatWidget to start chat-only session
    await ChatWidget.start('chat-only');
    
    // Show end chat button
    showEndChatButton(true);
    
    // Update status
    updateStatus('Chat connected');
    
    // Enable chat input
    enableChatInput(true);
    
    displayMessage('✓ Chat-only session started. Type your message below.', 'system');
  } catch (error) {
    console.error('Failed to start chat-only session:', error);
    displayError('Failed to start chat session. Please try again.');
    showModeSelection(true);
    updateStatus('Ready to help');
  }
}

async function startVoiceWithChat() {
  console.log('Start voice+chat mode');
  
  // Hide mode selection
  showModeSelection(false);
  
  // Set interaction mode to voice+chat
  AppState.interactionMode = 'voice-chat';
  
  // Update status
  updateStatus('Starting voice call...');
  
  try {
    // Use VoiceWidget to start voice+chat session
    await VoiceWidget.start('voice-chat');
    
    // Update status
    updateStatus('Call connected');
    
    displayMessage('✓ Voice+chat session started. You can speak or type messages.', 'system');
  } catch (error) {
    console.error('Failed to start voice+chat session:', error);
    displayError('Failed to start voice call. Please try again.');
    showModeSelection(true);
    updateStatus('Ready to help');
  }
}

async function endChat() {
  console.log('End chat button clicked');
  
  // Use ChatWidget to end chat
  await ChatWidget.end();
  
  // Use the centralized reset function from main.js
  if (window.resetModeSelection) {
    window.resetModeSelection();
  } else {
    // Fallback if resetModeSelection is not available
    // Hide the "End Chat" button
    showEndChatButton(false);
    
    // Show mode selection again
    showModeSelection(true);
    
    // Hide all other buttons that shouldn't be visible
    const callBtn = document.getElementById('call-btn');
    if (callBtn) {
      callBtn.style.display = 'none';
    }
    
    const endCallOptions = document.getElementById('end-call-options');
    if (endCallOptions) {
      endCallOptions.style.display = 'none';
    }
    
    const continueChatBtn = document.getElementById('continue-chat-btn');
    if (continueChatBtn) {
      continueChatBtn.style.display = 'none';
    }
    
    const callBanner = document.getElementById('call-active-banner');
    if (callBanner) {
      callBanner.style.display = 'none';
    }
  }
  
  // Reset interaction mode
  AppState.interactionMode = null;
  
  // Disable chat input
  enableChatInput(false);
  
  // Update status
  updateStatus('Ready to help');
  
  displayMessage('Chat session ended. You can start a new session by selecting an option above.', 'system');
}

async function startVoice() {
  console.log('Start voice button clicked');
  
  // Use VoiceWidget to start voice
  await VoiceWidget.start();
}

async function endVoice() {
  console.log('End voice button clicked');
  
  // Use VoiceWidget to end voice
  await VoiceWidget.end();
}

async function callAPI(endpoint, data) {
  const url = `${AppState.apiEndpoint}${endpoint}`;
  console.log('Calling API:', url);
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API call failed: ${response.status} ${response.statusText} - ${errorText}`);
  }
  
  return response.json();
}

function updateStatus(status) {
  const statusElement = document.getElementById('connection-status');
  if (statusElement) {
    statusElement.textContent = status;
    console.log(`Status updated:`, status);
  }
}

function showCallBanner(show) {
  const banner = document.getElementById('call-active-banner');
  if (banner) {
    banner.style.display = show ? 'flex' : 'none';
  }
}

function toggleCallButtons(callActive) {
  const callBtn = document.getElementById('call-btn');
  const endCallOptions = document.getElementById('end-call-options');
  
  if (callBtn) {
    callBtn.style.display = callActive ? 'none' : 'flex';
  }
  
  if (endCallOptions) {
    endCallOptions.style.display = callActive ? 'flex' : 'none';
  }
}

function showContinueChatButton(show) {
  const continueChatBtn = document.getElementById('continue-chat-btn');
  if (continueChatBtn) {
    continueChatBtn.style.display = show ? 'flex' : 'none';
  }
}

function showEndChatButton(show) {
  const endChatBtn = document.getElementById('end-chat-btn');
  if (endChatBtn) {
    endChatBtn.style.display = show ? 'flex' : 'none';
  }
}

function showModeSelection(show) {
  const modeSelection = document.getElementById('mode-selection');
  if (modeSelection) {
    modeSelection.style.display = show ? 'flex' : 'none';
  }
}

function enableChatInput(enabled) {
  const chatInput = document.getElementById('chat-input');
  const sendBtn = document.getElementById('send-message-btn');
  
  if (chatInput) {
    chatInput.disabled = !enabled;
  }
  
  if (sendBtn) {
    sendBtn.disabled = !enabled;
  }
}

// Export additional UI helper functions
export { updateStatus, displayMessage, displayError, callAPI, showCallBanner, toggleCallButtons, enableChatInput, showContinueChatButton, showEndChatButton, showModeSelection };

function displayMessage(message, sender = 'system', senderName = null) {
  const container = document.getElementById('chat-messages');
  if (container) {
    // Clear welcome message if present
    const welcomeMessage = container.querySelector('.welcome-message');
    if (welcomeMessage) {
      welcomeMessage.remove();
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${sender}`;
    
    // Add sender name for agent messages
    if (sender === 'agent' && senderName) {
      const nameSpan = document.createElement('div');
      nameSpan.className = 'message-sender-name';
      nameSpan.textContent = senderName;
      messageDiv.appendChild(nameSpan);
    }
    
    const contentSpan = document.createElement('div');
    contentSpan.className = 'message-content';
    contentSpan.textContent = message;
    messageDiv.appendChild(contentSpan);
    
    container.appendChild(messageDiv);
    
    // Auto-scroll to bottom
    container.scrollTop = container.scrollHeight;
  }
}

function displayError(message) {
  const errorDiv = document.getElementById('error-message');
  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      errorDiv.style.display = 'none';
    }, 5000);
  }
}
