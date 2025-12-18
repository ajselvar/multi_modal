# Amazon Connect Multi-Modal Demo

A demonstration application showcasing Amazon Connect's chat and voice capabilities using a simple web interface.

## Project Structure

```
.
├── frontend/           # Static website files
│   ├── index.html     # Main HTML page
│   ├── styles.css     # Styling
│   └── app.js         # Frontend JavaScript
├── lambda/            # Lambda function code
│   ├── index.js       # Lambda handler
│   └── package.json   # Lambda dependencies
├── infra/             # CDK infrastructure code
│   ├── bin/           # CDK app entry point
│   ├── lib/           # CDK stack definitions
│   ├── cdk.json       # CDK configuration
│   ├── package.json   # CDK dependencies
│   └── tsconfig.json  # TypeScript configuration
└── .kiro/specs/       # Feature specifications
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

- **Customer App**: Static website hosted on S3 with dedicated CloudFront distribution
- **Agent App**: Separate static website on S3 with dedicated CloudFront distribution
- **API Gateway**: REST API for frontend-backend communication
- **WebSocket API**: Real-time communication for chat delivery
- **Lambda Functions**: Serverless functions handling Connect API calls and events
- **DynamoDB**: Connection tracking for WebSocket sessions
- **Amazon Connect**: Contact center service for chat and voice

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

## Next Steps

1. Implement chat functionality (Task 6)
2. Implement voice functionality (Task 8)
3. Add end-to-end testing
4. Configure custom domain (optional)

## License

This is a demo application for educational purposes.
