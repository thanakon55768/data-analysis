# SDD ledger — plan: 2026-11-20-phase-1-core.md

2026-11-20: User authorized inline implementation of all Phase 1 tasks.
Ruling: No Git repository exists, including nested application directory; implement in current workspace and retain legacy Vite files until migration checks pass. No Git worktree, commits or Git-only ledger scripts apply.
Ruling: Browser plugin/skill not available; use project Playwright E2E with real services as authorized in approved plan. Temporary QA outputs ignored.
Pre-flight: Tasks 2→3 share cN column mapping and repository.frame; Tasks 3→4 share Dataset/Preview/Statistics contracts. Signatures aligned. Task 5 documents actual commands. No Git-dependent steps applicable.
Task 1: complete — Node 24.15.0, npm 11.12.1, Python 3.14.4; .venv, Next/FastAPI boundary, health, bounded proxy. Health test first failed on missing app.main, then passed.
Task 2: complete — file/sheet parsing, budgets, process deadline, temp lifecycle. Tests consolidated in test_datasets.py/test_processing.py rather than duplicating upload/parsing fixture files. Initial API tests failed for missing implementation; final suite passes.
Task 3: complete — genuine Python stats and paginated literal-search preview. Verified exact sum/mean/median/min/max, null/NA, duplicates, expiry and deletion.
Task 4: complete — Thai workspace, upload, sheets, search, pagination, numeric column selector, errors/loading/empty/deletion, stale-request guards. Initial browser red: missing empty-state UI. Real-service production E2E is green.
Task 5: complete — root convenience scripts, requirements-lock/npm lockfiles, environment examples, README, visual tokens and QA report. Legacy Vite files moved intact into legacy-vite after migration build passed.

Ruling: Add 2,000,000-cell and 32 MiB logical-text budgets — compressed Excel can expand repeated shared strings; cost: larger valid files require splitting. Before-public-release performance benchmarking remains required.
Ruling: Preserve numeric columns as text with warning when conversion changes decimal round-trip — protects values and duplicate counts; cost: such columns have no numeric metrics until explicitly cleaned in a future phase.
Ruling: Preview adapts page size below 2 MiB; a single oversized row is explicitly shortened in preview only, with full source/statistics retained — cost: preview text is incomplete in that flagged case.
Ruling: Excel durations use ISO 8601 text (PT99000S), with signed fractional seconds — cost: durations are not numeric analysis columns in Phase 1.
Ruling: Use bundled Noto Sans Thai for consistent Thai glyphs, not unreliable system font fallback — cost: modest local font asset size; no external font requests.
Ruling: Production E2E on fresh ports 3001/8001 avoids stale dev servers. Sandbox initially blocked a build (EPERM) and prevented child server cleanup; explicit approved escalation resolved both. Test runner prints harmless environment FORCE_COLOR/NO_COLOR warnings, not app console errors.
Ruling: Quoted one-column headers containing delimiter-like characters are valid CSV — corrected rejection as a valid-input bug; no deferred minor remains.

Final review: fresh read-only reviewer phase1_review completed. Five important findings plus CSV/docs issues addressed in one fix pass. Precision, long-preview, huge-cell, timedelta and logical-budget tests were observed failing before fixes; pending-sheet browser regression was observed failing before busy-state guard. Final backend suite 29 passed; E2E suite 10 passed (exit 0, 45.6s). No re-review dispatch.
Final checks: npm run build → exit 0; frontend npm run lint / npm run typecheck → exit 0; ruff check backend/app backend/tests --config backend/pyproject.toml → all checks passed; pip check → no broken requirements.
Review scope rulings: auth/public deployment/future phases intentionally excluded; full memory/load benchmarks are not proven by functional tests. Source remains in current workspace; no branch/merge/commit was created because no Git repository exists.
Deferred minors: none from reviewer; performance benchmarks and Phase 2 security are explicit future-phase gates.
