# Kapsel — Development Guide

For contributors and host implementors.

## Prerequisites

- Node.js >= 20
- pnpm >= 9 (`npm install -g pnpm`)

## Getting Started

```bash
git clone https://github.com/Kapsel-Protocol/kapsel-core
cd kapsel-core
pnpm install
pnpm build
```

## Project Structure

```
kapsel-core/
├── specification/       # Protocol spec (canonical source of truth)
├── packages/
│   ├── sdk/             # @kapsel/sdk — types and interfaces
│   ├── sdk-mock/        # @kapsel/sdk-mock — in-memory test harness
│   ├── cli/             # @kapsel/cli — developer CLI
│   └── registry/        # @kapsel/registry — reference registry server
└── examples/            # Working example extensions
```

## Common Commands

```bash
# Build all packages
pnpm build

# Type-check all packages
pnpm typecheck

# Run all tests
pnpm test

# Build a single package
pnpm --filter @kapsel/sdk build

# Test a single package
pnpm --filter @kapsel/sdk-mock test
```

## Running the Registry Locally

```bash
cd packages/registry
cp .env.example .env
# Edit .env — set KAPSEL_JWT_SECRET at minimum
pnpm build
node dist/index.js
# Registry running at http://localhost:3000
# Health check: curl http://localhost:3000/health
```

## Running the Registry with Docker

```bash
cd packages/registry
docker build -t kapsel-registry .
docker run -p 3000:3000 \
  -e KAPSEL_JWT_SECRET=your-secret \
  -e KAPSEL_REGISTRY_URL=http://localhost:3000 \
  -v kapsel-data:/data \
  kapsel-registry
```

## Using the CLI Against a Local Registry

```bash
# Get a publisher token (requires a valid GitHub token)
curl -X POST http://localhost:3000/auth/token \
  -H 'Content-Type: application/json' \
  -d '{"githubToken": "ghp_...", "scope": "your-scope"}'

# Publish
export KAPSEL_TOKEN=<token-from-above>
kapsel publish --registry http://localhost:3000
```

## Building Extensions

```bash
# Scaffold
kapsel init my-extension
cd my-extension
pnpm install

# Develop
pnpm build
pnpm test

# Validate manifest
kapsel validate

# Publish
kapsel publish
```

## Implementing a Host

A Kapsel host must implement the `KapselSDK` interface and the message protocol from `@kapsel/sdk`.

Start with Core compliance (one extension type), then expand. Use `@kapsel/sdk-mock` as a reference implementation — it shows the expected behavior for every SDK method.

See `specification/kapsel-protocol.md §14` for compliance requirements.

## Spec Changes

1. Open an issue describing the problem.
2. Discuss until rough consensus.
3. Submit a PR against `specification/kapsel-protocol.md`.
4. One maintainer review required.

See `CONTRIBUTING.md` for full process.
