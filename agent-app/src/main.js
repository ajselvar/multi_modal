// Amazon Connect Agent Interface
// Uses Connect Streams JS to manage agent state and auto-accept related chat contacts

import 'amazon-connect-streams';
import { config } from './config.js';

const CONFIG = config;

// Application state
const AppState = {
    agent: null,
    contacts: new Map(),
    selectedContactId: null,
    voiceContactIds: new Set()
};

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    log('Initializing Amazon Connect Agent Interface...', 'info');
    initializeCCP();
});

// Initialize Connect CCP
function initializeCCP() {
    try {
        connect.core.initCCP(document.getElementById('ccp'), {
            ccpUrl: CONFIG.ccpUrl,
            region: CONFIG.region,
            loginPopup: true,
            loginPopupAutoClose: true,
            softphone: {
                allowFramedSoftphone: true
            }
        });

        log('CCP initialization started', 'info');
        setupEventHandlers();
    } catch (error) {
        log(`Failed to initialize CCP: ${error.message}`, 'error');
    }
}

// Setup Connect Streams event handlers
function setupEventHandlers() {
    // Agent events
    connect.agent(agent => {
        AppState.agent = agent;
        log(`Agent initialized: ${agent.getName()}`, 'success');
        
        agent.onRefresh(handleAgentRefresh);
        agent.onStateChange(handleAgentStateChange);
        agent.onRoutable(handleAgentRoutable);
        agent.onNotRoutable(handleAgentNotRoutable);
        agent.onOffline(handleAgentOffline);
    });

    // Contact events
    connect.contact(contact => {
        log(`Contact event: ${contact.getContactId()}`, 'info');
        handleContactEvent(contact);
    });
}

// Handle agent refresh
function handleAgentRefresh(agent) {
    log('Agent state refreshed', 'info');
    updateAgentStatus(agent);
}

// Handle agent state change
function handleAgentStateChange(agentStateChange) {
    const newState = agentStateChange.newState;
    log(`Agent state changed to: ${newState}`, 'info');
    updateAgentStatus(AppState.agent);
}

// Handle agent routable
function handleAgentRoutable(agent) {
    log('Agent is now routable', 'success');
    updateAgentStatus(agent);
}

// Handle agent not routable
function handleAgentNotRoutable(agent) {
    log('Agent is not routable', 'warning');
    updateAgentStatus(agent);
}

// Handle agent offline
function handleAgentOffline(agent) {
    log('Agent went offline', 'warning');
    updateAgentStatus(agent);
}

// Update agent status display
function updateAgentStatus(agent) {
    const statusElement = document.getElementById('agent-status');
    const agentState = agent.getState();
    const stateName = agentState.name;
    
    statusElement.textContent = stateName;
    statusElement.className = 'status-badge';
    
    if (stateName === 'Available') {
        statusElement.classList.add('available');
    } else if (stateName === 'Offline') {
        statusElement.classList.add('offline');
    } else {
        statusElement.classList.add('busy');
    }
}

// Handle contact events
function handleContactEvent(contact) {
    const contactId = contact.getContactId();
    const contactType = contact.getType();
    const contactState = contact.getStatus().type;
    
    log(`New contact detected: ${contactId}, Type: ${contactType}, State: ${contactState}`, 'info');
    
    // Store contact
    AppState.contacts.set(contactId, contact);
    
    // Track voice contacts
    if (contactType === connect.ContactType.VOICE) {
        AppState.voiceContactIds.add(contactId);
        log(`Added voice contact to tracking: ${contactId}`, 'info');
        
        // Check if this is an escalated voice contact
        checkEscalatedVoiceContact(contact);
    }
    
    // Check if this is a chat contact that should be auto-accepted immediately
    if (contactType === connect.ContactType.CHAT) {
        log(`Chat contact detected: ${contactId}, checking for auto-accept...`, 'info');
        // Check immediately in case the contact is already in a state that needs handling
        checkAndAutoAcceptChat(contact);
    }
    
    // Setup contact event handlers
    contact.onRefresh(c => handleContactRefresh(c));
    contact.onIncoming(c => handleContactIncoming(c));
    contact.onAccepted(c => handleContactAccepted(c));
    contact.onConnected(c => handleContactConnected(c));
    contact.onEnded(c => handleContactEnded(c));
    contact.onDestroy(c => handleContactDestroy(c));
    
    // Update UI
    updateContactsList();
}

