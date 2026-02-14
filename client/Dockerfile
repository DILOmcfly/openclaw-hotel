# Multi-stage build for client (Vite + nginx)

# Stage 1: Build static assets
FROM node:22-slim AS build
WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci

# Copy source code
COPY tsconfig.json vite.config.ts ./
COPY src/ src/
COPY public/ public/
COPY index.html ./

# Build production bundle
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine
WORKDIR /usr/share/nginx/html

# Remove default nginx static assets
RUN rm -rf ./*

# Copy built files from previous stage
COPY --from=build /app/dist .

# Copy nginx configuration (optional custom config)
# COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
