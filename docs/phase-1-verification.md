# Phase 1 acceptance — 20 November 2026

## Verification evidence

| Check | Actual result |
|---|---|
| npm run test:backend | 29 passed, exit 0 |
| frontend npm run test:e2e | 10 passed, 45.6 seconds, exit 0 |
| npm run build | Next.js production build passed, exit 0 |
| frontend npm run lint / typecheck | Passed, exit 0 |
| ruff check backend/app backend/tests --config backend/pyproject.toml | All checks passed |
| .venv/Scripts/python.exe -m pip check | No broken requirements |

Real browser coverage: Thai CSV → Python metrics → search → delete; pagination; invalid file and API outage recovery; 375px mobile; workbook sheet changes and empty sheet; replacement file with delayed old preview; pending sheet mutation with prior search; expiry and hostile Origin; adaptive long-text pages and backwards navigation; statistics preserved during preview-only failure. Network failure/delay cases are controlled test interceptions; ordinary upload/calculation flows use the real FastAPI server.

Backend covers formula-without-cache warnings, malformed CSV, resource caps, archive bounds, IQR not included (future phase), duration serialization, null/non-finite math, precision-loss preservation, timeout termination, deletion and expiry. Functional tests do not prove the maximum dataset's memory/latency profile.

## Browser / visual QA

Browser plugin unavailable; project Playwright Chromium used with real production Next.js/FastAPI services at 127.0.0.1:3001/8001. Default desktop plus native concept-width 1487px and 375×812 mobile checked. Browser success path asserts no page errors or error console messages. Build/tool environment prints FORCE_COLOR/NO_COLOR warnings only.

Concept at C:/Users/Nao/.codex/generated_images/01a1f97f-73a8-7d93-b11d-9bd7c39d89cc/exec-d815bb2f-6b96-4e26-8386-81f9a264ff7b.png was viewed with view_image, as were final desktop-empty, desktop-loaded and mobile-loaded Playwright screenshots. Screenshot viewport for the desktop concept check is 1487×1058; full-page capture extends to actual document height.

Five comparison points inspected:
1. Main background true white, cool gray surrounding page, teal primary action, dark navy text preserved.
2. Header, introduction, upload/instructions, overview and table order preserved; no fictitious metrics.
3. Thai heading hierarchy and control typography verified; bundled Noto Sans Thai fixes system glyph fallback.
4. Upload/table outline icons, fine borders and restrained corners preserved.
5. Mobile stacks upload/instructions, splits overview into 2×2 and contains table scrolling; no viewport overflow.

Above-fold copy reviewed against concept: brand, heading, upload labels and overview labels retained. Intentional extensions: file limits and first-row guidance; actual file/sheet/expiry controls, numeric statistics, search/pagination and precise retention copy. Open instructions panel follows the concept brief rather than adding an unnecessary border. Loaded-state content extends the empty concept through required real-data controls. No asset media or charts invented. Implementation visually checked against concept, with these documented functional extensions.

## Remaining phase boundary

Local single-user only, no public deployment or cross-account claim. Authentication/private Supabase storage and histories are Phase 2; Gemini, charts, outliers and PDF follow later. Refresh does not restore a selected dataset. Temporary data expires after 24 hours with startup/access cleanup, not a continuous deletion scheduler. Original Vite starter retained in legacy-vite; no Git repository existed, so no commits or merges performed.