// Handle contact refresh
function handleContactRefresh(contact) {
    log(`Contact refreshed: ${contact.getContactId()}`, 'info');
    updateContactsList();
    updateContactDetails();
}

// Handle incoming contact
function handleContactIncoming(contact) {
    const contactId = contact.getContactId();
    const contactType = contact.getType();
    
    log(`Incoming ${contactType} contact: ${contactId}`, 'info');
    
    // Check if this is a chat contact with a related voice contact
    if (contactType === connect.ContactType.CHAT) {
        checkAndAutoAcceptChat(contact);
    } else if (contactType === connect.ContactType.VOICE) {
        // Check if this is an escalated voice contact that needs manual handling
        handleEscalatedVoiceIncoming(contact);
    }
    
    updateContactsList();
}

// Check if chat should be auto-accepted
async function checkAndAutoAcceptChat(contact) {
    try {
        const contactId = contact.getContactId();
        const contactState = contact.getStatus().type;
        
        log(`Checking chat auto-accept for ${contactId}, state: ${contactState}`, 'info');
        
        // Get related contact ID - try multiple methods
        let relatedContactId = contact.getRelatedContactId();
        
        // If getRelatedContactId() doesn't work, try getting it from attributes
        if (!relatedContactId) {
            const attributes = contact.getAttributes();
            relatedContactId = attributes.relatedContactId?.value || attributes.RelatedContactId?.value;
            log(`Trying to get relatedContactId from attributes: ${relatedContactId}`, 'info');
        }
        
        log(`Chat contact ${contactId} relatedContactId: ${relatedContactId}`, 'info');
        log(`Current voice contacts: ${Array.from(AppState.voiceContactIds).join(', ')}`, 'info');
        
        if (relatedContactId) {
            log(`Chat has relatedContactId: ${relatedContactId}`, 'info');
            
            // Check if we have an active voice contact with this ID
            if (AppState.voiceContactIds.has(relatedContactId)) {
                log(`Auto-accepting chat related to active voice contact ${relatedContactId}`, 'success');
                
                // Auto-accept the chat
                contact.accept({
                    success: () => {
                        log(`Successfully auto-accepted chat contact ${contactId}`, 'success');
                    },
                    failure: (error) => {
                        log(`Failed to auto-accept chat ${contactId}: ${error}`, 'error');
                    }
                });
            } else {
                log(`Related voice contact ${relatedContactId} not found in active contacts`, 'warning');
                log(`Available voice contacts: ${Array.from(AppState.voiceContactIds).join(', ') || 'none'}`, 'warning');
            }
        } else {
            log(`Chat contact ${contactId} has no relatedContactId - manual accept required`, 'info');
        }
    } catch (error) {
        log(`Error checking chat auto-accept: ${error.message}`, 'error');
    }
}

// Check if this is an escalated voice contact
function checkEscalatedVoiceContact(contact) {
    try {
        const contactId = contact.getContactId();
        const attributes = contact.getAttributes();
        
        // Check for relatedContactId attribute indicating escalation
        const relatedContactId = attributes.relatedContactId?.value || attributes.RelatedContactId?.value;
        
        if (relatedContactId) {
            log(`Escalated voice contact detected: ${contactId} related to chat: ${relatedContactId}`, 'info');
            
            // Mark this contact as escalated for UI handling
            if (!AppState.escalatedContacts) {
                AppState.escalatedContacts = new Map();
            }
            AppState.escalatedContacts.set(contactId, {
                relatedContactId: relatedContactId,
                type: 'voice',
                requiresManualAccept: true
            });
            
            log(`Marked voice contact ${contactId} as escalated`, 'info');
        }
    } catch (error) {
        log(`Error checking escalated voice contact: ${error.message}`, 'error');
    }
}

