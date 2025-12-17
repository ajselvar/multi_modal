const AWS = require('aws-sdk');
const connect = new AWS.Connect();

// Environment configuration
const INSTANCE_ID = process.env.CONNECT_INSTANCE_ID;
const CONTACT_FLOW_ID = process.env.CONNECT_CONTACT_FLOW_ID;

console.log('Lambda initialized with configuration:', {
  instanceId: INSTANCE_ID,
  contactFlowId: CONTACT_FLOW_ID,
  region: process.env.AWS_REGION
});

exports.handler = async (event) => {
  console.log('=== Lambda Invocation Started ===');
  console.log('Event received:', JSON.stringify(event, null, 2));
  console.log('Request ID:', event.requestContext?.requestId);
  console.log('Source IP:', event.requestContext?.identity?.sourceIp);
  
  const path = event.path || event.resource;
  console.log('Resolved path:', path);
  
  try {
    let result;
    
    if (path === '/start-chat-contact') {
      console.log('Routing to handleStartChat');
      result = await handleStartChat(event);
    } else if (path === '/start-voice-contact') {
      console.log('Routing to handleStartVoice');
      result = await handleStartVoice(event);
    } else if (path === '/stop-contact') {
      console.log('Routing to handleStopContact');
      result = await handleStopContact(event);
    } else {
      console.warn('Unknown path requested:', path);
      result = createResponse(404, { error: 'Not found' });
    }
    
    console.log('=== Lambda Invocation Completed Successfully ===');
    return result;
  } catch (error) {
    console.error('=== Lambda Invocation Failed ===');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Error stack:', error.stack);
    
    return createResponse(500, { 
      error: error.message,
      errorCode: error.code,
      errorType: error.constructor.name
    });
  }
};

async function handleStartChat(event) {
  console.log('--- handleStartChat: Start ---');
  
  // Parse request body if present
  let body = {};
  if (event.body) {
    try {
      body = JSON.parse(event.body);
      console.log('Parsed request body:', body);
    } catch (e) {
      console.warn('Failed to parse request body:', e.message);
    }
  }
  
  const params = {
    InstanceId: INSTANCE_ID,
    ContactFlowId: CONTACT_FLOW_ID,
    ParticipantDetails: {
      DisplayName: body.displayName || 'Customer'
    },
    Attributes: {
      ...(body.attributes || {})
    }
  };
  
  console.log('Calling Connect StartChatContact API with params:', JSON.stringify(params, null, 2));
  
  const startTime = Date.now();
  const result = await connect.startChatContact(params).promise();
  const duration = Date.now() - startTime;
  
  console.log(`Connect API call completed in ${duration}ms`);
  console.log('Chat contact created successfully:', {
    contactId: result.ContactId,
    participantId: result.ParticipantId,
    hasToken: !!result.ParticipantToken
  });
  
  const response = {
    contactId: result.ContactId,
    participantId: result.ParticipantId,
    participantToken: result.ParticipantToken
  };
  
  console.log('--- handleStartChat: Success ---');
  return createResponse(200, response);
}

async function handleStartVoice(event) {
  console.log('--- handleStartVoice: Start ---');
  
  // Parse request body
  let body = {};
  if (event.body) {
    try {
      body = JSON.parse(event.body);
      console.log('Parsed request body:', body);
    } catch (e) {
      console.warn('Failed to parse request body:', e.message);
    }
  }
  
  const params = {
    InstanceId: INSTANCE_ID,
    ContactFlowId: CONTACT_FLOW_ID,
    ParticipantDetails: {
      DisplayName: body.displayName || 'Customer'
    },
    Attributes: {
      ...(body.attributes || {})
    }
  };
  
  console.log('Calling Connect StartWebRTCContact API with params:', JSON.stringify(params, null, 2));
  
  const startTime = Date.now();
  const result = await connect.startWebRTCContact(params).promise();
  const duration = Date.now() - startTime;
  
  console.log(`Connect API call completed in ${duration}ms`);
  console.log('WebRTC contact created successfully:', {
    contactId: result.ContactId,
    participantId: result.ParticipantId,
    hasToken: !!result.ParticipantToken,
    hasConnectionData: !!result.ConnectionData
  });
  
  const response = {
    contactId: result.ContactId,
    participantId: result.ParticipantId,
    participantToken: result.ParticipantToken,
    connectionData: result.ConnectionData
  };
  
  console.log('--- handleStartVoice: Success ---');
  return createResponse(200, response);
}

async function handleStopContact(event) {
  console.log('--- handleStopContact: Start ---');
  
  // Parse request body
  let body = {};
  if (event.body) {
    try {
      body = JSON.parse(event.body);
      console.log('Parsed request body:', body);
    } catch (e) {
      console.warn('Failed to parse request body:', e.message);
      return createResponse(400, { error: 'Invalid request body' });
    }
  }
  
  if (!body.contactId) {
    console.error('Missing required parameter: contactId');
    return createResponse(400, { error: 'contactId is required' });
  }
  
  const params = {
    InstanceId: INSTANCE_ID,
    ContactId: body.contactId
  };
  
  console.log('Calling Connect StopContact API with params:', JSON.stringify(params, null, 2));
  
  const startTime = Date.now();
  await connect.stopContact(params).promise();
  const duration = Date.now() - startTime;
  
  console.log(`Connect API call completed in ${duration}ms`);
  console.log('Contact stopped successfully:', {
    contactId: body.contactId
  });
  
  const response = {
    success: true,
    contactId: body.contactId,
    message: 'Contact stopped successfully'
  };
  
  console.log('--- handleStopContact: Success ---');
  return createResponse(200, response);
}

function createResponse(statusCode, body) {
  const response = {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS'
    },
    body: JSON.stringify(body)
  };
  
  console.log('Creating response:', {
    statusCode,
    bodySize: JSON.stringify(body).length,
    hasError: !!body.error
  });
  
  return response;
}
