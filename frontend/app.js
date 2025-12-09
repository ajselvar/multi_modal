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
  voiceActive: false
};

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, initializing application...');
  initApp();
});

function initApp() {
  // Set up event listeners for new unified UI
  const callBtn = document.getElementById('call-btn');
  const endCallBtn = document.getElementById('end-call-btn');
  const sendMessageBtn = document.getElementById('send-message-btn');
  const chatInput = document.getElementById('chat-input');
  
  // End call buttons
  const hangupBtn = document.getElementById('hangup-btn');
  const continueChatBtn = document.getElementById('continue-chat-btn');
  const endChatBtn = document.getElementById('end-chat-btn');
  
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
  
  console.log('Application initialized successfully');
}

async function startChat() {
  console.log('Start chat button clicked');
  
  // Use ChatWidget to start chat
  await ChatWidget.start();
}

async function endChat() {
  console.log('End chat button clicked');
  
  // Use ChatWidget to end chat
  await ChatWidget.end();
  
  // Hide the "End Chat" button
  showEndChatButton(false);
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
export { updateStatus, displayMessage, displayError, callAPI, showCallBanner, toggleCallButtons, enableChatInput, showContinueChatButton, showEndChatButton };

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