// Handle incoming escalated voice contact
function handleEscalatedVoiceIncoming(contact) {
    const contactId = contact.getContactId();
    
    // Check if this is an escalated contact
    if (AppState.escalatedContacts && AppState.escalatedContacts.has(contactId)) {
        const escalationInfo = AppState.escalatedContacts.get(contactId);
        log(`Incoming escalated voice contact: ${contactId} (related to chat: ${escalationInfo.relatedContactId})`, 'info');
        log(`Escalated voice contact will be presented in CCP for manual accept/reject`, 'info');
        
        // Show informational notification about the escalation
        showEscalationInfo(contact, escalationInfo);
    }
}

// Show informational notification about escalation
function showEscalationInfo(contact, escalationInfo) {
    const contactId = contact.getContactId();
    
    log(`Showing escalation info for voice contact: ${contactId}`, 'info');
    
    // Create informational notification element
    const notification = document.createElement('div');
    notification.className = 'escalation-notification info';
    notification.id = `escalation-info-${contactId}`;
    
    notification.innerHTML = `
        <div class="escalation-header">
            <h3>🔄 Escalated Voice Call</h3>
            <span class="escalation-close" onclick="dismissEscalationInfo('${contactId}')">&times;</span>
        </div>
        <div class="escalation-content">
            <p><strong>Voice Contact:</strong> ${contactId}</p>
            <p><strong>Related Chat:</strong> ${escalationInfo.relatedContactId}</p>
            <p>Customer has escalated from chat to voice. Use the CCP to accept or reject this call. If accepted, you'll handle both chat and voice simultaneously.</p>
        </div>
    `;
    
    // Add to notifications container
    let container = document.getElementById('escalation-notifications');
    if (!container) {
        container = document.createElement('div');
        container.id = 'escalation-notifications';
        container.className = 'escalation-notifications-container';
        document.body.appendChild(container);
    }
    
    container.appendChild(notification);
    
    // Auto-dismiss after 15 seconds
    setTimeout(() => {
        if (document.getElementById(`escalation-info-${contactId}`)) {
            log(`Auto-dismissing escalation info for ${contactId} after timeout`, 'info');
            dismissEscalationInfo(contactId);
        }
    }, 15000);
}

// Dismiss escalation info notification
window.dismissEscalationInfo = function(contactId) {
    const notification = document.getElementById(`escalation-info-${contactId}`);
    if (notification) {
        notification.remove();
        log(`Dismissed escalation info for ${contactId}`, 'info');
    }
};

// Handle contact accepted
function handleContactAccepted(contact) {
    const contactId = contact.getContactId();
    const contactType = contact.getType();
    
    log(`Contact accepted: ${contactId} (${contactType})`, 'success');
    
    // If this is an escalated voice contact, log the simultaneous handling
    if (contactType === connect.ContactType.VOICE && AppState.escalatedContacts?.has(contactId)) {
        const escalationInfo = AppState.escalatedContacts.get(contactId);
        log(`Now handling simultaneous chat and voice interaction:`, 'success');
        log(`  - Chat Contact: ${escalationInfo.relatedContactId}`, 'success');
        log(`  - Voice Contact: ${contactId}`, 'success');
    }
    
    updateContactsList();
}

// Handle contact connected
function handleContactConnected(contact) {
    const contactId = contact.getContactId();
    const contactType = contact.getType();
    
    log(`Contact connected: ${contactId} (${contactType})`, 'success');
    
    // If this is an escalated voice contact, confirm voice connection is established
    if (contactType === connect.ContactType.VOICE && AppState.escalatedContacts?.has(contactId)) {
        const escalationInfo = AppState.escalatedContacts.get(contactId);
        log(`Voice connection established for escalated contact ${contactId}`, 'success');
        log(`Agent can now handle both chat (${escalationInfo.relatedContactId}) and voice (${contactId}) simultaneously`, 'success');
    }
    
    updateContactsList();
}

