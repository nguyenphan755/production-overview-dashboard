# Script to create both .env files

Write-Host "🔧 Creating .env files..." -ForegroundColor Cyan
Write-Host ""

# Create Frontend .env (project root)
$frontendEnv = @"
# Frontend Environment Variables (Vite)
# This file is for the React frontend

# API Base URL
VITE_API_BASE_URL=http://localhost:3001/api

# Use real API (not mock data)
VITE_USE_MOCK_DATA=false

# Enable real-time WebSocket updates
VITE_REALTIME_ENABLED=true
"@

$frontendEnv | Out-File -FilePath ".env" -Encoding utf8 -NoNewline
Write-Host "✅ Created: .env (Frontend)" -ForegroundColor Green

# Create Backend .env
$backendEnv = @"
# Backend Environment Variables (Node.js)
# This file is for the Express backend server

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mes_db
DB_USER=postgres
DB_PASSWORD=root

# Server Configuration
PORT=3001
NODE_ENV=development

# CORS Configuration
CORS_ORIGIN=http://localhost:5173

# JWT Secret (change in production!)
JWT_SECRET=your-secret-key-change-in-production
"@

$backendEnv | Out-File -FilePath "backend\.env" -Encoding utf8 -NoNewline
Write-Host "✅ Created: backend\.env (Backend)" -ForegroundColor Green

Write-Host ""
Write-Host "📋 Summary:" -ForegroundColor Cyan
Write-Host "   • Frontend .env → Project root (for Vite)" -ForegroundColor White
Write-Host "   • Backend .env → backend/ folder (for Node.js)" -ForegroundColor White
Write-Host ""
Write-Host "✅ Both files created successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "💡 Why 2 files?" -ForegroundColor Yellow
Write-Host "   • Frontend needs its own config (VITE_ variables)" -ForegroundColor Gray
Write-Host "   • Backend needs its own config (DB, PORT, JWT_SECRET)" -ForegroundColor Gray
Write-Host "   • This is the correct architecture!" -ForegroundColor Gray

