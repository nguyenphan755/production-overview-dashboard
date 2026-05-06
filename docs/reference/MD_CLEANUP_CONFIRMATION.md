# Markdown Cleanup Confirmation

This file lists duplicated/overlapping markdown documents and the proposed single canonical file to keep.

## Proposed Canonical Files
- Keep `SETUP_INSTRUCTIONS.md` as the main setup guide.
  - Contains end-to-end setup + Node-RED + troubleshooting.
  - Already updated with missing quick-start details (DB create/setup-db/seed options).
- Keep `FIX_WHITE_SCREEN.md` as the white-screen troubleshooting guide.
  - Already updated with file verification + dependency/module checks.
- Keep `NODE_RED_SIMPLE_SETUP.md` as the active Node-RED guide.
  - Aligns with API/JWT/WebSocket flow (current architecture).

## Files Proposed For Deletion (Need Your Confirmation)

### Group A - Setup duplication
- [ ] Delete `QUICK_START.md` (covered by `SETUP_INSTRUCTIONS.md`)

### Group B - White-screen troubleshooting duplication
- [ ] Delete `DEBUG_WHITE_SCREEN.md` (covered by `FIX_WHITE_SCREEN.md`)

### Group C - Node-RED guide duplication
- [ ] Delete `NODE_RED_SETUP.md` (older direct-DB style; overlaps and may conflict with API-first flow)

## Additional Non-MD Candidates (Optional, Separate Confirmation)
- [ ] Delete `create-env-files.ps1` or `CREATE_ENV_FILES.ps1` (keep only one)
- [ ] Remove `scripts/__pycache__/` from repo and add ignore rule if needed
- [ ] Delete generated export artifacts if no longer used:
  - `scripts/quality_export.txt`
  - `scripts/technical_export.txt`
  - `backend/scripts/exported-machines-data.js`

## Reference Folder
- Reorg planning document moved to:
  - `docs/reference/PROJECT_STRUCTURE_REORG_PLAN.md`

