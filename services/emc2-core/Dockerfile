# Simple, efficient Dockerfile for development
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Expose port
EXPOSE 3001

# Development command (production would use npm start)
CMD ["npm", "run", "dev"]
