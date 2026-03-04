# @kapsel/registry

Reference [Kapsel](https://kapsel.sh) registry server. Implements the Registry Protocol from §12 of the specification.

## Running

```bash
# Development
pnpm install
pnpm build
node dist/index.js

# With env vars
PORT=3000 \
KAPSEL_JWT_SECRET=your-secret \
KAPSEL_REGISTRY_URL=https://registry.example.com \
KAPSEL_REGISTRY_NAME=my-registry \
node dist/index.js
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP port |
| `KAPSEL_JWT_SECRET` | insecure default | JWT signing secret. **Must be set in production.** |
| `KAPSEL_REGISTRY_URL` | `http://localhost:3000` | Public base URL (used in tarball URLs) |
| `KAPSEL_REGISTRY_NAME` | `kapsel-registry` | Registry name in health endpoint |
| `KAPSEL_DB_PATH` | `./data/registry.db` | SQLite database path |
| `KAPSEL_TARBALLS_DIR` | `./data/tarballs` | Tarball storage directory |

## API

All endpoints follow §12.1 of the Kapsel specification.

```
GET  /health
POST /auth/token
GET  /extensions/:scope/:name
GET  /extensions/:scope/:name/:version
GET  /extensions/:scope/:name/:version.tar.gz
PUT  /extensions/:scope/:name/:version
GET  /search?q=&type=&limit=&offset=
```

## Authentication

Publish requires a publisher token. Get one by exchanging a GitHub OAuth token:

```bash
curl -X POST https://registry.example.com/auth/token \
  -H 'Content-Type: application/json' \
  -d '{"githubToken": "ghp_...", "scope": "your-scope"}'

# Returns: { "token": "...", "scope": "your-scope", "expiresAt": ... }
```

Then publish:

```bash
export KAPSEL_TOKEN=your-token
kapsel publish --registry https://registry.example.com
```

## Storage

The reference implementation uses SQLite for metadata and the local filesystem for tarballs. For production, replace `src/db.ts` with a Postgres implementation and `src/routes/extensions.ts` tarball handling with S3 or equivalent.
