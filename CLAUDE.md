# Instructions for Claude (and humans) working on FLAMEPRINT

1. **Before doing anything, read [`CONTEXT.md`](CONTEXT.md).** It holds the goal, current status, architecture, rules that must not
   break, what's left and the gotchas. Don't re-derive what it already says.
2. **Follow the rules in CONTEXT.md section 4**, especially: numbers come from Python and never from the LLM; no invented scientific
   values (unsourced values get grade M and go into `docs/OPEN_QUESTIONS.md`); offline must keep working; respect the content budget.
3. **Run the checks before every commit:**
   `cd backend && .venv/bin/python -m pytest -q` and
   `cd frontend && npm run typecheck && npm run lint && npm test && npm run build` (don't build while `npm run dev` is running).
4. **Work on a branch from `origin/main`** and open a pull request to `Hamza-04-mav/FLAMEPRINT`. Never commit `backend/.env` or API keys.
5. **At the end of every session, update `CONTEXT.md`** as described in its "How to update this file" section: last-updated line,
   status table, what's left, one session-log row, and any changed facts. Commit it with the session's work.
