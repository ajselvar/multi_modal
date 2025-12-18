# Amazon Connect Multi-Modal Customer Interaction Platform

A production-ready multi-modal customer interaction platform that integrates Amazon Connect chat and WebRTC voice capabilities. The system supports chat-only interactions, voice+chat interactions, and seamless chat-to-voice escalation with agent continuity.

## Features

- **Professional Customer Website**: Hyundai-inspired automotive website with integrated support widget
- **Multi-Modal Interactions**: Chat-only, voice+chat, and chat-to-voice escalation
- **Agent Continuity**: Escalated contacts maintain the same agent assignment
- **Dedicated Agent Application**: Separate interface for contact center operations
- **Auto-Accept Logic**: Automatic acceptance of related chat contacts
- **UserId-Based Optimization**: Robust WebSocket connection management
- **Production-Ready**: Comprehensive error handling and monitoring

## Project Structure

```
.
├── frontend/                    # Customer website (Hyundai-style)
│   ├── index.html              # Professional automotive website
│   ├── styles.css              # Professional styling with animations
│   ├── app.js                  # Main application logic
│   ├── main.js                 # Application entry point
│   ├── chat.js                 # Chat widget implementation
│   ├── voice.js                # Voice widget implementation
│   ├── escalation.js           # Escalation widget for chat-to-voice
│   ├── websocket.js            # WebSocket communication
│   ├── userId.js               # UserId generation and management
│   ├── config.js               # Frontend configuration
│   ├── package.json            # Frontend dependencies
│   ├── vite.config.js          # Build configuration
│   └── dist/                   # Built frontend files
│
├── agent-app/                  # Dedicated agent application
│   ├── index.html              # Agent interface structure
│   ├── src/
│   │   ├── main.js             # Agent application logic
│   │   └── config.js           # Agent configuration
│   ├── package.json            # Agent app dependencies
│   ├── vite.config.js          # Agent build configuration
│   └── dist/                   # Built agent application
│
├── lambda/                     # Contact creation Lambda
│   ├── index.js                # API Lambda handler
│   └── package.json            # Lambda dependencies
│
├── lambda-websocket/           # WebSocket management Lambda
│   ├── index.js                # WebSocket connection handler
│   └── package.json            # WebSocket Lambda dependencies
│
├── lambda-contact-event/       # Contact event processing Lambda
│   ├── index.js                # Event processing handler
│   └── package.json            # Event Lambda dependencies
│
├── lambda-chat-routing/        # Chat routing Lambda
│   ├── index.js                # Routing logic handler
│   └── package.json            # Routing Lambda dependencies
│
├── infra/                      # CDK infrastructure code
│   ├── bin/                    # CDK app entry point
│   ├── lib/                    # CDK stack definitions
│   ├── cdk.json                # CDK configuration
│   ├── package.json            # CDK dependencies
│   ├── tsconfig.json           # TypeScript configuration
│   └── cdk.out/                # CDK synthesis output
│
├── .kiro/specs/                # Feature specifications
│   ├── chat-only-interaction/  # Chat-only mode specification
│   ├── chat-to-voice-escalation/ # Escalation feature specification
│   ├── connect-multimodal-demo/ # Base demo specification
│   └── websocket-userid-optimization/ # WebSocket optimization spec
│
├── tests/                      # Test files
├── config.json                 # Centralized configuration
├── deploy.sh                   # Automated deployment script
├── sync-configs.sh             # Configuration sync script
├── COMPREHENSIVE_DESIGN.md     # Complete system design document
└── README.md                   # This file
```

## Prerequisites

- Node.js 18.x or later
- AWS CLI configured with credentials
- AWS CDK CLI installed (`npm install -g aws-cdk`)
- Amazon Connect instance with a contact flow configured

## Configuration

All configuration is centralized in `config.json` at the project root:

Create the Config.json in the root directory with below structure

