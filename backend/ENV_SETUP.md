# Environment Configuration

Create a `.env` file in the `backend` directory with the following:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=production_dashboard
DB_USER=postgres
DB_PASSWORD=your_password

# Server Configuration
PORT=3001
NODE_ENV=development

# CORS Configuration
# In development mode (NODE_ENV=development), CORS allows all origins for easy remote access (Tailscale/VPN)
# In production mode, specify allowed origins (comma-separated for multiple origins):
# CORS_ORIGIN=http://localhost:5173,http://100.94.207.3:5173
# For development, this is optional - all origins are allowed automatically
# CORS_ORIGIN=http://localhost:5173
```

Replace `your_password` with your actual PostgreSQL password.

## Remote Access Configuration

### Development Mode (Default)

When `NODE_ENV=development`, the backend:
- ✅ **Allows all CORS origins** - Easy remote access via Tailscale/VPN
- ✅ **Listens on `0.0.0.0:3001`** - Accepts connections from all network interfaces
- ✅ **No CORS configuration needed** - Works out of the box

### Production Mode

For production deployments, explicitly configure allowed origins:

```env
NODE_ENV=production
CORS_ORIGIN=https://yourdomain.com,https://dashboard.yourdomain.com
```

Multiple origins can be specified as a comma-separated list.