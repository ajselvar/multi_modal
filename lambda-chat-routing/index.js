const { ConnectClient, DescribeContactCommand } = require('@aws-sdk/client-connect');

const connectClient = new ConnectClient({});
const INSTANCE_ID = process.env.CONNECT_INSTANCE_ID;
const DEFAULT_QUEUE_ARN = process.env.DEFAULT_QUEUE_ARN || 'arn:aws:connect:us-west-2:319849630214:instance/602d4c63-50be-4b56-ac69-6068140d5a61/queue/b3afe3a2-0fb3-45ba-ac71-32cce1fac074';

exports.handler = async (event) => {
  console.log('=== Chat Routing Lambda ===');
  console.log('Event:', JSON.stringify(event, null, 2));

  try {
    const { Details } = event;
    const { ContactData } = Details;
    const { Attributes, ContactId } = ContactData;

    console.log('Contact ID:', ContactId);
    console.log('Attributes:', Attributes);

    // Check if this chat has a related voice contact
    const relatedContactId = Attributes?.relatedContactId;

    if (!relatedContactId) {
      console.log('No related voice contact found, using default queue');
      return {
        queueArn: DEFAULT_QUEUE_ARN
      };
    }

    console.log('Found related voice contact:', relatedContactId);

    // Get the voice contact details to find the agent
    const voiceContact = await getContactDetails(relatedContactId);

    if (!voiceContact || !voiceContact.AgentInfo || !voiceContact.AgentInfo.Id) {
      console.log('No agent found for voice contact, using default queue');
      return {
        queueArn: DEFAULT_QUEUE_ARN
      };
    }

    const agentId = voiceContact.AgentInfo.Id;
    console.log('Found agent ID:', agentId);

    // Construct the agent's personal queue ARN
    // Each agent has a personal queue with the queue ID being the same as agent ID
    const agentQueueArn = getAgentQueueArn(agentId);

    console.log('Routing to agent personal queue:', agentQueueArn);
    return {
      queueArn: agentQueueArn
    };

  } catch (error) {
    console.error('=== ERROR in chat routing ===');
    console.error('Error:', error);

    // On error, return default queue to avoid blocking the chat
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
    console.log('Contact details retrieved:', {
      contactId: response.Contact?.Id,
      agentId: response.Contact?.AgentInfo?.Id,
      queueId: response.Contact?.QueueInfo?.Id
    });

    return response.Contact;
  } catch (error) {
    console.error('Failed to get contact details:', error);
    return null;
  }
}

function getAgentQueueArn(agentId) {
  // Construct the agent's personal queue ARN
  // Format: arn:aws:connect:region:account:instance/instanceId/queue/agentId
  // Note: The queue ID is the same as the agent ID for personal queues
  const agentQueueArn = `arn:aws:connect:${process.env.AWS_REGION}:${process.env.AWS_ACCOUNT_ID}:instance/${INSTANCE_ID}/queue/${agentId}`;

  return agentQueueArn;
}
