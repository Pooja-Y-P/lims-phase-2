# pgAdmin Setup Guide

## 🔐 Default Credentials

### pgAdmin Web Interface Login
- **URL**: http://localhost:5050
- **Email**: Set in `.env` as `PGADMIN_DEFAULT_EMAIL` (default: admin@lims.com)
- **Password**: Set in `.env` as `PGADMIN_DEFAULT_PASSWORD` (default: admin123)
- **Role**: Admin (automatically assigned)

### Security Notes
- ✅ **Password Hashing**: pgAdmin automatically hashes the password internally - you don't need to hash it manually
- ✅ **Admin Role**: The default user created from `PGADMIN_DEFAULT_EMAIL` is automatically given admin privileges
- ✅ **Pre-configured Server**: The PostgreSQL server connection is automatically configured

## 📝 Configuration Files

### 1. Environment Variables (`.env`)
```bash
# pgAdmin login credentials
PGADMIN_DEFAULT_EMAIL=admin@lims.com
PGADMIN_DEFAULT_PASSWORD=admin123
```

### 2. Auto-configured PostgreSQL Connection
The following files automatically set up the database connection in pgAdmin:
- `pgadmin/servers.json` - Defines the PostgreSQL server
- `pgadmin/pgpass` - Stores the PostgreSQL password securely

## 🚀 Usage

1. **Start the containers**:
   ```bash
   docker compose up -d
   ```

2. **Access pgAdmin**:
   - Open browser: http://localhost:5050
   - Login with your `PGADMIN_DEFAULT_EMAIL` and `PGADMIN_DEFAULT_PASSWORD`

3. **PostgreSQL Connection**:
   - The server "LIMS PostgreSQL" is pre-configured
   - You may be asked for the password: `postgres` (or your `POSTGRES_PASSWORD` from `.env`)

## 🔄 Resetting pgAdmin

If you need to reset pgAdmin (clear all settings and start fresh):

```bash
docker compose down
docker volume rm lims-proj-phase-1_pgadmin_data
docker compose up -d
```

## 🛡️ Production Security

For production deployments:
1. Change default passwords in `.env`
2. Use strong, unique passwords
3. Consider using secrets management
4. Enable SSL/TLS for pgAdmin
5. Set `PGADMIN_CONFIG_SERVER_MODE: 'True'` for multi-user mode

## 📊 Database Details

- **Host**: postgres (Docker network name)
- **Port**: 5432
- **Database**: limsdbp1
- **Username**: postgres
- **Password**: postgres (change in production!)

