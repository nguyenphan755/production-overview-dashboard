# PROJECT STRUCTURE & NAMING CONVENTIONS SKILL

## 1. CẤU TRÚC THƯ MỤC GỐC

my-project/
├── backend/             # Server, API, business logic
├── frontend/            # UI, React/Vue/Next.js
├── database/            # Migrations, seeds, schemas
├── shared/              # Types, constants dùng chung FE+BE
├── infrastructure/      # Docker, CI/CD, Terraform
├── docs/                # Tài liệu kỹ thuật
├── skills/              # Cursor skills (.md rules)
├── scripts/             # Build, deploy, utility scripts
├── .env.example         # Biến môi trường mẫu (KHÔNG commit .env)
├── .gitignore
├── docker-compose.yml
├── Makefile             # Lệnh tắt: make dev, make test, make build
└── README.md

---

## 2. BACKEND

backend/
├── src/
│   ├── routes/          # Định nghĩa endpoint URL
│   ├── controllers/     # Xử lý request/response
│   ├── services/        # Business logic thuần
│   ├── models/          # ORM models / DB entities
│   ├── middlewares/     # Auth, logging, validation
│   ├── repositories/    # Truy vấn DB (tách khỏi service)
│   ├── utils/           # Helper functions
│   ├── config/          # Cấu hình app, DB, env
│   ├── jobs/            # Background jobs, cron
│   ├── events/          # Event emitters/handlers
│   └── app.ts           # Khởi tạo app (Express/Fastify)
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── Dockerfile
└── package.json (hoặc pyproject.toml / go.mod)

---

## 3. FRONTEND

frontend/
├── src/
│   ├── components/      # UI components tái sử dụng
│   │   ├── ui/          # Atoms: Button, Input, Modal
│   │   └── features/    # Molecules: UserCard, ProductList
│   ├── pages/           # Page-level components (Next.js) hoặc views/
│   ├── layouts/         # Khung bố cục: DashboardLayout, AuthLayout
│   ├── hooks/           # Custom React hooks
│   ├── stores/          # State management (Zustand/Pinia/Redux)
│   ├── services/        # API calls (axios, fetch wrappers)
│   ├── utils/           # Helper functions FE
│   ├── styles/          # Global CSS, Tailwind config
│   ├── assets/          # Ảnh, fonts, icons tĩnh
│   ├── constants/       # Enum, magic strings
│   └── types/           # TypeScript types/interfaces
├── public/              # Static files (favicon, manifest)
├── tests/
├── Dockerfile
└── package.json

---

## 4. DATABASE

database/
├── migrations/          # Lịch sử thay đổi schema (tên: 001_create_users.sql)
├── seeds/               # Dữ liệu khởi tạo / test data
├── schemas/             # Schema definition files (.prisma, .sql, ERD)
└── queries/             # Raw SQL queries phức tạp

---

## 5. SHARED (dùng chung BE + FE)

shared/
├── types/               # TypeScript interfaces, enums
├── constants/           # APP_ROLES, STATUS_CODES, ...
├── validators/          # Zod / Yup schemas
└── api-contracts/       # OpenAPI spec, API types generated

---

## 6. INFRASTRUCTURE

infrastructure/
├── docker/              # Dockerfiles riêng theo service
├── nginx/               # Reverse proxy config
├── ci-cd/               # GitHub Actions, GitLab CI yml
├── terraform/           # IaC: cloud provisioning
└── monitoring/          # Prometheus, Grafana configs

---

## 7. DOCS

docs/
├── skills/              # Cursor skill files (.md)
├── api/                 # API documentation (Swagger/OpenAPI)
├── architecture/        # System design, diagrams
├── adr/                 # Architecture Decision Records
│   └── 001-use-postgresql.md
├── guides/              # Onboarding, dev setup guides
└── CHANGELOG.md

---

## 8. QUY TẮC ĐẶT TÊN FILE

### Chung (áp dụng mọi loại):
- Dùng kebab-case cho tên file: user-profile.ts, auth-middleware.ts
- Dùng PascalCase cho React components: UserCard.tsx, AuthModal.tsx
- Dùng camelCase cho functions/variables: getUserById, isAuthenticated
- Dùng UPPER_SNAKE_CASE cho constants: MAX_RETRY_COUNT, API_BASE_URL
- Dùng PascalCase cho classes/interfaces: UserService, IUserRepository

### Backend:
- Controller: user.controller.ts
- Service:    user.service.ts
- Model:      user.model.ts
- Route:      user.routes.ts
- Middleware: auth.middleware.ts
- Test:       user.service.test.ts

### Frontend:
- Component: UserCard.tsx
- Hook:      useAuth.ts
- Store:     authStore.ts
- Service:   userApi.ts
- Page:      /pages/users/[id].tsx

### Database:
- Migration: 20240101_001_create_users_table.sql
- Seed:      01_seed_admin_user.ts

---

## 9. QUY TẮC IMPORT / MODULE

- Dùng absolute imports với alias: @/components/..., @backend/services/...
- Không import trực tiếp giữa backend và frontend (dùng shared/)
- Barrel exports: mỗi thư mục có index.ts export ra ngoài
- Không dùng default export (ưu tiên named export)

---

## 10. BIẾN MÔI TRƯỜNG

- Tất cả biến env đặt trong .env (không commit)
- Commit .env.example với giá trị mẫu (không có giá trị thật)
- Đặt tên: SERVICE_VARIABLE_NAME (UPPERCASE_SNAKE_CASE)
  - DB_HOST, DB_PORT, DB_NAME
  - JWT_SECRET, JWT_EXPIRES_IN
  - REDIS_URL
  - NEXT_PUBLIC_API_URL   (FE public vars có prefix NEXT_PUBLIC_)

---

## 11. GIT & COMMIT CONVENTIONS

### Branch naming:
- feature/user-authentication
- fix/login-error-500
- chore/update-dependencies
- hotfix/payment-null-crash

### Commit message (Conventional Commits):
- feat: add user registration endpoint
- fix: resolve null pointer in auth middleware
- docs: update API documentation
- refactor: extract validation logic to shared
- test: add unit tests for UserService
- chore: upgrade Node to v20

---

## 12. API DESIGN CONVENTIONS

### REST endpoints:
- Dùng danh từ số nhiều: /api/v1/users, /api/v1/products
- Không dùng động từ trong URL: ❌ /getUser, ✅ GET /users/:id
- Versioning bắt buộc: /api/v1/...
- Nested resource (tối đa 2 cấp): /api/v1/users/:id/orders

### Response structure:
{
  "success": true,
  "data": { ... },
  "message": "User created successfully",
  "meta": { "page": 1, "total": 100 }   // khi có pagination
}

### Error structure:
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Email is invalid",
    "details": [...]
  }
}
