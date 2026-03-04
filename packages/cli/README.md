# @kapsel/cli

CLI for scaffolding, building, validating, and publishing [Kapsel](https://kapsel.sh) extensions.

## Installation

```bash
npm install -g @kapsel/cli
# or per-project
pnpm add -D @kapsel/cli
```

## Commands

### `kapsel init`

Scaffold a new extension interactively.

```bash
kapsel init
kapsel init my-extension-dir
```

Prompts for: scope, name, type (skill/agent/channel/tool), description, author. Generates `kapsel.json`, `package.json`, `tsconfig.json`, and a `src/index.ts` entry point from the template.

---

### `kapsel validate`

Validate `kapsel.json` without building.

```bash
kapsel validate
kapsel validate ./path/to/extension
```

Checks: required fields, name format, semver versions, known capability tokens, description length.

---

### `kapsel build`

Compile TypeScript and validate manifest.

```bash
kapsel build
kapsel build ./path/to/extension
kapsel build --no-validate  # skip manifest validation
```

Runs `tsc` and verifies the compiled entry point exists at the path declared in `kapsel.json`.

---

### `kapsel publish`

Pack and publish to a registry.

```bash
kapsel publish
kapsel publish --registry https://my-registry.example.com
kapsel publish --dry-run  # pack without publishing
```

**Authentication:** Provide a publisher token via `--token` or the `KAPSEL_TOKEN` environment variable.

```bash
export KAPSEL_TOKEN=your-token
kapsel publish
```

## See Also

- [@kapsel/sdk](../sdk) — TypeScript types and interfaces
- [@kapsel/sdk-mock](../sdk-mock) — test extensions locally
- [Specification](../../specification/kapsel-protocol.md) — full protocol spec
