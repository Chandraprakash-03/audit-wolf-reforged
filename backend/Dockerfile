# Use Node.js 20 Alpine for smaller image size
FROM node:20-alpine AS base

# Install system dependencies needed for native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    musl-dev \
    giflib-dev \
    pixman-dev \
    pangomm-dev \
    libjpeg-turbo-dev \
    freetype-dev

# Set working directory
WORKDIR /app

# Development stage for building
FROM base AS builder

# Copy package files
COPY package.json ./

# Install all dependencies including dev dependencies
RUN npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine AS production

# Install system dependencies for runtime
RUN apk add --no-cache \
    cairo \
    jpeg \
    pango \
    musl \
    giflib \
    pixman \
    pangomm \
    libjpeg-turbo \
    freetype

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json ./

# Install only production dependencies
RUN npm install --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Copy any additional files needed at runtime
COPY --from=builder /app/src/docs ./src/docs

# Create necessary directories and set permissions
RUN mkdir -p logs reports && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Set production environment
ENV NODE_ENV=production

# Render will provide the PORT environment variable
# Default to 3001 for local development
ENV PORT=10000

# Expose the port (this is more for documentation, Render uses PORT env var)
EXPOSE $PORT

# Health check - Enable this for better monitoring
# HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
#     CMD node -e "const http = require('http'); const port = process.env.PORT || 3001; const options = { host: '0.0.0.0', port: port, path: '/health', timeout: 3000 }; const req = http.request(options, (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }); req.on('error', () => process.exit(1)); req.end();"

# Start the application
CMD ["npm", "start"]
