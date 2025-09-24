# Use official Bun image
FROM oven/bun:latest

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package.json bun.lock ./
RUN bun install

# Copy source code
COPY . .

# Expose the app port
EXPOSE 3000

# Set environment variables (override in production as needed)
ENV PORT=3000

# Start the app
CMD ["bun", "run", "src/index.ts"]