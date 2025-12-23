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

# CORS
CORS_ORIGIN=http://localhost:5173
```

Replace `your_password` with your actual PostgreSQL password.

