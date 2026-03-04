# Changelog

All notable changes to the Kapsel project.

Format: [Added / Changed / Fixed / Removed]. Entries link to commits where available.

---

## [Unreleased]

---

## [0.2.0] — March 2026

### Added

- `specification/kapsel-protocol.md` — Full 15-section protocol specification (v0.2.0-draft). Covers extension types, manifest schema, capability model, isolation contract, message protocol, interaction model, agent contract, lifecycle hooks, error handling, versioning, registry protocol, security requirements, and compliance levels. Includes appendices A (SDK interface), B (interaction matrix), C (extension type quick reference).
- `packages/sdk` — `@kapsel/sdk` v0.2.0. Complete TypeScript type definitions for the Kapsel protocol: `KapselSDK` interface, manifest types, message protocol types, task types, agent contract types, channel extension interface, event topic constants and helpers, manifest validation utility.
- `packages/sdk-mock` — `@kapsel/sdk-mock` v0.2.0. In-memory mock host implementing `KapselSDK`. Includes `createMockSdk()`, test helpers (`triggerSchedule`, `invokeTool`, `getWidgetData`, `emitEvent`, `getSentMessages`, `getPublishedEvents`, `resetState`), and comprehensive test suite.
- `packages/cli` — `@kapsel/cli` v0.2.0. `kapsel init` (interactive scaffolder with skill/agent/channel/tool templates), `kapsel build` (tsc + entry verification), `kapsel validate` (manifest-only validation), `kapsel publish` (pack + PUT to registry).
- `packages/registry` — `@kapsel/registry` v0.2.0. Reference registry server (Express + SQLite). Endpoints: `GET /health`, `POST /auth/token`, `PUT /extensions/:scope/:name/:version`, `GET /extensions/:scope/:name`, `GET /extensions/:scope/:name/:version`, `GET /extensions/:scope/:name/:version.tar.gz`, `GET /search`. GitHub OAuth token exchange for publisher JWTs.
- `examples/skill-stripe-monitor` — Example skill extension. Demonstrates tool registration, cron scheduling, dashboard widget, credential access, storage, memory, and channel messaging. Includes vitest test suite using `@kapsel/sdk-mock`.
- `examples/agent-devops` — Example agent extension. Demonstrates `shouldActivate`, `plan` with one-way door declarations, `executeStep` with conditional tool invocation, `onEscalation`, and event subscriptions.
- `examples/channel-telegram` — Example channel extension. Demonstrates `receive`/`send`/`health` contract, pairing flow via `onPairingRequest`, config-driven setup, and `onConfigUpdate` for hot reload.
- Monorepo scaffold: `pnpm-workspace.yaml`, root `package.json`, `tsconfig.base.json`.

---

## [0.1.0] — February 2026

### Added

- Initial repository structure.
- `README.md` with protocol overview, architecture diagrams, and roadmap.
- `CONTRIBUTING.md` with spec change process and versioning policy.
- `LICENSE` — Apache 2.0.
- Empty `specification/kapsel-protocol.md` placeholder.
