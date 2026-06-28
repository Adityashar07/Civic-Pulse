# Stage 1: Build environment
FROM node:22-alpine AS builder
WORKDIR /usr/src/app

# Copy dependency configs
COPY package*.json ./

# Install all dependencies
RUN npm ci

# Stage 2: Runtime environment
FROM node:22-alpine AS runner
WORKDIR /usr/src/app

# Set production env
ENV NODE_ENV=production
ENV PORT=8000

# Copy node_modules from builder stage
COPY --from=builder /usr/src/app/node_modules ./node_modules
# Copy source files
COPY package*.json ./
COPY backend ./backend
COPY frontend ./frontend

# Expose server port
EXPOSE 8000

# Run the server
CMD ["node", "backend/server.js"]
