// Chat Widget using amazon-connect-chatjs
import { config } from './config.js';
import { updateStatus, displayMessage, displayError, callAPI, enableChatInput, showModeSelection } from './app.js';
import { wsClient } from './websocket.js';

export const ChatWidget = {
    session: null,
    contactId: null,
    mode: null, // 'chat-only' or 'voice-chat' - for UI management only
    escalationEnabled: false, // Track if escalation is available

    async start(mode = 'voice-chat') {
        console.log('--- ChatWidget.start() called with mode:', mode);
        updateStatus('Connecting to chat...');

        // Store the mode for UI management
        this.mode = mode;

        try {
            // Get UserId for this session
            const { getUserId } = await import('./userId.js');
            const userId = getUserId();
            
            // Call Lambda to get contact details with UserId in attributes
            const contactData = await callAPI('/start-chat-contact', { 
                attributes: {
                    userId: userId
                }
            });
            console.log('Chat contact data received:', contactData);

            // Store contact ID for later use
            this.contactId = contactData.contactId;

            // Initialize amazon-connect-chatjs
            const chatSession = connect.ChatSession.create({
                chatDetails: {
                    contactId: contactData.contactId,
                    participantId: contactData.participantId,
                    participantToken: contactData.participantToken
                },
                type: connect.ChatSession.SessionTypes.CUSTOMER,
                options: {
                    region: config.aws.region
                }
            });

            this.session = chatSession;

            // Set up event handlers
            this.session.onMessage(this.handleMessage.bind(this));
            this.session.onConnectionEstablished(this.handleConnected.bind(this));
            this.session.onConnectionBroken(this.handleDisconnected.bind(this));
            this.session.onEnded(this.handleEnded.bind(this));

            // Connect
            await this.session.connect();

            // Set up escalation handlers for chat-only mode
            if (mode === 'chat-only') {
                this.setupEscalationHandlers();
            }

            console.log(`Chat session connected successfully in ${mode} mode`);
        } catch (error) {
            console.error('Failed to start chat:', error);
            updateStatus('Chat connection failed');
            displayError('Failed to start chat: ' + error.message);
        }
    },

    handleConnected() {
        console.log('Chat connection established');
        updateStatus('Chat connected');
        
        // Show consistent message for both modes since agent hasn't connected yet
        // The actual agent connection will be indicated by separate WebSocket events or escalation events
        displayMessage('✓ Chat session ready. Waiting for agent to connect...', 'system');

        // Enable chat input
        enableChatInput(true);

        // Conditionally display voice-related UI elements based on mode
        this.updateUIForMode();
    },

    handleMessage(event) {
        console.log('Message received:', event);

        const data = event.data;
        const participantRole = data.ParticipantRole;
        const content = data.Content;
        
        // Skip messages without content
        if (!content || content === 'undefined') {
            console.log('Skipping message without content');
            return;
        }
        
        // Skip system messages
        if (participantRole === 'SYSTEM') {
            console.log('Skipping system message:', content);
            return;
        }
        
        // Skip our own messages (we already displayed them when sending)
        if (participantRole === 'CUSTOMER') {
            console.log('Skipping own message (already displayed)');
            return;
        }
        
        // Display agent messages
        const displayName = data.DisplayName || 'Agent';
        displayMessage(content, 'agent', displayName);
    },

    handleDisconnected() {
        console.log('Chat connection broken');
        updateStatus('Chat disconnected');
        displayError('Chat connection lost');
    },

    handleEnded() {
        displayMessage('Chat session ended', 'system');
        console.log('Chat session ended');
        updateStatus('Chat ended');

        // Disable chat input
        enableChatInput(false);

        // Hide escalation button when chat ends
        this.hideEscalationButton();
        this.escalationEnabled = false;

        // Reset UI elements when session ends
        if (this.mode === 'chat-only') {
            // For chat-only mode, use centralized reset function
            if (window.resetModeSelection) {
                window.resetModeSelection();
            } else {
                // Fallback: reset to show mode selection
                showModeSelection(true);
            }
        }

        // Clear contact ID and mode
        this.contactId = null;
        this.mode = null;
    },

    async end() {
        console.log('--- ChatWidget.end() called ---');
        console.log('ChatWidget.end() - Current state:', {
            contactId: this.contactId,
            session: this.session ? 'exists' : 'null',
            mode: this.mode
        });
        
        if (!this.contactId) {
            console.error('No active contact to end - contactId is:', this.contactId);
            displayError('No active chat session');
            return;
        }

        try {
            updateStatus('Ending chat...');
            
            console.log('ChatWidget.end() - About to call /stop-contact API with contactId:', this.contactId);
            
            // Call Lambda to stop the contact
            await callAPI('/stop-contact', { contactId: this.contactId });
            console.log('ChatWidget.end() - Contact stopped successfully via API');
            
            // Disconnect the chat session
            if (this.session) {
                console.log('ChatWidget.end() - Disconnecting chat session');
                this.session.disconnectParticipant();
            } else {
                console.log('ChatWidget.end() - No session to disconnect');
            }
            
            displayMessage('Chat ended by customer', 'system');
            
        } catch (error) {
            console.error('ChatWidget.end() - Failed to end chat:', error);
            displayError('Failed to end chat: ' + error.message);
        }
    },

    sendMessage(text) {
        if (!this.session) {
            console.error('No active chat session');
            return;
        }

        if (!text || text.trim() === '') {
            console.warn('Empty message, not sending');
            return;
        }

        console.log('Sending message:', text);

        this.session.sendMessage({
            contentType: 'text/plain',
            message: text
        });

        // Display own message
        displayMessage(text, 'customer');
    },

    // Update UI elements based on mode
    updateUIForMode() {
        console.log(`Updating UI for mode: ${this.mode}`);
        
        if (this.mode === 'chat-only') {
            // Hide voice-related UI elements for chat-only mode
            this.hideVoiceRelatedElements();
        } else if (this.mode === 'voice-chat') {
            // Show voice-related UI elements for voice+chat mode
            this.showVoiceRelatedElements();
        }
    },

    // Hide voice-related UI elements
    hideVoiceRelatedElements() {
        // Hide call active banner
        const callBanner = document.getElementById('call-active-banner');
        if (callBanner) {
            callBanner.style.display = 'none';
        }

        // Hide end call options (hangup, continue chat buttons)
        const endCallOptions = document.getElementById('end-call-options');
        if (endCallOptions) {
            endCallOptions.style.display = 'none';
        }

        // Hide legacy call button
        const callBtn = document.getElementById('call-btn');
        if (callBtn) {
            callBtn.style.display = 'none';
        }

        // Hide continue chat button
        const continueChatBtn = document.getElementById('continue-chat-btn');
        if (continueChatBtn) {
            continueChatBtn.style.display = 'none';
        }

        console.log('Voice-related UI elements hidden for chat-only mode');
    },

    // Show voice-related UI elements
    showVoiceRelatedElements() {
        // Voice-related elements are shown/hidden by VoiceWidget based on call state
        // This method is here for completeness and future extensibility
        console.log('Voice-related UI elements managed by VoiceWidget for voice+chat mode');
    },

    // Initialize chat with provided contact details (for automatic chat creation via WebSocket)
    async initializeWithDetails(contactId, participantId, participantToken, mode = 'voice-chat') {
        console.log('--- ChatWidget.initializeWithDetails() called ---');
        console.log('Contact details:', { contactId, participantId, participantToken, mode });

        // Store the mode for UI management
        this.mode = mode;

        try {
            // Store contact ID
            this.contactId = contactId;

            // Initialize amazon-connect-chatjs with provided details
            const chatSession = connect.ChatSession.create({
                chatDetails: {
                    contactId: contactId,
                    participantId: participantId,
                    participantToken: participantToken
                },
                type: connect.ChatSession.SessionTypes.CUSTOMER,
                options: {
                    region: config.aws.region
                }
            });

            this.session = chatSession;

            // Set up event handlers
            this.session.onMessage(this.handleMessage.bind(this));
            this.session.onConnectionEstablished(this.handleConnected.bind(this));
            this.session.onConnectionBroken(this.handleDisconnected.bind(this));
            this.session.onEnded(this.handleEnded.bind(this));

            // Connect
            await this.session.connect();

            console.log(`Chat session initialized with provided details in ${mode} mode`);
        } catch (error) {
            console.error('Failed to initialize chat with details:', error);
            updateStatus('Chat initialization failed');
            displayError('Failed to initialize chat: ' + error.message);
        }
    },

    // Set up escalation event handlers
    // Requirements: 4.1, 4.2
    setupEscalationHandlers() {
        console.log('Setting up escalation handlers for chat-only mode');
        
        // Listen for escalation enable events from WebSocket
        wsClient.onMessage('ENABLE_ESCALATION', (message) => {
            console.log('Received ENABLE_ESCALATION event:', message);
            
            // Verify this is for our current chat contact
            if (message.chatContactId === this.contactId) {
                this.enableEscalation();
            }
        });
    },

    // Enable escalation UI
    // Requirements: 4.1, 4.3
    enableEscalation() {
        console.log('Enabling escalation for contact:', this.contactId);
        
        this.escalationEnabled = true;
        this.showEscalationButton();
        
        displayMessage('✓ Connected to agent. You can start chatting!', 'system');
        displayMessage('✓ Voice escalation is now available. Click "Escalate to Voice" to upgrade your conversation.', 'system');
    },

    // Show escalation button
    // Requirements: 4.1, 4.3
    showEscalationButton() {
        const escalationBtn = document.getElementById('escalate-to-voice-btn');
        if (escalationBtn) {
            // Add click handler if not already added
            if (!escalationBtn.hasAttribute('data-handler-added')) {
                escalationBtn.addEventListener('click', () => this.handleEscalationClick());
                escalationBtn.setAttribute('data-handler-added', 'true');
            }
            
            // Show the button
            escalationBtn.style.display = 'flex';
            console.log('Escalation button shown');
        } else {
            console.error('Escalation button not found in HTML');
        }
    },

    // Hide escalation button
    // Requirements: 4.5
    hideEscalationButton() {
        const escalationBtn = document.getElementById('escalate-to-voice-btn');
        if (escalationBtn) {
            escalationBtn.style.display = 'none';
            console.log('Escalation button hidden');
        }
    },

    // Handle escalation button click
    // Requirements: 4.3, 5.1, 5.2, 5.5
    async handleEscalationClick() {
        console.log('Escalation button clicked for contact:', this.contactId);
        
        if (!this.contactId) {
            console.error('No active chat contact for escalation');
            displayError('No active chat session to escalate');
            return;
        }
        
        try {
            // Disable escalation button to prevent double-clicks
            const escalationBtn = document.getElementById('escalate-to-voice-btn');
            if (escalationBtn) {
                escalationBtn.disabled = true;
                escalationBtn.innerHTML = `
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <path d="M12 6v6l4 2"></path>
                    </svg>
                    <span>Escalating...</span>
                `;
            }
            
            updateStatus('Creating voice contact...');
            displayMessage('Escalating to voice call...', 'system');
            
            // Call API to create escalated voice contact
            const voiceContactData = await callAPI('/start-voice-contact', {
                relatedContactId: this.contactId
            });
            
            console.log('Escalated voice contact created:', voiceContactData);
            
            // Transition to EscalationWidget (Task 5)
            await this.transitionToEscalationWidget(voiceContactData);
            
        } catch (error) {
            console.error('Failed to escalate to voice:', error);
            displayError('Failed to escalate to voice: ' + error.message);
            updateStatus('Chat connected');
            
            // Re-enable escalation button on error
            const escalationBtn = document.getElementById('escalate-to-voice-btn');
            if (escalationBtn) {
                escalationBtn.disabled = false;
                escalationBtn.innerHTML = `
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                    </svg>
                    <span>Escalate to Voice</span>
                `;
            }
        }
    },

    // Transition from ChatWidget to EscalationWidget
    // Requirements: 5.2, 5.4, 5.5
    async transitionToEscalationWidget(voiceContactData) {
        console.log('--- ChatWidget.transitionToEscalationWidget() called ---');
        
        try {
            // Import EscalationWidget
            const { EscalationWidget } = await import('./escalation.js');
            
            // Initialize EscalationWidget with current chat session
            await EscalationWidget.initializeWithChatSession(this.session, this.contactId);
            
            // Start voice connection in EscalationWidget
            await EscalationWidget.startVoiceConnection(voiceContactData);
            
            // Clear ChatWidget state (session is now managed by EscalationWidget)
            this.session = null;
            this.contactId = null;
            this.mode = null;
            this.escalationEnabled = false;
            
            // Hide escalation button
            this.hideEscalationButton();
            
            console.log('Successfully transitioned to EscalationWidget');
            
        } catch (error) {
            console.error('Failed to transition to EscalationWidget:', error);
            displayError('Failed to complete escalation: ' + error.message);
            
            // Restore chat state on failure
            updateStatus('Chat connected');
            throw error;
        }
    }
};
