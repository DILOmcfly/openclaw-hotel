# Stage 1: Build
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev)
RUN npm ci

# Copy source files
COPY tsconfig.json ./
COPY src/ ./src/
COPY client/ ./client/
COPY public/ ./public/

# Build TypeScript
RUN npm run build

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies + tsx (needed for migrations)
RUN npm ci --production && npm install -g tsx

# Copy built files from build stage
COPY --from=build /app/dist ./dist/

# Copy static assets
COPY --from=build /app/client ./client/
COPY --from=build /app/public ./public/

# Copy migration scripts (needed for entrypoint)
COPY --from=build /app/src/db ./src/db/

# Copy entrypoint script
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

# Expose port
EXPOSE 3000

# Use entrypoint script (runs migrations + starts server)
CMD ["./entrypoint.sh"]
