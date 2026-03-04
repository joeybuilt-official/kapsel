# Changelog

All notable changes to the Kapsel project.

Format: [Added / Changed / Fixed / Removed]. Entries link to commits where available.

---

## [Unreleased]

---

## [0.2.1] — March 2026

Addresses gaps and ambiguities surfaced during the Plexo host migration.

### Added

- **§3.2 / manifest types:** Optional `tools[]` field (`ManifestToolHint[]`) on `KapselManifest` for static tool discovery. Hosts MUST NOT use this as a substitute for activation-time registration — it is informational only, mirroring how npm `exports` works. Enables registries and marketplaces to surface tool names before install.
- **§3.2 / manifest types:** Optional `publishTopics[]` field on `KapselManifest`. Informational list of Event Bus topics the extension publishes to. Hosts MUST NOT use as a runtime allowlist. All entries must be within `ext.<scope>.*`.
- **§7.6:** New Storage section specifying key namespacing convention: `ext:<extensionName>:<workspaceId>:<key>`. Clarifies scope (per extension + workspace), recommended backend (Redis), and size limits (100 MB per §5.3).
- **§5.4:** Worker model table defining Ephemeral (Core) vs Persistent (Full required, Standard recommended). Clarifies that `sdk.storage` state is not available between calls in ephemeral model — extensions MUST use `sdk.storage` for persistence. Adds activation failure behavior: mark crashed, publish `extension.crashed`, surface user error, no auto-retry.
- **§11.4 / §12.1:** Specified the exact response shape when `minHostLevel` blocks installation: HTTP 400 with `COMPLIANCE_INSUFFICIENT` error code and `details: { required, actual }` fields.
- **§9.1:** Explicit activation failure contract cross-referencing §5.4. Clarifies that `activate()` failure marks the extension crashed and requires a user action to retry.

### Changed

- **§3.1 prose:** Clarified that dots are allowed in both scope and name segments (previously only mentioned in scope context). Regex `^@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$` unchanged.
- **§3.3 rule 5:** Clarified that the SDK `validateManifest()` function checks entry path as a non-empty string only. Hosts MUST additionally verify path existence within the package at install time. The CLI SHOULD verify against the local filesystem at build/validate time.
- **§7.4:** `extension.crashed` topic description updated to include activation failures (not only runtime crashes).
- **§9.3:** Updated hook execution guarantees to reference §9.1 and §5.4 for activation failure behavior.
- **§14.1–§14.3:** Compliance level requirements updated to reference worker model (§5.4), storage namespacing (§7.6), and structured install rejection (§11.4).
- **Spec version:** Bumped to 0.2.1-draft.

### Fixed

- **SDK `validateManifest()`:** Added JSDoc clarifying entry path validation scope (structure-only; path existence is the host/CLI's responsibility).
- **SDK `validateManifest()`:** Emits a `warning` (not error) when `events:publish` is declared but `publishTopics[]` is absent.
- **SDK `validateManifest()`:** Updated `name` field error message to explicitly mention dots are allowed in both segments.
- **SDK manifest types:** Added `ManifestToolHint` interface and `tools?: ManifestToolHint[]` to `KapselManifest`.
- **SDK manifest types:** Added `publishTopics?: string[]` to `KapselManifest`.

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
