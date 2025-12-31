# frontend/Dockerfile (dev mode - Vite)

FROM node:20-bullseye-slim

WORKDIR /app
 
# Copy package files first (cache-friendly)
COPY frontend/package.json frontend/package-lock.json ./
 
# Use npm ci to install exactly what's in the lockfile
RUN npm ci
 
# Copy rest of source
COPY frontend /app
 
EXPOSE 3000
 
# Start Vite dev server with hot reload
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]
