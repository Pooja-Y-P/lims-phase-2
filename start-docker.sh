#!/bin/bash

# LIMS Project Docker Startup Script

echo "🚀 Starting LIMS Project with Docker..."
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found!"
    echo "📋 Copying env.template to .env..."
    cp env.template .env
    echo "✅ Created .env file from template"
    echo ""
    echo "⚠️  IMPORTANT: Please edit .env and update the following:"
    echo "   - SECRET_KEY (generate a secure random key)"
    echo "   - Email settings (if using email functionality)"
    echo ""
    read -p "Press Enter to continue or Ctrl+C to exit and edit .env first..."
fi

echo "🏗️  Building Docker images..."
docker-compose build

echo ""
echo "🔄 Starting all services..."
docker-compose up -d

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 5

echo ""
echo "📊 Service Status:"
docker-compose ps

echo ""
echo "✅ LIMS Project is starting!"
echo ""
echo "📱 Access the application at:"
echo "   - Frontend:  http://localhost:3000"
echo "   - Backend:   http://localhost:8000"
echo "   - API Docs:  http://localhost:8000/docs"
echo "   - pgAdmin:   http://localhost:5050"
echo ""
echo "📝 View logs with: docker-compose logs -f"
echo "🛑 Stop services with: docker-compose down"
echo ""
echo "📖 For more information, see DOCKER_SETUP.md"

