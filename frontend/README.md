# FLAMEPRINT web app

Next.js 15 · TypeScript · Tailwind v4 · Framer Motion · React Three Fiber.
See the [root README](../README.md) for setup. `/api/*` is proxied to the FastAPI backend (`FLAMEPRINT_API_URL`, default `http://127.0.0.1:8000`).

```bash
npm run dev        # http://localhost:3000
npm test           # vitest unit tests
npm run typecheck && npm run lint && npm run build
```
