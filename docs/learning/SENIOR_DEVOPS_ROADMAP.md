# Senior Web App + DevOps Roadmap — MES Production Dashboard

> Lộ trình 6–12 tháng · 10–20h/tuần · Hybrid Linux/Windows
> Bản tóm tắt trong repo; plan chi tiết trong Cursor: `mes_senior_devops_roadmap`

---

## Phase overview

| Phase | Thời gian | Mục tiêu chính |
|-------|-----------|----------------|
| **0** | Tuần 1–2 | Lab Linux, baseline metrics, Session 0A/0B |
| **1** | Tháng 1–2 | Docker, Linux deploy, NGINX systemd |
| **2** | Tháng 2–3 | Security (JWT, API key, idempotency), CI/CD, Prometheus/logs |
| **3** | Tháng 3–4 | Backend refactor, Redis cache, BullMQ |
| **4** | Tháng 4–5 | React Router, tsconfig, LB, CDN headers |
| **5** | Tháng 5–6 | S7-1500 → Node-RED → Linux MES API |
| **6** | Tháng 6+ | OpenAPI, ADR, LLM+RAG, OAuth optional, Cursor AI |

---

## Skill thực chiến

Chi tiết từng công nghệ: **[SKILL_BATTLEMAP.md](./SKILL_BATTLEMAP.md)**

| Skill | Phase |
|-------|-------|
| JWT, Idempotency Key | 2 |
| Prometheus, Grafana, Logs | 0 lab → 2 implement |
| Redis cache, BullMQ | 3 |
| Load balance, CDN | 4 |
| OAuth, LLM+RAG | 6 |

---

## Sprint 0 — bắt đầu ngay

1. Setup Ubuntu VM + Docker
2. Session 0A: đọc [SKILL_BATTLEMAP.md](./SKILL_BATTLEMAP.md), điền §6 baseline
3. Session 0B: [OBSERVABILITY_QUICKSTART.md](../guides/OBSERVABILITY_QUICKSTART.md)
4. Viết `backend/Dockerfile`, `frontend/Dockerfile`, `docker-compose.prod.yml`
5. Draft [LINUX_DEPLOY.md](../guides/LINUX_DEPLOY.md) (Phase 1)

**Acceptance**: `docker compose up` → login → production overview với seed data.

---

## Quy tắc làm việc

- **1 skill / sprint** — không over-engineer
- **Measure first** — baseline trước Redis/Prometheus production
- **Cursor AI** — chỉ sau Phase 2; AI draft, bạn review + test
- **OT boundary** — LLM/RAG chỉ docs; API key cho ingestion

---

## Tài liệu liên quan

- [SKILL_BATTLEMAP.md](./SKILL_BATTLEMAP.md)
- [OBSERVABILITY_QUICKSTART.md](../guides/OBSERVABILITY_QUICKSTART.md)
- [MES_ARCHITECTURE_GUIDE.md](../architecture/MES_ARCHITECTURE_GUIDE.md)
- [README-deploy.md](../../README-deploy.md)
