# Create both .env files for Frontend and Backend

Write-Host "🔧 Creating .env files..." -ForegroundColor Cyan
Write-Host ""

# Create Frontend .env (Project Root)
Write-Host "📝 Creating Frontend .env (project root)..." -ForegroundColor Yellow
@"
VITE_API_BASE_URL=http://localhost:3001/api
VITE_USE_MOCK_DATA=false
VITE_REALTIME_ENABLED=true
"@ | Out-File -FilePath ".env" -Encoding utf8 -NoNewline
Write-Host "✅ Created: .env" -ForegroundColor Green

# Create Backend .env
Write-Host "📝 Creating Backend .env (backend folder)..." -ForegroundColor Yellow
@"
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=production_dashboard
DB_USER=postgres
DB_PASSWORD=root

# Server Configuration
PORT=3001
NODE_ENV=development

# CORS
CORS_ORIGIN=http://localhost:5173

# JWT Secret (change in production!)
JWT_SECRET=your-secret-key-change-in-production
"@ | Out-File -FilePath "backend\.env" -Encoding utf8 -NoNewline
Write-Host "✅ Created: backend\.env" -ForegroundColor Green

Write-Host ""
Write-Host "✅ Both .env files created!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Summary:" -ForegroundColor Cyan
Write-Host "   1. .env (root) - Frontend configuration" -ForegroundColor White
Write-Host "   2. backend\.env - Backend configuration" -ForegroundColor White
Write-Host ""
Write-Host "💡 Why 2 files?" -ForegroundColor Yellow
Write-Host "   - Frontend uses .env in project root (Vite requirement)" -ForegroundColor White
Write-Host "   - Backend uses .env in backend/ folder (Node.js requirement)" -ForegroundColor White
Write-Host ""
Write-Host "⚠️  Important:" -ForegroundColor Yellow
Write-Host "   - Update DB_PASSWORD in backend\.env if your PostgreSQL password is different" -ForegroundColor White
Write-Host "   - Change JWT_SECRET in backend\.env for production" -ForegroundColor White

