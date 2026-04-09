# Base image for building the application
FROM node:22-alpine AS builder

# Enable pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Set working directory
WORKDIR /app

# Copy dependency files
COPY package.json pnpm-lock.yaml ./

# Install all dependencies (including dev for building)
RUN pnpm install --frozen-lockfile

# Copy the rest of the source code
COPY . .

# Generate Prisma client if schema exists
RUN if [ -d "prisma" ]; then pnpm dlx prisma@5.22.0 generate; fi

# Build the NestJS application
RUN pnpm run build

# Production image
FROM node:22-alpine AS production

# Enable pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Set working directory
WORKDIR /app

# Set node environment to production
ENV NODE_ENV=production

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install only production dependencies
RUN pnpm install --prod --frozen-lockfile

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Copy prisma directory if it exists (needed for production migrations/client generation)
COPY --from=builder /app/prisma ./prisma

# Generate Prisma client for production if schema exists
RUN if [ -d "prisma" ]; then pnpm dlx prisma@5.22.0 generate; fi

# Expose port (Railway typically provides the PORT env var dynamically, but 3000 is a common default)
EXPOSE 3000

# Start the application
CMD ["node", "dist/main"]
