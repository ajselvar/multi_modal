// Voice Widget using amazon-chime-sdk-js
import {
  ConsoleLogger,
  DefaultDeviceController,
  DefaultMeetingSession,
  LogLevel,
  MeetingSessionConfiguration
} from 'amazon-chime-sdk-js';
import { config } from './config.js';
import { updateStatus, displayMessage, displayError, callAPI, showCallBanner, toggleCallButtons } from './app.js';
import { wsClient } from './websocket.js';

export const VoiceWidget = {
  meetingSession: null,
  contactId: null,
  audioElement: null,

  async start() {
    console.log('--- VoiceWidget.start() called ---');
    updateStatus('Connecting to voice...');

    try {
      // Get UserId for this session
      const { getUserId } = await import('./userId.js');
      const userId = getUserId();
      
      // Call Lambda to get WebRTC contact details, including UserId in attributes
      const contactData = await callAPI('/start-voice-contact', {
        attributes: {
          userId: userId
        }
      });
      console.log('Voice contact data received:', contactData);

      // Store contact ID for later use
      this.contactId = contactData.contactId;

      // Connect to WebSocket (registration happens automatically with UserId)
      try {
        await wsClient.connect();
        console.log('WebSocket connected and registered with UserId');
        
        // Set up handler for chat contact events
        wsClient.onMessage('CHAT_CONTACT_CREATED', this.handleChatContactCreated.bind(this));
        wsClient.onMessage('CHAT_AGENT_CONNECTED', this.handleChatAgentConnected.bind(this));
      } catch (error) {
        console.error('Failed to connect to WebSocket:', error);
        // Continue without WebSocket - voice will still work
      }

      // Parse the connection data from Connect
      const connectionData = contactData.connectionData;
      
      // Create Chime meeting session configuration
      const meetingResponse = {
        Meeting: connectionData.Meeting
      };
      
      const attendeeResponse = {
        Attendee: connectionData.Attendee
      };

      const configuration = new MeetingSessionConfiguration(
        meetingResponse,
        attendeeResponse
      );

      // Create logger
      const logger = new ConsoleLogger('VoiceWidget', LogLevel.INFO);

      // Create device controller
      const deviceController = new DefaultDeviceController(logger);

      // Create meeting session
      this.meetingSession = new DefaultMeetingSession(
        configuration,
        logger,
        deviceController
      );

      // Get or create audio element
      this.audioElement = document.getElementById('voice-audio');
      if (!this.audioElement) {
        this.audioElement = document.createElement('audio');
        this.audioElement.id = 'voice-audio';
        document.body.appendChild(this.audioElement);
      }

      // Bind audio element
      const audioOutputElement = this.audioElement;
      await this.meetingSession.audioVideo.bindAudioElement(audioOutputElement);

      // Set up observers
      const observer = {
        audioVideoDidStart: () => {
          console.log('Audio/Video started');
          this.handleConnected();
        },
        audioVideoDidStop: (sessionStatus) => {
          console.log('Audio/Video stopped:', sessionStatus);
          this.handleDisconnected();
        }
      };

      this.meetingSession.audioVideo.addObserver(observer);

      // Start the session
      await this.meetingSession.audioVideo.start();

      // Choose audio input device (microphone)
      const audioInputDevices = await this.meetingSession.audioVideo.listAudioInputDevices();
      if (audioInputDevices.length > 0) {
        await this.meetingSession.audioVideo.startAudioInput(audioInputDevices[0].deviceId);
        console.log('Audio input started:', audioInputDevices[0].label);
      }

      // Choose audio output device (speakers)
      const audioOutputDevices = await this.meetingSession.audioVideo.listAudioOutputDevices();
      if (audioOutputDevices.length > 0) {
        await this.meetingSession.audioVideo.chooseAudioOutput(audioOutputDevices[0].deviceId);
        console.log('Audio output selected:', audioOutputDevices[0].label);
      }

      console.log('Voice session started successfully');
    } catch (error) {
      console.error('Failed to start voice:', error);
      updateStatus('Voice connection failed');
      displayError('Failed to start voice: ' + error.message);
    }
  },

  handleConnected() {
    console.log('Voice connection established');
    updateStatus('Voice call active');
    
    displayMessage('✓ Voice call connected. You can now speak!', 'system');

    // Show call active banner and toggle buttons
    showCallBanner(true);
    toggleCallButtons(true);
  },

  async handleChatContactCreated(message) {
    console.log('Chat contact created event received:', message);
    
    // Store chat contact details
    this.chatContactDetails = {
      contactId: message.chatContactId,
      participantId: message.participantId,
      participantToken: message.participantToken
    };
    
    // Immediately initialize chat session (step 5)
    const { ChatWidget } = await import('./chat.js');
    await ChatWidget.initializeWithDetails(
      this.chatContactDetails.contactId,
      this.chatContactDetails.participantId,
      this.chatContactDetails.participantToken
    );
    
    displayMessage('✓ Chat session started. Waiting for agent to join...', 'system');
  },

  async handleChatAgentConnected(message) {
    console.log('Chat agent connected event received:', message);
    
    // Agent has connected to chat - show the "Continue in chat" button
    const { showContinueChatButton } = await import('./app.js');
    showContinueChatButton(true);
    
    displayMessage('✓ Agent connected to chat. You can now continue in chat after ending the voice call.', 'system');
  },

  handleDisconnected() {
    console.log('Voice connection ended');
    updateStatus('Voice call ended');

    // Hide call banner and toggle buttons
    showCallBanner(false);
    toggleCallButtons(false);

    // Disconnect WebSocket
    wsClient.disconnect();

    // Clear contact ID
    this.contactId = null;
  },

  async endVoiceOnly() {
    console.log('--- VoiceWidget.endVoiceOnly() called ---');
    
    try {
      updateStatus('Ending voice call...');
      
      // Stop the meeting session
      if (this.meetingSession) {
        this.meetingSession.audioVideo.stop();
      }

      // Call Lambda to stop the voice contact
      await callAPI('/stop-contact', { contactId: this.contactId });
      console.log('Voice contact stopped successfully');
      
      displayMessage('Voice call ended. You can continue chatting.', 'system');
      
      // Hide "Continue in chat" button and show "End Chat" button
      const { showContinueChatButton, showEndChatButton } = await import('./app.js');
      showContinueChatButton(false);
      showEndChatButton(true);
      
      // Hide call banner
      showCallBanner(false);
      
    } catch (error) {
      console.error('Failed to end voice call:', error);
      displayError('Failed to end voice call: ' + error.message);
    }
  },

  async hangupAll() {
    console.log('--- VoiceWidget.hangupAll() called ---');
    
    try {
      updateStatus('Ending call and chat...');
      
      // Stop the meeting session
      if (this.meetingSession) {
        this.meetingSession.audioVideo.stop();
      }

      // Call Lambda to stop the voice contact
      await callAPI('/stop-contact', { contactId: this.contactId });
      console.log('Voice contact stopped successfully');
      
      // Also end the chat
      const { ChatWidget } = await import('./chat.js');
      await ChatWidget.end();
      
      // Use the centralized reset function to ensure clean UI state
      if (window.resetModeSelection) {
        window.resetModeSelection();
      }
      
      displayMessage('Call and chat ended', 'system');
      
    } catch (error) {
      console.error('Failed to hang up:', error);
      displayError('Failed to hang up: ' + error.message);
    }
  }
};