```json
{
  "aws": {
    "region": "us-west-2",
    "account": ""
  },
  "connect": {
    "instanceId": "your-instance-id",
    "contactFlowId": "your-contact-flow-id",
    "instanceAlias": "instance-alias",
    "ccpUrl": "ccp-url",
  },
  "deployment": {
    "stackName": "ConnectMultimodalStack",
    "environment": "dev"
  }
}
```

**Update this file with your Amazon Connect details before deploying.**

## Quick Start

### 1. Configure

Edit `config.json` with your Amazon Connect Instance ID and Contact Flow ID.

### 2. Deploy

Run the automated deployment script:

```bash
chmod +x deploy.sh
./deploy.sh
```

This script will:
- Install all dependencies
- Bootstrap CDK (if needed)
- Deploy the infrastructure
- Automatically update frontend config with API Gateway URL
- Redeploy with updated configuration

The deployment will output:
- Customer App URL (CloudFront distribution)
- Agent App URL (CloudFront distribution - add to Connect approved origins)
- API Gateway URL
- WebSocket API URL
- S3 Bucket names

### 3. Configure Connect Approved Origins

After deployment, you need to add the Agent App URL to Amazon Connect:

1. **Get the Agent App URL** from the deployment outputs:
   ```bash
   aws cloudformation describe-stacks \
     --stack-name ConnectMultimodalStack \
     --query 'Stacks[0].Outputs[?OutputKey==`AgentURL`].OutputValue' \
     --output text
   ```

2. **Add Agent App URL to Connect approved origins**:
   - Go to Amazon Connect Console
   - Navigate to "Application integration" → "Approved origins"
   - Add: `https://[your-agent-cloudfront-domain].cloudfront.net`
   - No trailing slash!

## Manual Deployment

If you prefer manual control:

### 1. Install Dependencies

```bash
# Install CDK dependencies
cd infra
npm install
cd ..

# Install Lambda dependencies
cd lambda
npm install
cd ..
```

### 2. Bootstrap CDK (First Time Only)

```bash
cd infra
cdk bootstrap
```

### 3. Deploy Infrastructure

```bash
cd infra
cdk deploy
```

### 4. Update Frontend Configuration

After deployment, run:

```bash
chmod +x sync-configs.sh
./sync-configs.sh
```

### 5. Redeploy to Update Frontend

```bash
cd infra
cdk deploy
```

## Development

### Local Testing

You can test the frontend locally by opening `frontend/index.html` in a browser, but API calls will fail without the backend deployed.

### CDK Commands

```bash
cd infra

# Show differences between deployed and local
cdk diff

# Synthesize CloudFormation template
cdk synth

# Deploy stack
cdk deploy

# Destroy stack
cdk destroy
```

## Architecture

### High-Level Components

- **Customer Website**: Professional Hyundai-inspired automotive website with integrated support widget
- **Agent Application**: Dedicated contact center interface with Amazon Connect CCP integration
- **Support Widget**: Multi-modal interaction widget supporting chat-only, voice+chat, and escalation modes
- **API Gateway**: REST API for contact creation and WebSocket API for real-time communication
- **Lambda Functions**: 
  - Contact Creation Lambda: Handles chat and voice contact creation
  - WebSocket Lambda: Manages WebSocket connections with UserId-based registration
  - Event Processing Lambda: Processes Connect contact events and enables escalation
  - Chat Routing Lambda: Routes escalated contacts to maintain agent continuity
- **DynamoDB**: Connection tracking with UserId-based indexing for efficient lookup
- **Amazon Connect**: Contact center service managing chat and voice interactions
- **EventBridge**: Contact event routing for real-time notifications

### Interaction Modes

1. **Chat-Only Mode**: Text-based customer support without voice capabilities
2. **Voice+Chat Mode**: Combined voice and chat interaction (original functionality)
3. **Escalation Mode**: Seamless transition from chat-only to voice+chat with agent continuity

### Key Features

- **UserId-Based WebSocket Management**: Persistent user identity across multiple contact types
- **Agent Continuity**: Escalated voice contacts route to the same agent handling the chat
- **Auto-Accept Logic**: Automatic acceptance of related chat contacts in agent application
- **Professional UI**: Production-ready customer website and agent interface
- **Comprehensive Error Handling**: Graceful degradation and recovery mechanisms

