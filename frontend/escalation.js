// Escalation Widget for combined chat-voice interactions
// Handles escalated interactions where chat is preserved and voice is added
import {
  ConsoleLogger,
  DefaultDeviceController,
  DefaultMeetingSession,
  LogLevel,
  MeetingSessionConfiguration
} from 'amazon-chime-sdk-js';
import { updateStatus, displayMessage, displayError, callAPI, showCallBanner, enableChatInput } from './app.js';

export const EscalationWidget = {
    // Chat session (preserved from ChatWidget)
    chatSession: null,
    chatContactId: null,
    
    // Voice session (new for escalation)
    meetingSession: null,
    voiceContactId: null,
    audioElement: null,
    
    // State management
    mode: 'escalated', // Always escalated mode
    escalationActive: false,

    // Initialize escalation widget with existing chat session
    // Requirements: 5.2, 5.4
    async initializeWithChatSession(chatSession, chatContactId) {
        console.log('--- EscalationWidget.initializeWithChatSession() called ---');
        console.log('Preserving chat session:', { chatContactId });

        try {
            // Preserve existing chat session and contact ID
            this.chatSession = chatSession;
            this.chatContactId = chatContactId;
            
            // Update UI to show escalation mode
            this.updateUIForEscalation();
            
            // Keep chat input enabled during escalation
            enableChatInput(true);
            
            console.log('EscalationWidget initialized with preserved chat session');
            displayMessage('✓ Chat session preserved. Preparing voice connection...', 'system');
            
        } catch (error) {
            console.error('Failed to initialize EscalationWidget:', error);
            displayError('Failed to initialize escalation: ' + error.message);
            throw error;
        }
    },

    // Start voice connection for escalated interaction
    // Requirements: 5.2, 5.3
    async startVoiceConnection(voiceContactData) {
        console.log('--- EscalationWidget.startVoiceConnection() called ---');
        console.log('Voice contact data:', voiceContactData);

        try {
            updateStatus('Connecting to voice...');
            
            // Store voice contact ID
            this.voiceContactId = voiceContactData.contactId;
            
            // Parse the connection data from Connect
            const connectionData = voiceContactData.connectionData;
            
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
            const logger = new ConsoleLogger('EscalationWidget', LogLevel.INFO);

            // Create device controller
            const deviceController = new DefaultDeviceController(logger);

            // Create meeting session
            this.meetingSession = new DefaultMeetingSession(
                configuration,
                logger,
                deviceController
            );

            // Get or create audio element
            this.audioElement = document.getElementById('escalation-voice-audio');
            if (!this.audioElement) {
                this.audioElement = document.createElement('audio');
                this.audioElement.id = 'escalation-voice-audio';
                document.body.appendChild(this.audioElement);
            }

            // Bind audio element
            await this.meetingSession.audioVideo.bindAudioElement(this.audioElement);

            // Set up observers
            const observer = {
                audioVideoDidStart: () => {
                    console.log('Escalation voice started');
                    this.handleVoiceConnected();
                },
                audioVideoDidStop: (sessionStatus) => {
                    console.log('Escalation voice stopped:', sessionStatus);
                    this.handleVoiceDisconnected();
                }
            };

            this.meetingSession.audioVideo.addObserver(observer);

            // Start the session
            await this.meetingSession.audioVideo.start();

            // Choose audio input device (microphone)
            const audioInputDevices = await this.meetingSession.audioVideo.listAudioInputDevices();
            if (audioInputDevices.length > 0) {
                await this.meetingSession.audioVideo.startAudioInput(audioInputDevices[0].deviceId);
                console.log('Escalation audio input started:', audioInputDevices[0].label);
            }

            // Choose audio output device (speakers)
            const audioOutputDevices = await this.meetingSession.audioVideo.listAudioOutputDevices();
            if (audioOutputDevices.length > 0) {
                await this.meetingSession.audioVideo.chooseAudioOutput(audioOutputDevices[0].deviceId);
                console.log('Escalation audio output selected:', audioOutputDevices[0].label);
            }

            console.log('Escalation voice session started successfully');
            
        } catch (error) {
            console.error('Failed to start escalation voice:', error);
            updateStatus('Voice escalation failed');
            displayError('Failed to connect voice: ' + error.message);
            throw error;
        }
    },

    // Handle voice connection established
    // Requirements: 5.3, 8.1
    handleVoiceConnected() {
        console.log('Escalation voice connection established');
        updateStatus('Voice call active (escalated)');
        this.escalationActive = true;
        
        displayMessage('✓ Voice escalation successful! You can now speak while continuing to chat.', 'system');

        // Show escalation UI elements
        this.showEscalationControls();
        showCallBanner(true);
    },

    // Handle voice connection ended
    // Requirements: 8.2, 8.3
    handleVoiceDisconnected() {
        console.log('Escalation voice connection ended');
        
        if (this.escalationActive) {
            // Voice ended but chat continues
            updateStatus('Chat active (voice ended)');
            this.escalationActive = false;
            
            displayMessage('Voice call ended. You can continue chatting.', 'system');
            
            // Hide escalation controls but keep chat active
            this.hideEscalationControls();
            showCallBanner(false);
            
            // Show end chat button since only chat is active now
            this.showChatOnlyControls();
        }
    },

    // Send chat message (preserved functionality)
    // Requirements: 5.4
    sendMessage(text) {
        if (!this.chatSession) {
            console.error('No active chat session in escalation');
            return;
        }

        if (!text || text.trim() === '') {
            console.warn('Empty message, not sending');
            return;
        }

        console.log('Sending escalation chat message:', text);

        this.chatSession.sendMessage({
            contentType: 'text/plain',
            message: text
        });

        // Display own message
        displayMessage(text, 'customer');
    },

    // Continue in chat only (end voice portion)
    // Requirements: 8.1, 8.2
    async continueInChatOnly() {
        console.log('--- EscalationWidget.continueInChatOnly() called ---');
        console.log('EscalationWidget state before ending voice:', {
            voiceContactId: this.voiceContactId,
            chatContactId: this.chatContactId,
            chatSession: this.chatSession ? 'exists' : 'null',
            escalationActive: this.escalationActive
        });
        
        if (!this.voiceContactId) {
            console.error('No active voice contact to end');
            displayError('No active voice call');
            return;
        }

        try {
            updateStatus('Ending voice call...');
            
            // Stop the meeting session
            if (this.meetingSession) {
                console.log('Stopping Chime meeting session');
                this.meetingSession.audioVideo.stop();
            }

            // Call Lambda to stop the voice contact
            console.log('Calling /stop-contact API for voice contact:', this.voiceContactId);
            await callAPI('/stop-contact', { contactId: this.voiceContactId });
            console.log('Escalated voice contact stopped successfully');
            
            // Clear voice contact ID
            this.voiceContactId = null;
            
            displayMessage('Voice call ended. Continuing in chat only.', 'system');
            
            // Transition back to chat-only mode
            console.log('About to transition to chat-only mode with chat session data:', {
                chatContactId: this.chatContactId,
                chatSession: this.chatSession ? 'exists' : 'null'
            });
            await this.transitionToChatOnly();
            
        } catch (error) {
            console.error('Failed to end escalated voice call:', error);
            displayError('Failed to end voice call: ' + error.message);
        }
    },

    // End entire escalated session (both chat and voice)
    // Requirements: 8.4, 8.5
    async endEscalatedSession() {
        console.log('--- EscalationWidget.endEscalatedSession() called ---');
        
        try {
            updateStatus('Ending escalated session...');
            
            // Stop voice if active
            if (this.meetingSession && this.voiceContactId) {
                this.meetingSession.audioVideo.stop();
                await callAPI('/stop-contact', { contactId: this.voiceContactId });
                console.log('Escalated voice contact stopped');
            }

            // Stop chat
            if (this.chatSession && this.chatContactId) {
                this.chatSession.disconnectParticipant();
                await callAPI('/stop-contact', { contactId: this.chatContactId });
                console.log('Escalated chat contact stopped');
            }
            
            // Reset state
            this.cleanup();
            
            // Use centralized reset function
            if (window.resetModeSelection) {
                window.resetModeSelection();
            }
            
            displayMessage('Escalated session ended', 'system');
            
        } catch (error) {
            console.error('Failed to end escalated session:', error);
            displayError('Failed to end session: ' + error.message);
        }
    },

    // Transition back to ChatWidget (de-escalation)
    // Requirements: 8.3, 8.4
    async transitionToChatOnly() {
        console.log('--- EscalationWidget.transitionToChatOnly() called ---');
        
        try {
            // Import ChatWidget and endChat function
            const { ChatWidget } = await import('./chat.js');
            
            // Ensure we have valid session data to transfer
            if (!this.chatSession || !this.chatContactId) {
                console.error('Missing chat session or contact ID for transfer:', {
                    chatSession: this.chatSession ? 'exists' : 'null',
                    chatContactId: this.chatContactId
                });
                throw new Error('Cannot transfer to chat-only: missing session data');
            }
            
            // Transfer chat session back to ChatWidget
            console.log('Transferring session back to ChatWidget:', {
                escalationChatContactId: this.chatContactId,
                escalationChatSession: this.chatSession ? 'exists' : 'null'
            });
            
            ChatWidget.session = this.chatSession;
            ChatWidget.contactId = this.chatContactId;
            ChatWidget.mode = 'chat-only';
            ChatWidget.escalationEnabled = false;
            
            console.log('ChatWidget after transfer:', {
                contactId: ChatWidget.contactId,
                session: ChatWidget.session ? 'exists' : 'null',
                mode: ChatWidget.mode
            });
            
            // Verify the transfer was successful
            if (!ChatWidget.session || !ChatWidget.contactId) {
                console.error('Session transfer failed - ChatWidget missing data after transfer');
                throw new Error('Session transfer failed');
            }
            
            // Clear escalation state AFTER successful transfer
            this.chatSession = null;
            this.chatContactId = null;
            this.escalationActive = false;
            
            // Update UI to chat-only mode
            this.hideEscalationControls();
            ChatWidget.updateUIForMode();
            
            // Show end chat button for chat-only mode
            const { showEndChatButton, endChat } = await import('./app.js');
            showEndChatButton(true);
            
            // Restore original End Chat button handler
            const endChatBtn = document.getElementById('end-chat-btn');
            if (endChatBtn) {
                // Remove escalation handler and restore original handler
                endChatBtn.replaceWith(endChatBtn.cloneNode(true));
                const newEndChatBtn = document.getElementById('end-chat-btn');
                
                // Use the original endChat function from app.js instead of ChatWidget.end directly
                newEndChatBtn.onclick = async () => {
                    console.log('End chat button clicked (restored from escalation)');
                    console.log('About to call endChat function with ChatWidget state:', {
                        session: ChatWidget.session ? 'exists' : 'null',
                        contactId: ChatWidget.contactId,
                        mode: ChatWidget.mode
                    });
                    
                    // Call the original endChat function which handles the full flow
                    await endChat();
                };
            }
            
            updateStatus('Chat active');
            displayMessage('✓ Returned to chat-only mode.', 'system');
            
            console.log('Successfully transitioned back to ChatWidget');
            
        } catch (error) {
            console.error('Failed to transition to chat-only:', error);
            displayError('Failed to transition to chat-only: ' + error.message);
        }
    },

    // Update UI for escalation mode
    // Requirements: 5.2, 5.3
    updateUIForEscalation() {
        console.log('Updating UI for escalation mode');
        
        // Hide mode selection
        const modeSelection = document.getElementById('mode-selection');
        if (modeSelection) {
            modeSelection.style.display = 'none';
        }
        
        // Hide other action buttons
        const callBtn = document.getElementById('call-btn');
        if (callBtn) {
            callBtn.style.display = 'none';
        }
        
        const endChatBtn = document.getElementById('end-chat-btn');
        if (endChatBtn) {
            endChatBtn.style.display = 'none';
        }
        
        // Hide escalation button (no longer needed)
        const escalateBtn = document.getElementById('escalate-to-voice-btn');
        if (escalateBtn) {
            escalateBtn.style.display = 'none';
        }
    },

    // Show escalation-specific controls
    // Requirements: 8.1, 8.2
    showEscalationControls() {
        console.log('Showing escalation controls');
        
        // Show end call options with escalation-specific buttons
        const endCallOptions = document.getElementById('end-call-options');
        if (endCallOptions) {
            endCallOptions.style.display = 'flex';
        }
        
        // Show continue chat button (de-escalation)
        const continueChatBtn = document.getElementById('continue-chat-btn');
        if (continueChatBtn) {
            continueChatBtn.style.display = 'flex';
            // Remove any existing event listeners to prevent conflicts
            continueChatBtn.replaceWith(continueChatBtn.cloneNode(true));
            // Get the new element after replacement
            const newContinueChatBtn = document.getElementById('continue-chat-btn');
            // Add escalation-specific click handler
            newContinueChatBtn.onclick = () => this.continueInChatOnly();
        }
        
        // Show hangup button (end entire session)
        const hangupBtn = document.getElementById('hangup-btn');
        if (hangupBtn) {
            hangupBtn.style.display = 'flex';
            // Remove any existing event listeners to prevent conflicts
            hangupBtn.replaceWith(hangupBtn.cloneNode(true));
            // Get the new element after replacement
            const newHangupBtn = document.getElementById('hangup-btn');
            // Add escalation-specific click handler
            newHangupBtn.onclick = () => this.endEscalatedSession();
        }
    },

    // Hide escalation controls
    hideEscalationControls() {
        console.log('Hiding escalation controls');
        
        const endCallOptions = document.getElementById('end-call-options');
        if (endCallOptions) {
            endCallOptions.style.display = 'none';
        }
    },

    // Show chat-only controls after voice ends
    showChatOnlyControls() {
        console.log('Showing chat-only controls after escalation');
        
        const { showEndChatButton } = import('./app.js');
        if (showEndChatButton) {
            showEndChatButton(true);
        }
        
        // Update end chat button handler for escalation context
        const endChatBtn = document.getElementById('end-chat-btn');
        if (endChatBtn) {
            // Remove any existing event listeners to prevent conflicts
            endChatBtn.replaceWith(endChatBtn.cloneNode(true));
            // Get the new element after replacement
            const newEndChatBtn = document.getElementById('end-chat-btn');
            // Add escalation-specific click handler
            newEndChatBtn.onclick = () => this.endEscalatedSession();
        }
    },

    // Cleanup escalation state
    cleanup() {
        console.log('Cleaning up EscalationWidget state');
        
        this.chatSession = null;
        this.chatContactId = null;
        this.meetingSession = null;
        this.voiceContactId = null;
        this.escalationActive = false;
        
        // Remove audio element
        if (this.audioElement) {
            this.audioElement.remove();
            this.audioElement = null;
        }
        
        // Reset UI
        this.hideEscalationControls();
        showCallBanner(false);
        enableChatInput(false);
    }
};