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

```json
{
  "aws": {
    "region": "us-west-2",
    "account": ""
  },
  "connect": {
    "instanceId": "your-instance-id",
    "contactFlowId": "your-contact-flow-id"
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
- Website URL (S3 static website)
- API Gateway URL
- S3 Bucket name

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

- **Frontend**: Static website hosted on S3
- **API Gateway**: REST API for frontend-backend communication
- **Lambda**: Serverless function handling Connect API calls
- **Amazon Connect**: Contact center service for chat and voice

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
