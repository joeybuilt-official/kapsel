# @kapsel/cli

CLI for scaffolding, building, validating, and publishing [Kapsel](https://kapsel.sh) extensions.

## Installation

```bash
pnpm add -g @kapsel/cli
# or use without installing:
npx @kapsel/cli init
```

## Commands

### `kapsel init`

Scaffold a new extension interactively.

```bash
kapsel init
# or with flags to skip prompts:
kapsel init --type skill --name @acme/stripe-monitor
```

Creates:
```
stripe-monitor/
├── kapsel.json
├── package.json
├── tsconfig.json
├── src/index.ts
├── README.md
└── .gitignore
```

### `kapsel build`

Validate manifest + compile TypeScript.

```bash
kapsel build
kapsel build --no-validate  # skip manifest check
```

### `kapsel validate`

Validate `kapsel.json` without building.

```bash
kapsel validate
kapsel validate ./path/to/kapsel.json
```

### `kapsel publish`

Pack and publish to a registry.

```bash
export KAPSEL_TOKEN=your-token
kapsel publish
kapsel publish --registry https://my-registry.example.com
kapsel publish --dry-run  # pack + validate, don't push
```

## Extension Types

| Type | Generated scaffold includes |
|------|----------------------------|
| `skill` | Tool, schedule, widget |
| `agent` | shouldActivate, plan, executeStep |
| `channel` | receive, send, health |
| `tool` | Single tool handler |
| `mcp-server` | MCP bridge activate |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `KAPSEL_TOKEN` | Publisher token for `kapsel publish` |
