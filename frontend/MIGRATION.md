# Frontend Migration to NPM App

## What Changed

The frontend has been converted from a simple HTML/JS app to an npm-based project while keeping the same simplicity.

### Before
- Plain HTML with CDN-loaded libraries
- Global script tags
- No build step

### After
- NPM package with proper dependency management
- ES6 modules with imports/exports
- Vite bundler for development and production builds
- Still vanilla JavaScript - no frameworks added

## Benefits

1. **Better dependency management**: amazon-connect-chatjs is now an npm dependency instead of CDN
2. **Local development server**: `npm run dev` provides hot reload
3. **Optimized builds**: Vite bundles and minifies for production
4. **Module system**: Clean imports/exports instead of global variables
5. **Future-ready**: Easy to add more dependencies or tooling

## File Changes

- `package.json` - NPM configuration
- `main.js` - New entry point that imports everything
- `config.js` - Now exports config as ES6 module
- `app.js` - Now imports config and exports utility functions
- `chat.js` - Now imports dependencies and exports ChatWidget
- `index.html` - Simplified, loads main.js as module

## Development Workflow

```bash
# Install dependencies
npm install

# Start dev server (http://localhost:5173)
npm run dev

# Build for production
npm run build
```

## Deployment

The CDK stack now deploys from `frontend/dist` instead of `frontend`.

The deploy script automatically:
1. Installs frontend dependencies
2. Builds the frontend
3. Deploys the dist folder to S3

## Code Structure

Still simple and easy to understand:
- `index.html` - HTML structure
- `styles.css` - Styling
- `config.js` - Configuration
- `app.js` - Main app logic
- `chat.js` - Chat widget
- `main.js` - Entry point that ties everything together
