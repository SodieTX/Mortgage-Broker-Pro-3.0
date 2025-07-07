#!/bin/bash

echo "🔧 Setting up File Upload Baby Step..."

# Install missing dependencies
echo "📦 Installing dependencies..."
npm install form-data

# Install missing types
echo "🔤 Installing TypeScript types..."
npm install --save-dev @types/node

# Create test-files directory
echo "📁 Creating test files directory..."
mkdir -p test-files

echo "✅ Setup complete!"
echo ""
echo "Now you can:"
echo "1. npm run dev                 # Start the server"
echo "2. node test-file-upload.js    # Run the tests"
echo ""
echo "Or test manually:"
echo "curl -X POST http://localhost:3001/api/v1/lenders/upload-preview -F \"file=@test-files/valid-lenders.csv\""