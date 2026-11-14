# Deploying FLAMEPRINT

Backend on **Render** (FastAPI), frontend on **Vercel** (Next.js), both from this repo. Deploy once Phase 1 passes,
then redeploy after each change so the live URL never falls behind.

## 1. Backend on Render

1. Render → **New → Blueprint** → connect the GitHub repo. Render reads `render.yaml` (root dir `backend`,
   `pip install -r requirements.txt`, `uvicorn app.main:app --host 0.0.0.0 --port $PORT`, health check `/api/health`).
2. Set the environment variables below (the Blueprint asks for the ones marked `sync: false`).
3. Deploy, then open `https://<service>.onrender.com/api/health`. Expect `"ok": true` and `"investigations": 22`.

The service finds the catalog by itself: `main.py` resolves `data/` from the repo root (covered by
`test_health_reports_seed_loaded_from_default_dir`).

## 2. Frontend on Vercel

1. Vercel → **New Project** → same repo → **Root Directory `frontend`**. Vercel detects Next.js.
2. Set the environment variables below.
3. Deploy, open the URL, and check that the Answer screen shows a verdict and a grade.
4. Add the Vercel URL to `CORS_ORIGINS` on Render and redeploy the backend.

## Environment variables

| Variable | Where | Value | Notes |
|---|---|---|---|
| `GROQ_API_KEY` | Render | team key | Optional. Without it: offline brief writer and keyword-only stowage. |
| `FLAMEPRINT_LLM` | Render | `auto` | `off` forces offline mode for a safe demo. |
| `CORS_ORIGINS` | Render | `https://<project>.vercel.app` | Comma-separated. Add any custom domain. |
| `PYTHON_VERSION` | Render | the version you tested locally | Pinned to 3.12.7 in `render.yaml`; change it if you tested on another. |
| `NEXT_PUBLIC_API_BASE` | Vercel | `https://<service>.onrender.com` | Browser calls Render directly (CORS), so SSE briefs stream unbuffered. |
| `FLAMEPRINT_API_URL` | Vercel | same Render URL | Used by the `/api` rewrite as a fallback. |

If the brief arrives in one block instead of streaming on the live site, check `NEXT_PUBLIC_API_BASE` first.
`NEXT_PUBLIC_*` values are baked in at build time: redeploy Vercel after changing it.

## Before judging

- [ ] Open `/api/health` 5 minutes before judging (free Render instances sleep; the first request can take ~1 min).
      Keep a tab open on it.
- [ ] Commit official PSI files into `data/psi/` and redeploy. Data Lab uploads are lost when Render restarts.
- [ ] Backup: `./start.sh` on a laptop with `FLAMEPRINT_LLM=off` in `backend/.env`, plus a recorded video.
- [ ] Keys only in Render settings and the local `backend/.env`. Never in the frontend or the repo.

## Local checks (run before every deploy)

```bash
cd backend && pip install -r requirements-dev.txt && python -m pytest -q
cd frontend && npm run typecheck && npm run lint && npm test && npm run build
```
