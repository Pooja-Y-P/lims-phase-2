# LIMS Project - Docker Setup Guide

This guide will help you run the LIMS (Laboratory Information Management System) project using Docker.

## 📋 Prerequisites

- Docker Desktop installed on your system
- Docker Compose (included with Docker Desktop)
- Git (optional, for version control)

## 🏗️ Architecture

The project consists of 4 Docker containers:

1. **postgres** - PostgreSQL 16 database
2. **pgadmin** - Database management interface (accessible at http://localhost:5050)
3. **backend** - FastAPI Python backend (accessible at http://localhost:8000)
4. **frontend** - React + Vite frontend (accessible at http://localhost:3000)

## 🚀 Quick Start

### Step 1: Set Up Environment Variables

1. Copy the environment template:
   ```bash
   cp env.template .env
   ```

2. Edit `.env` and update the following values:
   - `SECRET_KEY` - Generate a secure random key for production
   - Email settings (if using email functionality)
   - Database credentials (optional, defaults are fine for development)

### Step 2: Build and Start All Services

```bash
docker-compose up -d
```

This command will:
- Build the backend and frontend Docker images
- Download the PostgreSQL and pgAdmin images
- Create and start all containers
- Initialize the database with the schema

### Step 3: Verify Services Are Running

```bash
docker-compose ps
```

All services should show `Up` status.

### Step 4: Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs
- **pgAdmin**: http://localhost:5050 (login with credentials from `.env`)

## 🛠️ Common Commands

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres
```

### Stop All Services

```bash
docker-compose down
```

### Stop and Remove All Data (including database)

```bash
docker-compose down -v
```

### Rebuild After Code Changes

```bash
# Rebuild specific service
docker-compose up -d --build backend

# Rebuild all services
docker-compose up -d --build
```

### Restart a Service

```bash
docker-compose restart backend
docker-compose restart frontend
```

### Access Container Shell

```bash
# Backend container
docker exec -it lims-backend bash

# Frontend container
docker exec -it lims-frontend sh

# Database container
docker exec -it lims-postgres psql -U postgres -d limsdbp1
```

## 📊 Database Management

### Using pgAdmin

1. Open http://localhost:5050
2. Login with credentials from `.env`:
   - Email: Value of `PGADMIN_DEFAULT_EMAIL`
   - Password: Value of `PGADMIN_DEFAULT_PASSWORD`
3. The PostgreSQL server should be pre-configured (see `pgadmin/servers.json`)

### Direct Database Access

```bash
# Connect to PostgreSQL
docker exec -it lims-postgres psql -U postgres -d limsdbp1

# Backup database
docker exec lims-postgres pg_dump -U postgres limsdbp1 > backup.sql

# Restore database
cat backup.sql | docker exec -i lims-postgres psql -U postgres -d limsdbp1
```

## 🔧 Troubleshooting

### Port Already in Use

If you get a "port already in use" error, you can either:

1. Stop the conflicting service on your host machine
2. Change the port mapping in `docker-compose.yml`:
   ```yaml
   ports:
     - "8080:8000"  # Maps host port 8080 to container port 8000
   ```

### Database Connection Issues

If the backend can't connect to the database:

1. Check if postgres container is healthy:
   ```bash
   docker-compose ps
   ```

2. View postgres logs:
   ```bash
   docker-compose logs postgres
   ```

3. Verify `DATABASE_URL` in `.env` uses `postgres` as hostname (not `localhost`)

### Frontend Can't Connect to Backend

1. Verify backend is running: http://localhost:8000
2. Check CORS settings in `backend/main.py`
3. Check `VITE_API_BASE_URL` environment variable

### Hot Reload Not Working

If changes to your code aren't reflected:

1. For backend: The backend doesn't have hot reload by default in Docker. Restart the service:
   ```bash
   docker-compose restart backend
   ```

2. For frontend: Hot reload should work automatically with the volume mount

### Clear Everything and Start Fresh

```bash
# Stop and remove all containers, volumes, and networks
docker-compose down -v

# Remove all images
docker-compose down --rmi all -v

# Rebuild from scratch
docker-compose up -d --build
```

## 🔐 Production Considerations

When deploying to production:

1. **Use Strong Secrets**: Generate secure values for `SECRET_KEY` and passwords
   ```bash
   # Generate a secure secret key
   python -c "import secrets; print(secrets.token_urlsafe(32))"
   ```

2. **Update CORS Settings**: Modify `backend/main.py` to only allow your production domain

3. **Use Production Frontend Build**: Modify `frontend/Dockerfile` to build production assets:
   ```dockerfile
   FROM node:20-bullseye-slim AS builder
   WORKDIR /app
   COPY frontend/package*.json ./
   RUN npm ci
   COPY frontend /app
   RUN npm run build

   FROM nginx:alpine
   COPY --from=builder /app/dist /usr/share/nginx/html
   EXPOSE 80
   CMD ["nginx", "-g", "daemon off;"]
   ```

4. **Enable HTTPS**: Use a reverse proxy like Nginx or Traefik with SSL certificates

5. **Database Backups**: Set up automated database backups

6. **Resource Limits**: Add resource limits to docker-compose.yml:
   ```yaml
   deploy:
     resources:
       limits:
         cpus: '0.5'
         memory: 512M
   ```

## 📝 Creating Default Admin User

After the containers are running, create a default admin user:

```bash
# Run the create_admin script
docker exec -it lims-backend python -m backend.create_admin

# Or access the backend container and run it manually
docker exec -it lims-backend bash
python create_admin.py
```

## 🔄 Updating the Application

To update the application with new code changes:

```bash
# Pull latest changes (if using git)
git pull

# Rebuild and restart
docker-compose up -d --build
```

## 📚 Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [React Documentation](https://react.dev/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

## 🆘 Getting Help

If you encounter issues:

1. Check the logs: `docker-compose logs -f`
2. Verify all services are healthy: `docker-compose ps`
3. Review this documentation
4. Check the main README.md for application-specific information

## 📄 License

[Your License Here]

