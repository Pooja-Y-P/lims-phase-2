# backend/Dockerfile

FROM python:3.11-slim

WORKDIR /app
 
# Install system deps needed for build & Postgres client libs
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*
 
# Copy requirements and install (use pip upgrade for wheel/build stability)
COPY backend/requirements.txt /app/backend/requirements.txt

WORKDIR /app/backend
 
# Ensure pip/wheel are fresh, then install
RUN python -m pip install --upgrade pip setuptools wheel \
    && pip install --no-cache-dir -r requirements.txt
 
# Copy backend source
COPY backend /app/backend

WORKDIR /app

# Create uploads directory with proper permissions
RUN mkdir -p /app/uploads/inward_photos && chmod -R 755 /app/uploads
 
# Set Python path
ENV PYTHONPATH=/app

EXPOSE 8000

# Use reload for development
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
