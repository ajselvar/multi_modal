const { ConnectClient, DescribeContactCommand } = require('@aws-sdk/client-connect');

const connectClient = new ConnectClient({});
const INSTANCE_ID = process.env.CONNECT_INSTANCE_ID;
const DEFAULT_QUEUE_ARN = process.env.DEFAULT_QUEUE_ARN || 'arn:aws:connect:us-west-2:319849630214:instance/602d4c63-50be-4b56-ac69-6068140d5a61/queue/b3afe3a2-0fb3-45ba-ac71-32cce1fac074';

exports.handler = async (event) => {
  console.log('=== Routing Lambda ===');
  console.log('Event:', JSON.stringify(event, null, 2));

  try {
    const { Details } = event;
    const { ContactData } = Details;
    const { Attributes, ContactId, Channel } = ContactData;

    console.log('Contact ID:', ContactId);
    console.log('Channel:', Channel);
    console.log('Attributes:', Attributes);

    // Check if this is an escalated contact with a related contact ID
    if (!isEscalatedContact(Attributes)) {
      console.log('Not an escalated contact, using default queue');
      return {
        queueArn: DEFAULT_QUEUE_ARN
      };
    }

    const relatedContactId = Attributes.relatedContactId;
    console.log('Processing escalated contact with related contact:', relatedContactId);

    // Attempt to route to the same agent handling the related contact
    const agentQueueArn = await routeToSameAgent(relatedContactId);

    if (agentQueueArn) {
      console.log('Successfully routing to agent queue:', agentQueueArn);
      return {
        queueArn: agentQueueArn
      };
    } else {
      console.log('Agent routing failed, falling back to default queue');
      return {
        queueArn: DEFAULT_QUEUE_ARN
      };
    }

  } catch (error) {
    console.error('=== ERROR in routing ===');
    console.error('Error:', error);

    // On error, return default queue to avoid blocking the contact
    console.log('Error occurred, falling back to default queue');
    return {
      queueArn: DEFAULT_QUEUE_ARN
    };
  }
};

async function getContactDetails(contactId) {
  console.log('Getting contact details for:', contactId);

  try {
    const command = new DescribeContactCommand({
      InstanceId: INSTANCE_ID,
      ContactId: contactId
    });

    const response = await connectClient.send(command);
    
    if (!response.Contact) {
      console.warn('No contact found for ID:', contactId);
      return null;
    }

    const contact = response.Contact;
    console.log('Contact details retrieved:', {
      contactId: contact.Id,
      channel: contact.Channel,
      agentId: contact.AgentInfo?.Id,
      queueId: contact.QueueInfo?.Id,
      status: contact.LastUpdateTimestamp ? 'Active' : 'Unknown'
    });

    // Validate that the contact is in a state where agent info is available
    if (contact.AgentInfo && contact.AgentInfo.Id) {
      console.log('Agent found for contact:', {
        agentId: contact.AgentInfo.Id,
        agentArn: contact.AgentInfo.Arn
      });
    } else {
      console.warn('No agent assigned to contact:', contactId);
    }

    return contact;
  } catch (error) {
    console.error('Failed to get contact details for:', contactId, error);
    
    // Log specific error types for better debugging
    if (error.name === 'ResourceNotFoundException') {
      console.error('Contact not found:', contactId);
    } else if (error.name === 'AccessDeniedException') {
      console.error('Access denied when retrieving contact:', contactId);
    } else {
      console.error('Unexpected error retrieving contact:', error.message);
    }
    
    return null;
  }
}

function getAgentQueueArn(agentId) {
  if (!agentId) {
    console.error('Agent ID is required to construct queue ARN');
    return null;
  }

  // Validate required environment variables
  const region = process.env.AWS_REGION;
  const accountId = process.env.AWS_ACCOUNT_ID;
  
  if (!region || !accountId || !INSTANCE_ID) {
    console.error('Missing required environment variables:', {
      region: !!region,
      accountId: !!accountId,
      instanceId: !!INSTANCE_ID
    });
    return null;
  }

  // Construct the agent's personal queue ARN
  // Format: arn:aws:connect:region:account:instance/instanceId/queue/agentId
  // Note: The queue ID is the same as the agent ID for personal queues
  const agentQueueArn = `arn:aws:connect:${region}:${accountId}:instance/${INSTANCE_ID}/queue/${agentId}`;

  console.log('Constructed agent queue ARN:', agentQueueArn);
  return agentQueueArn;
}

/**
 * Checks if a contact is an escalated contact by looking for relatedContactId attribute
 * @param {Object} attributes - Contact attributes
 * @returns {boolean} - True if this is an escalated contact
 */
function isEscalatedContact(attributes) {
  if (!attributes || !attributes.relatedContactId) {
    return false;
  }

  console.log('Detected escalated contact with relatedContactId:', attributes.relatedContactId);
  return true;
}

/**
 * Attempts to route an escalated contact to the same agent handling the related contact
 * @param {string} relatedContactId - The ID of the related contact
 * @returns {Promise<string|null>} - Agent queue ARN or null if routing fails
 */
async function routeToSameAgent(relatedContactId) {
  try {
    console.log('Attempting to route to same agent for related contact:', relatedContactId);

    // Get the related contact details to find the agent
    const relatedContact = await getContactDetails(relatedContactId);

    if (!relatedContact) {
      console.warn('Failed to retrieve related contact details');
      return null;
    }

    // Check if the related contact has an agent assigned
    if (!relatedContact.AgentInfo || !relatedContact.AgentInfo.Id) {
      console.warn('No agent found for related contact:', relatedContactId);
      return null;
    }

    const agentId = relatedContact.AgentInfo.Id;
    console.log('Found agent ID for routing:', agentId);

    // Construct the agent's personal queue ARN
    const agentQueueArn = getAgentQueueArn(agentId);

    if (!agentQueueArn) {
      console.error('Failed to construct agent queue ARN');
      return null;
    }

    console.log('Successfully prepared routing to agent queue:', agentQueueArn);
    return agentQueueArn;

  } catch (error) {
    console.error('Error in routeToSameAgent:', error);
    return null;
  }
}