// Handle contact ended
function handleContactEnded(contact) {
    const contactId = contact.getContactId();
    const contactType = contact.getType();
    
    log(`Contact ended: ${contactId} (${contactType})`, 'info');
    
    // Remove from voice contacts tracking
    AppState.voiceContactIds.delete(contactId);
    
    // Handle escalated contact cleanup
    if (AppState.escalatedContacts?.has(contactId)) {
        const escalationInfo = AppState.escalatedContacts.get(contactId);
        
        if (contactType === connect.ContactType.VOICE) {
            log(`Escalated voice contact ended: ${contactId}`, 'info');
            log(`Chat contact ${escalationInfo.relatedContactId} may still be active`, 'info');
        }
        
        // Remove from escalated contacts tracking
        AppState.escalatedContacts.delete(contactId);
        
        // Dismiss any remaining notifications
        dismissEscalationInfo(contactId);
    }
    
    updateContactsList();
}

// Handle contact destroy
function handleContactDestroy(contact) {
    const contactId = contact.getContactId();
    log(`Contact destroyed: ${contactId}`, 'info');
    
    // Remove from state
    AppState.contacts.delete(contactId);
    AppState.voiceContactIds.delete(contactId);
    
    // Remove from escalated contacts tracking
    if (AppState.escalatedContacts) {
        AppState.escalatedContacts.delete(contactId);
    }
    
    // Dismiss any remaining notifications
    dismissEscalationInfo(contactId);
    
    // Clear selection if this was selected
    if (AppState.selectedContactId === contactId) {
        AppState.selectedContactId = null;
    }
    
    updateContactsList();
    updateContactDetails();
}

// Update contacts list UI
function updateContactsList() {
    const container = document.getElementById('active-contacts');
    const contacts = Array.from(AppState.contacts.values());
    
    if (contacts.length === 0) {
        container.innerHTML = '<p class="empty-state">No active contacts</p>';
        return;
    }
    
    container.innerHTML = contacts.map(contact => {
        const contactId = contact.getContactId();
        const type = contact.getType();
        const state = contact.getStatus().type;
        const isSelected = contactId === AppState.selectedContactId;
        
        // Check if this is an escalated contact
        const isEscalated = AppState.escalatedContacts?.has(contactId);
        const escalationInfo = isEscalated ? AppState.escalatedContacts.get(contactId) : null;
        
        let escalationBadge = '';
        if (isEscalated) {
            escalationBadge = '<span class="escalation-badge">🔄 Escalated</span>';
        }
        
        // Check if this contact is related to an escalated contact
        let relatedEscalation = '';
        if (AppState.escalatedContacts) {
            for (const [escalatedId, info] of AppState.escalatedContacts.entries()) {
                if (info.relatedContactId === contactId) {
                    relatedEscalation = '<span class="related-escalation-badge">🔗 Related</span>';
                    break;
                }
            }
        }
        
        return `
            <div class="contact-card ${isSelected ? 'selected' : ''} ${isEscalated ? 'escalated' : ''}" onclick="selectContact('${contactId}')">
                <div class="contact-header">
                    <span class="contact-type ${type.toLowerCase()}">${type}</span>
                    <span class="contact-state">${state}</span>
                </div>
                <div class="contact-id">${contactId}</div>
                ${escalationBadge}
                ${relatedEscalation}
                ${escalationInfo ? `<div class="escalation-info">Related: ${escalationInfo.relatedContactId}</div>` : ''}
            </div>
        `;
    }).join('');
}

// Select a contact
window.selectContact = function(contactId) {
    AppState.selectedContactId = contactId;
    updateContactsList();
    updateContactDetails();
};

