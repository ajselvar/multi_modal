// Main entry point for the application
import 'amazon-connect-chatjs';
import { config } from './config.js';
import { ChatWidget } from './chat.js';
import { VoiceWidget } from './voice.js';
import { wsClient } from './websocket.js';
import { displayMessage } from './app.js';
import './app.js';

// Application state for mode selection
const AppState = {
  selectedMode: null, // 'chat-only' or 'voice-chat'
  isConnected: false,
  showModeSelection: true
};

// Initialize mode selection event handlers when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initializeModeSelection();
});

function initializeModeSelection() {
  const startChatBtn = document.getElementById('start-chat-btn');
  const startCallBtn = document.getElementById('start-call-btn');
  
  if (startChatBtn) {
    startChatBtn.addEventListener('click', () => handleModeSelection('chat-only'));
  }
  
  if (startCallBtn) {
    startCallBtn.addEventListener('click', () => handleModeSelection('voice-chat'));
  }
  
  console.log('Mode selection event handlers initialized');
}

function handleModeSelection(mode) {
  console.log(`Mode selected: ${mode}`);
  
  // Update application state
  AppState.selectedMode = mode;
  AppState.showModeSelection = false;
  
  // Hide mode selection interface
  const modeSelection = document.getElementById('mode-selection');
  if (modeSelection) {
    modeSelection.style.display = 'none';
  }
  
  // Initialize chat or voice based on selected mode
  if (mode === 'chat-only') {
    initializeChatOnly();
  } else if (mode === 'voice-chat') {
    initializeVoiceWithChat();
  }
}

async function initializeChatOnly() {
  console.log('Initializing chat-only mode');
  
  try {
    // Connect WebSocket
    await wsClient.connect();
    
    // Pass mode to chat initialization
    await ChatWidget.start(AppState.selectedMode);
    
    // Update connection state
    AppState.isConnected = true;
    
    // Show end chat button
    const endChatBtn = document.getElementById('end-chat-btn');
    if (endChatBtn) {
      endChatBtn.style.display = 'flex';
    }
    
    // No need for additional message here - ChatWidget.handleConnected() already shows the appropriate message
  } catch (error) {
    console.error('Failed to initialize chat-only mode:', error);
    resetModeSelection();
    displayMessage('Failed to start chat session. Please try again.', 'system');
  }
}

async function initializeVoiceWithChat() {
  console.log('Initializing voice+chat mode');
  
  try {
    // Connect WebSocket
    await wsClient.connect();
    
    // Pass mode to voice initialization
    await VoiceWidget.start(AppState.selectedMode);
    
    // Update connection state
    AppState.isConnected = true;
    
    displayMessage('✓ Voice+chat session started. You can speak or type messages.', 'system');
  } catch (error) {
    console.error('Failed to initialize voice+chat mode:', error);
    resetModeSelection();
    displayMessage('Failed to start voice call. Please try again.', 'system');
  }
}

function resetModeSelection() {
  console.log('Resetting mode selection');
  
  // Disconnect WebSocket if connected
  if (wsClient.isConnected) {
    wsClient.disconnect();
  }
  
  // Reset application state
  AppState.selectedMode = null;
  AppState.isConnected = false;
  AppState.showModeSelection = true;
  
  // Show mode selection interface
  const modeSelection = document.getElementById('mode-selection');
  if (modeSelection) {
    modeSelection.style.display = 'flex';
  }
  
  // Hide all action buttons that shouldn't be visible in initial state
  const endChatBtn = document.getElementById('end-chat-btn');
  if (endChatBtn) {
    endChatBtn.style.display = 'none';
  }
  
  // Hide legacy call button
  const callBtn = document.getElementById('call-btn');
  if (callBtn) {
    callBtn.style.display = 'none';
  }
  
  // Hide end call options
  const endCallOptions = document.getElementById('end-call-options');
  if (endCallOptions) {
    endCallOptions.style.display = 'none';
  }
  
  // Hide continue chat button
  const continueChatBtn = document.getElementById('continue-chat-btn');
  if (continueChatBtn) {
    continueChatBtn.style.display = 'none';
  }
  
  // Hide call active banner
  const callBanner = document.getElementById('call-active-banner');
  if (callBanner) {
    callBanner.style.display = 'none';
  }
}

// Set up WebSocket message handlers
wsClient.onMessage('chatContactCreated', (message) => {
  console.log('Chat contact created automatically:', message.data);
  const { contactId, participantId, participantToken } = message.data;

  // Pass the selected mode to chat initialization
  ChatWidget.initializeWithDetails(contactId, participantId, participantToken, AppState.selectedMode);
  // No need for additional message here - ChatWidget.handleConnected() already shows the appropriate message
});

wsClient.onMessage('error', (message) => {
  console.error('WebSocket error message:', message);
  displayMessage('WebSocket error: ' + (message.error || 'Unknown error'), 'system');
});

// Export AppState and functions for use by other modules
window.AppState = AppState;
window.resetModeSelection = resetModeSelection;

// Make config, ChatWidget, VoiceWidget, and wsClient available globally for compatibility
window.APP_CONFIG = config;
window.ChatWidget = ChatWidget;
window.VoiceWidget = VoiceWidget;
window.wsClient = wsClient;