### Deployment Architecture Changes

The application has been restructured from a single CloudFront distribution with path-based routing to separate CloudFront distributions for customer and agent apps.

#### What Changed

**Before:**
- Single S3 bucket hosting both apps
- Single CloudFront distribution
- Path-based routing: `/` for customer, `/ccp/` for agent
- Complex CloudFront function for routing logic

**After:**
- Two separate S3 buckets (customer and agent)
- Two separate CloudFront distributions
- Clean separation of concerns
- Simpler CloudFront functions (one per app)

#### Benefits

1. **No caching issues**: Each app has its own cache, no path conflicts
2. **Simpler routing**: No complex path-based logic needed
3. **Independent deployments**: Can update one app without affecting the other
4. **Cleaner architecture**: Each app is truly independent
5. **Better security**: Can apply different security policies per app

#### Stack Outputs

The stack provides these outputs:

- `CustomerURL`: CloudFront URL for customer-facing app
- `AgentURL`: CloudFront URL for agent interface (add to Connect)
- `CustomerDistributionId`: CloudFront distribution ID for customer app
- `AgentDistributionId`: CloudFront distribution ID for agent app
- `CustomerBucketName`: S3 bucket for customer app
- `AgentBucketName`: S3 bucket for agent app
- `ApiURL`: API Gateway endpoint
- `WebSocketURL`: WebSocket API endpoint

#### Migration Notes

If you have an existing deployment:
- The old resources will be replaced (not updated in place)
- CloudFront distributions will get new domain names
- Update any bookmarks or saved URLs
- Update Connect approved origins with new agent URL

## Security

- S3 bucket configured for public read access (website hosting)
- API Gateway with CORS enabled
- Lambda with minimal IAM permissions for Connect APIs
- No credentials stored in frontend code

## Troubleshooting

### CDK Deploy Fails

- Ensure AWS credentials are configured: `aws sts get-caller-identity`
- Check CDK is bootstrapped: `cdk bootstrap`
- Verify Node.js version: `node --version` (should be 18.x+)

### Lambda Errors

- Check CloudWatch Logs: `/aws/lambda/ConnectMultimodalStack-ConnectLambda*`
- Verify Connect Instance ID and Contact Flow ID are correct
- Ensure Lambda has proper IAM permissions

### Website Not Loading

- Check S3 bucket policy allows public read
- Verify files were deployed to S3
- Check browser console for errors

## System Status

### Completed Features ✅
- Professional customer website with Hyundai-inspired design
- Support widget with chat and voice capabilities
- Separate agent application with CCP integration
- Chat-only interaction mode
- Chat-to-voice escalation functionality
- UserId-based WebSocket optimization
- Auto-accept logic for related contacts
- Comprehensive error handling
- Production deployment infrastructure

### Available Interaction Flows
1. **Chat-Only**: Customer selects "Start Chat" → Chat interface → Optional escalation to voice
2. **Voice+Chat**: Customer selects "Start Call" → Combined voice and chat interface
3. **Escalation**: Chat-only → "Escalate to Voice" → Combined interface with same agent

## Documentation

- **[Comprehensive Design Document](COMPREHENSIVE_DESIGN.md)**: Complete system architecture and design
- **[Feature Specifications](.kiro/specs/)**: Individual feature requirements and designs
  - [Chat-Only Interaction](.kiro/specs/chat-only-interaction/)
  - [Chat-to-Voice Escalation](.kiro/specs/chat-to-voice-escalation/)
  - [Multi-Modal Demo Base](.kiro/specs/connect-multimodal-demo/)
  - [WebSocket UserId Optimization](.kiro/specs/websocket-userid-optimization/)

## Testing

The system includes comprehensive testing:
- **Unit Tests**: Component-level functionality verification
- **Property-Based Tests**: Universal properties using fast-check library
- **Integration Tests**: End-to-end interaction flows
- **Performance Tests**: Load testing and scalability validation

## License

This is a production-ready customer interaction platform for educational and demonstration purposes.
