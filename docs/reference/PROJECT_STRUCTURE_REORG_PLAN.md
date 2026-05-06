# Project Structure Reorganization Plan (Safe Mode)

This plan aligns the repository with `.cursor/plans/project-structure.md` while preserving all existing files and avoiding source/runtime breakage.

## 1) Safety Principle
- No source files are moved in this step.
- No imports, runtime paths, or build commands are changed.
- No files are deleted in this step.

## 2) Current Shape (Observed)
- Frontend app at root (`src/`, `vite.config.ts`, root `package.json`)
- Backend app under `backend/`
- Existing docs split between root `*.md` and `docs/`
- Existing scripts split between root `*.ps1`, `scripts/`, and `backend/scripts/`

## 3) Target Shape (Based on Skill)

```text
my-project/
├── backend/
├── src/
├── docs/
│   ├── api/
│   ├── architecture/
│   ├── guides/
│   └── troubleshooting/
├── scripts/
├── shared/                # optional, for FE/BE contracts
└── infrastructure/        # optional, when infra-as-code/ops files exist
```

## 4) Non-Breaking Configuration Applied
- Keep runtime code layout as-is (`src/` and `backend/` unchanged).
- Keep script execution paths as-is.
- Keep all root markdown files in place for now.
- Add this migration plan so moves/deletions can be done in controlled phases.

## 5) Planned Move Map (Do Later, Controlled)
- Root setup/how-to docs -> `docs/guides/`
- Root architecture/design docs -> `docs/architecture/`
- Root API docs -> `docs/api/`
- Root troubleshooting/fix docs -> `docs/troubleshooting/`
- Root utility PowerShell scripts -> `scripts/powershell/`
- Keep SQL maintenance files near backend DB domain (prefer `backend/database/maintenance/`)

## 6) Suggested Cleanup Candidates (Review Before Delete)

Potential duplicates/near-duplicates:
- `create-env-files.ps1` vs `CREATE_ENV_FILES.ps1` (same purpose naming, likely duplicate)
- `FIX_WHITE_SCREEN.md` vs `DEBUG_WHITE_SCREEN.md` (overlapping topic)
- `QUICK_START.md` vs `SETUP_INSTRUCTIONS.md` (possible overlap)
- `NODE_RED_SETUP.md` vs `NODE_RED_SIMPLE_SETUP.md` (possible overlap)

Likely generated/artifact files to consider removing from VCS:
- `scripts/__pycache__/` (should be ignored, not tracked)
- `scripts/quality_export.txt` (if generated)
- `scripts/technical_export.txt` (if generated)
- `backend/scripts/exported-machines-data.js` (if export artifact, not source)

Legacy one-off maintenance files to review:
- `delete-machines-D07-D08.sql`
- `fix-delete-D07.sql`
- `fix-delete-D07-with-options.sql`
- `delete-machines-D07-D08.ps1`

## 7) Recommended Execution Order
1. Approve final folder taxonomy under `docs/`.
2. Move docs in batches with quick validation after each batch.
3. Move PowerShell scripts to `scripts/powershell/`.
4. Move SQL maintenance scripts to `backend/database/maintenance/`.
5. Delete only reviewed duplicates/artifacts.
6. Run smoke checks (`npm run dev`, backend start, key APIs).