// Update contact details panel
function updateContactDetails() {
    const container = document.getElementById('contact-details');
    
    if (!AppState.selectedContactId) {
        container.innerHTML = '<p class="empty-state">Select a contact to view details</p>';
        return;
    }
    
    const contact = AppState.contacts.get(AppState.selectedContactId);
    if (!contact) {
        container.innerHTML = '<p class="empty-state">Contact not found</p>';
        return;
    }
    
    const attributes = contact.getAttributes();
    const relatedContactId = attributes.relatedContactId?.value;
    const initiationMethod = attributes.InitiationMethod?.value;
    
    // Check if this is an escalated contact
    const isEscalated = AppState.escalatedContacts?.has(AppState.selectedContactId);
    const escalationInfo = isEscalated ? AppState.escalatedContacts.get(AppState.selectedContactId) : null;
    
    let escalationSection = '';
    if (isEscalated) {
        escalationSection = `
            <div class="detail-section escalation-section">
                <h3>🔄 Escalation Details</h3>
                <div class="detail-row">
                    <div class="detail-label">Escalation Type:</div>
                    <div class="detail-value">${escalationInfo.type === 'voice' ? 'Chat → Voice' : 'Unknown'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Related Contact:</div>
                    <div class="detail-value highlight">${escalationInfo.relatedContactId}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Manual Accept Required:</div>
                    <div class="detail-value">${escalationInfo.requiresManualAccept ? 'Yes' : 'No'}</div>
                </div>
            </div>
        `;
    }
    
    // Check if this contact is related to an escalated contact
    let relatedEscalationSection = '';
    if (AppState.escalatedContacts) {
        for (const [escalatedId, info] of AppState.escalatedContacts.entries()) {
            if (info.relatedContactId === AppState.selectedContactId) {
                relatedEscalationSection = `
                    <div class="detail-section related-escalation-section">
                        <h3>🔗 Related Escalation</h3>
                        <div class="detail-row">
                            <div class="detail-label">Escalated Contact:</div>
                            <div class="detail-value highlight">${escalatedId}</div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-label">Escalation Type:</div>
                            <div class="detail-value">${info.type === 'voice' ? 'Chat → Voice' : 'Unknown'}</div>
                        </div>
                    </div>
                `;
                break;
            }
        }
    }
    
    container.innerHTML = `
        <div class="detail-row">
            <div class="detail-label">Contact ID:</div>
            <div class="detail-value">${contact.getContactId()}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">Type:</div>
            <div class="detail-value">${contact.getType()}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">State:</div>
            <div class="detail-value">${contact.getStatus().type}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">Initial Contact ID:</div>
            <div class="detail-value">${contact.getInitialContactId() || 'N/A'}</div>
        </div>
        ${initiationMethod ? `
        <div class="detail-row">
            <div class="detail-label">Initiation Method:</div>
            <div class="detail-value">${initiationMethod}</div>
        </div>
        ` : ''}
        ${relatedContactId ? `
        <div class="detail-row">
            <div class="detail-label">Related Contact:</div>
            <div class="detail-value highlight">${relatedContactId}</div>
        </div>
        ` : ''}
        <div class="detail-row">
            <div class="detail-label">Queue:</div>
            <div class="detail-value">${contact.getQueue()?.name || 'N/A'}</div>
        </div>
        ${escalationSection}
        ${relatedEscalationSection}
    `;
}

// Log activity
function log(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);
    
    const logPanel = document.getElementById('activity-log');
    const timestamp = new Date().toLocaleTimeString();
    
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.innerHTML = `
        <span class="log-time">${timestamp}</span>
        <span class="log-message">${message}</span>
    `;
    
    logPanel.insertBefore(entry, logPanel.firstChild);
    
    // Keep only last 50 entries
    while (logPanel.children.length > 50) {
        logPanel.removeChild(logPanel.lastChild);
    }
}
