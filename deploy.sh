#!/bin/bash

# Deployment script for Amazon Connect Multi-Modal Demo

set -e

echo "🚀 Amazon Connect Multi-Modal Demo Deployment"
echo "=============================================="
echo ""

# Check if config.json exists
if [ ! -f "config.json" ]; then
    echo "❌ Error: config.json not found"
    echo "Please create config.json with your Connect configuration"
    exit 1
fi

echo "✅ Configuration file found"
echo ""

# Extract region from config.json
AWS_REGION=$(grep -o '"region"[[:space:]]*:[[:space:]]*"[^"]*"' config.json | cut -d'"' -f4)
export AWS_REGION

echo "🌍 Using AWS region: $AWS_REGION"
echo ""

# Check if AWS CLI is configured
if ! aws sts get-caller-identity --region $AWS_REGION &> /dev/null; then
    echo "❌ Error: AWS CLI is not configured or credentials are invalid"
    echo "Please run 'aws configure' or check your credentials"
    exit 1
fi

echo "✅ AWS credentials verified"
echo ""

# Install CDK dependencies
echo "📦 Installing CDK dependencies..."
cd infra
npm install
cd ..
echo "✅ CDK dependencies installed"
echo ""

# Install Lambda dependencies
echo "📦 Installing Lambda dependencies..."
cd lambda
npm install
cd ..
echo "✅ Lambda dependencies installed"
echo ""

# Install and build frontend
echo "📦 Installing frontend dependencies..."
cd frontend
npm install
echo "✅ Frontend dependencies installed"
echo ""

echo "🔨 Building frontend..."
npm run build
echo "✅ Frontend built"
cd ..
echo ""

# Install and build agent-app
echo "📦 Installing agent-app dependencies..."
cd agent-app
npm install
echo "✅ Agent-app dependencies installed"
echo ""

echo "🔨 Building agent-app..."
NODE_ENV=production npm run build
echo "✅ Agent-app built"
cd ..
echo ""

# Check if CDK is bootstrapped
echo "🔍 Checking CDK bootstrap status..."
cd infra
if ! cdk bootstrap 2>&1 | grep -q "already bootstrapped"; then
    echo "🔧 Bootstrapping CDK..."
    cdk bootstrap
    echo "✅ CDK bootstrapped"
else
    echo "✅ CDK already bootstrapped"
fi
echo ""

# Deploy the stack
echo "🚀 Deploying CDK stack..."
cdk deploy --require-approval never

echo ""
echo "✅ Initial deployment complete!"
echo ""

# Sync configurations across frontend and agent-app
echo "🔧 Syncing configurations with API Gateway URLs..."
cd ..
chmod +x sync-configs.sh
./sync-configs.sh

echo ""
echo "🚀 Redeploying with updated frontend config..."
cd infra
cdk deploy --require-approval never

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📝 Deployment outputs:"
aws cloudformation describe-stacks \
  --stack-name ConnectMultimodalStack \
  --query 'Stacks[0].Outputs' \
  --output table

echo ""
echo "🎉 Your application is ready!"
echo "Access your website using the WebsiteURL from the output above"
echo ""
