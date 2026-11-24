
# ==========================================
# Stage 1: Frontend Build (Vite)
# ==========================================
FROM node:22-slim AS builder

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .
RUN npm run build


# ==========================================
# Stage 2: Production Runtime
# Node.js 22 + Python Forecasting
# ==========================================
FROM node:22-slim AS runner

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    SQLITE_DB_PATH=/app/data/sales.sqlite \
    PYTHON_FORECAST_BIN=/opt/forecast-venv/bin/python \
    PYTHON_FORECAST_TIMEOUT_MS=20000

# Install Python runtime
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        python3 \
        python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Setup Python virtual environment
COPY requirements-forecast.txt ./

RUN python3 -m venv /opt/forecast-venv && \
    /opt/forecast-venv/bin/pip install --no-cache-dir -r requirements-forecast.txt

# Install Node production dependencies
COPY package.json ./

RUN npm install --omit=dev && \
    npm cache clean --force

# Copy frontend build
COPY --from=builder /app/dist ./dist

# Copy backend application
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/server ./server
COPY --from=builder /app/scripts ./scripts

# Copy required shared source files
COPY --from=builder /app/src/utils/csvParser.ts ./src/utils/csvParser.ts
COPY --from=builder /app/src/types/sales.ts ./src/types/sales.ts
COPY --from=builder /app/src/data/starterCsv.ts ./src/data/starterCsv.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Create application directories and set permissions
RUN mkdir -p /app/data /app/public && \
    chown -R node:node /app

# Run as non-root user
USER node

# Persistent SQLite storage
VOLUME ["/app/data"]

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s \
    --timeout=5s \
    --start-period=10s \
    --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# Start application
CMD ["npm", "start"]
