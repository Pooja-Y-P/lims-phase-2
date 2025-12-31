# 🚀 Quick Start - Running LIMS with Docker

## For Windows Users

1. **Open PowerShell or Command Prompt** in the project directory
2. **Run the startup script:**
   ```cmd
   start-docker.bat
   ```

3. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Docs: http://localhost:8000/docs

## For Mac/Linux Users

1. **Open Terminal** in the project directory
2. **Make the script executable:**
   ```bash
   chmod +x start-docker.sh
   ```

3. **Run the startup script:**
   ```bash
   ./start-docker.sh
   ```

4. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Docs: http://localhost:8000/docs

## Alternative - Manual Docker Commands

If you prefer manual control:

```bash
# 1. Create .env file (if not exists)
cp env.template .env

# 2. Start all services
docker-compose up -d

# 3. View logs
docker-compose logs -f

# 4. Stop all services
docker-compose down
```

## First Time Setup

1. The script will automatically create a `.env` file from `env.template`
2. **Important:** Edit `.env` and update:
   - `SECRET_KEY` - Generate using: `python -c "import secrets; print(secrets.token_urlsafe(32))"`
   - Email settings (if using email features)

## Creating Admin User

After containers are running:

```bash
docker exec -it lims-backend python create_admin.py
```

Or if that doesn't work:

```bash
docker exec -it lims-backend python -c "from backend.create_admin import create_default_admin; create_default_admin()"
```

## Troubleshooting

### Services won't start?
```bash
# Check status
docker-compose ps

# View logs
docker-compose logs -f

# Stop and restart
docker-compose down
docker-compose up -d
```

### Port already in use?
Edit `docker-compose.yml` and change the port mappings:
```yaml
ports:
  - "8080:8000"  # Change 8080 to any available port
```

### Need to reset everything?
```bash
# Warning: This will delete all data
docker-compose down -v
docker-compose up -d --build
```

## 📖 More Information

For detailed documentation, see [DOCKER_SETUP.md](DOCKER_SETUP.md)

