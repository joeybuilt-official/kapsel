<div align="center">

# Kapsel

**The open standard for AI extension packaging, discovery, isolation, and execution.**

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Spec Version](https://img.shields.io/badge/spec-v0.2.0--draft-orange.svg)](./specification/kapsel-protocol.md)
[![Website](https://img.shields.io/badge/web-kapsel.sh-black.svg)](https://kapsel.sh)

[Specification](#specification) · [Why Kapsel](#why-kapsel) · [Quick Start](#quick-start) · [Architecture](#architecture) · [Contributing](#contributing)

</div>

---

Every AI platform invents its own plugin system from scratch. Extensions built for one platform are incompatible with every other. Developers rebuild the same integrations across platforms. Users are locked into ecosystems not because of quality, but because of format.

**Kapsel fixes this.**

Kapsel defines how any AI system — agents, copilots, assistants, autonomous workflows — discovers, installs, permissions-checks, isolates, and executes extensions safely. Build once, run on any Kapsel-compatible host.

---

## What Kapsel Standardizes

```
┌──────────────────────────────────────────────────────────────┐
│                      KAPSEL PROTOCOL                         │
│                                                              │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────────┐ │
│  │  Manifest   │  │ Capability │  │   Isolation Contract   │ │
│  │  (identity) │  │   Model    │  │   (security boundary)  │ │
│  │             │  │(permissions│  │                        │ │
│  │ kapsel.json │  │  per call) │  │  worker / container /  │ │
│  │             │  │            │  │  WASM sandbox          │ │
│  └────────────┘  └────────────┘  └────────────────────────┘ │
│                                                              │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────────┐ │
│  │  Message    │  │ Interaction│  │   Registry Protocol    │ │
│  │  Protocol   │  │   Model    │  │   (distribution)       │ │
│  │  (comms)    │  │  (how they │  │                        │ │
│  │             │  │   connect) │  │  publish / discover /  │ │
│  │             │  │            │  │  install               │ │
│  └────────────┘  └────────────┘  └────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

**What Kapsel does NOT standardize:** your AI model, your planning strategy, your database, your UI, or your business model. Those are yours.

---

## Why Kapsel

### The Problem

A developer builds a Stripe monitoring extension for Platform A. It registers tools, schedules cron jobs, renders a dashboard card. It works.

Now Platform B wants the same thing. The developer rewrites everything — different manifest format, different permission model, different lifecycle hooks, different packaging. Same logic, built twice.

Multiply this across every AI platform and every extension. The ecosystem fragments.

### The Solution

Kapsel standardizes the contract between extensions and hosts at six levels:

| Layer | What It Defines | Why It Matters |
|-------|----------------|----------------|
| **Manifest** | What the extension is and what it needs | Hosts know what they're installing |
| **Capabilities** | What the extension can access, checked per call | Security without trust |
| **Isolation** | How extensions are sandboxed | A bad extension can't crash the host |
| **Message Protocol** | How extensions talk to the host | Transport-agnostic, any language |
| **Interaction Model** | How extensions interact with each other | Agents use skill tools, channels route messages, events coordinate — all through the host |
| **Registry** | How extensions are distributed | Any org can run a registry |

### Relationship to MCP

MCP defines how an LLM calls a tool. Kapsel defines how that tool — and agents, channels, skills, and everything else — is packaged, permissioned, isolated, and managed as an installable extension.

**MCP is a wire protocol for tool calls. Kapsel is a runtime protocol for extensions.** They're complementary. A Kapsel extension can expose MCP-compatible tools.

---

## Extension Types

| Type | What It Does | Example |
|------|-------------|----------|
| **Agent** | Autonomous persona with its own planning loop | DevOps agent that monitors builds and deploys fixes |
| **Skill** | Bundle of tools + cron jobs + dashboard widgets | Stripe monitor with MRR tracking and alerts |
| **Channel** | Bidirectional messaging adapter | Telegram bot, Slack app, Discord bot |
| **Tool** | Single stateless function | Screenshot capture, PDF extraction, DNS lookup |
| **MCP Server** | Bridges an MCP server into the Kapsel runtime | postgres-mcp, browser-mcp |

---

## Quick Start

### 1. Define your extension

```json
{
  "kapsel": "0.2.0",
  "name": "@you/stripe-monitor",
  "version": "1.0.0",
  "type": "skill",
  "entry": "./dist/index.js",
  "capabilities": [
    "memory:read",
    "memory:write",
    "connections:stripe",
    "channel:send",
    "schedule:register",
    "ui:register-widget"
  ],
  "displayName": "Stripe Monitor",
  "description": "Tracks MRR, alerts on churn, reports daily revenue.",
  "author": "you",
  "license": "MIT"
}
```

### 2. Implement it

```typescript
import type { KapselSDK } from '@kapsel/sdk';

export async function activate(sdk: KapselSDK): Promise<void> {

  // Register a tool that agents can invoke
  sdk.registerTool({
    name: 'stripe_get_mrr',
    description: 'Gets current MRR from Stripe. Returns amount in cents and currency.',
    parameters: {
      type: 'object',
      properties: {
        currency: { type: 'string', default: 'usd' }
      }
    },
    handler: async (params, context) => {
      const creds = await sdk.connections.getCredentials('stripe');
      // ... fetch MRR from Stripe API
      return { mrr: 1054200, currency: 'usd' };
    }
  });

  // Register a cron job
  sdk.schedule.register({
    name: 'daily_mrr_report',
    schedule: '0 8 * * *',
    handler: async () => {
      const mrr = await sdk.tools.invoke('stripe_get_mrr', {});
      await sdk.channel.send({
        text: `Daily MRR: $${(mrr.mrr / 100).toFixed(2)}`,
        priority: 'normal'
      });
    }
  });

  // Register a dashboard widget
  sdk.ui.registerWidget({
    name: 'mrr_card',
    displayName: 'Monthly Recurring Revenue',
    displayType: 'metric',
    refreshInterval: 300,
    dataHandler: async () => {
      const mrr = await sdk.tools.invoke('stripe_get_mrr', {});
      return { value: mrr.mrr / 100, label: 'MRR', unit: '$', trend: '+4.2%' };
    }
  });
}
```

### 3. An agent uses it automatically

When a user asks "give me a revenue report," any Kapsel-compatible agent sees `stripe_get_mrr` in the Tool Registry and includes it in its plan. The host executes the tool in your extension's worker with your extension's credentials. The agent never touches Stripe directly.

---

## Architecture

### The Host as Mediator

Extensions never communicate directly. All interaction flows through five host systems:

```
┌─────────────────────────────────────────────────────────────────┐
│                         HOST RUNTIME                            │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │ Tool Registry │  │ Task Router  │  │   Channel Router      │ │
│  │              │  │              │  │                       │ │
│  │ All tools,   │  │ Routes tasks │  │ Picks which channel   │ │
│  │ all sources, │  │ to the right │  │ delivers each message │ │
│  │ one catalog  │  │ agent        │  │ based on priority,    │ │
│  │              │  │              │  │ health, preference    │ │
│  └──────────────┘  └──────────────┘  └───────────────────────┘ │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐                            │
│  │  Event Bus   │  │   Memory     │                            │
│  │              │  │   Layer      │                            │
│  │ Pub/sub for  │  │              │                            │
│  │ coordination │  │ Tagged shared│                            │
│  │ without      │  │ state for    │                            │
│  │ coupling     │  │ loose        │                            │
│  │              │  │ coupling     │                            │
│  └──────────────┘  └──────────────┘                            │
│                                                                 │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐       │
│  │Agent A │ │Agent B │ │Skill C │ │Channel │ │Tool E  │       │
│  │(worker)│ │(worker)│ │(worker)│ │D (wkr) │ │(worker)│       │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

### How a Request Flows

```
User: "Give me a revenue report"      (Telegram)
  │
  ▼
Channel extension receives message → routes to host
  │
  ▼
Task Router creates task → calls shouldActivate() on agents
  │
  ▼
Winning agent plans: [call stripe_get_mrr, call posthog_visitors, synthesize, send]
  │
  ▼
Host validates plan → checks Tool Registry → tools exist ✓
  │
  ▼
Host executes plan step by step:
  │
  ├─ Step 1: Invoke stripe_get_mrr → runs in Skill C's worker
  ├─ Step 2: Invoke posthog_visitors → runs in Skill D's worker
  ├─ Step 3: Agent synthesizes report
  └─ Step 4: Send via Channel Router → Telegram
  │
  ▼
Task complete → work ledger updated → event published
```

### Interaction Matrix

| From \ To | Agent | Skill | Channel | Tool | MCP Server | Memory | Events |
|---|---|---|---|---|---|---|---|
| **Agent** | Escalate | Invoke tools | Send messages | Invoke | Invoke tools | Read/Write | Sub/Pub |
| **Skill** | Create tasks | Invoke tools | Send messages | Invoke | Invoke tools | Read/Write | Sub/Pub |
| **Channel** | Route inbound | — | — | — | — | — | Subscribe |
| **Tool** | — | — | — | — | — | Read/Write | — |
| **MCP Server** | — | — | — | — | — | — | — |

**All paths go through the host. No direct extension-to-extension communication.**

---

## Specification

The full protocol specification is in [`specification/kapsel-protocol.md`](./specification/kapsel-protocol.md).

Key sections:

| Section | What It Covers |
|---------|----------------|
| §2 Extension Types | Agent, Skill, Channel, Tool, MCP Server |
| §3 Manifest Schema | `kapsel.json` — required and optional fields |
| §4 Capability Model | 18 standard tokens + host-specific extensions |
| §5 Isolation Contract | Process isolation, resource limits, crash containment |
| §6 Message Protocol | Request/response, events, transport-agnostic |
| §7 Interaction Model | Tool Registry, Task Router, Channel Router, Event Bus, Memory |
| §8 Agent Contract | Planning, routing, confidence scoring, multi-agent coordination |
| §12 Registry Protocol | HTTP API for publishing and discovering extensions |
| §14 Compliance Levels | Core → Standard → Full |

---

## Compliance Levels

Hosts declare their compliance level:

| Level | Requirements | What Users Get |
|-------|-------------|----------------|
| **Core** | Manifest parsing, capability checks, isolation, lifecycle hooks, ≥1 extension type | Basic extension support |
| **Standard** | All 5 types, all standard methods, Tool Registry, Task Router, Channel Router | Full multi-extension platform |
| **Full** | Event Bus, webhooks, agent planning contract, multi-agent routing, registry integration | Complete autonomous agent platform |

---

## Project Structure

```
kapsel-core/
├── specification/
│   └── kapsel-protocol.md       # The protocol spec (canonical)
├── packages/
│   ├── sdk/                     # @kapsel/sdk — TypeScript SDK (planned)
│   ├── sdk-mock/                # @kapsel/sdk-mock — test harness (planned)
│   ├── cli/                     # @kapsel/cli — scaffold/build/publish (planned)
│   └── registry/                # @kapsel/registry — reference server (planned)
├── examples/
│   ├── skill-stripe-monitor/    # Example skill extension (planned)
│   ├── agent-devops/            # Example agent extension (planned)
│   └── channel-telegram/        # Example channel extension (planned)
├── CONTRIBUTING.md
├── LICENSE                      # Apache 2.0
└── README.md
```

---

## Roadmap

| Phase | Status | Milestone |
|-------|--------|-----------|
| Protocol spec v0.2.0 | ✅ Draft | Core interaction model defined |
| Reference host (Plexo) | 🔨 Building | First Level 3 implementation |
| @kapsel/sdk | Planned | TypeScript SDK for extension developers |
| @kapsel/sdk-mock | Planned | Local testing without a running host |
| @kapsel/cli | Planned | Scaffold, build, publish workflow |
| @kapsel/registry | Planned | Reference registry server |
| Second host implementation | Planned | Required for spec v1.0 |
| Spec v1.0 | Planned | Stable after 2+ hosts, 50+ extensions, public comment |

---

## Contributing

Kapsel is in early draft. This is the best time to shape it.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

**Ways to contribute:**
- Review the spec and open issues for ambiguities or gaps
- Propose changes via pull request against the specification
- Build a host implementation (any compliance level)
- Build extensions and report friction points
- Join the discussion in GitHub Issues

---

## Origin

Kapsel was created by the [Plexo](https://plexo.dev) project — a self-hosted AI agentic platform. It was extracted as an independent standard because the extension contract is useful far beyond any single platform.

The spec is maintained independently. Plexo is the first Level 3 host implementation.

---

## License

Apache 2.0 — see [LICENSE](./LICENSE).

The specification, SDK, CLI, and all reference implementations are Apache 2.0. No restrictions on commercial use, modification, or distribution. Patent grant included.

---

<div align="center">

**[Read the Spec](./specification/kapsel-protocol.md)** · **[kapsel.sh](https://kapsel.sh)** · **[GitHub](https://github.com/Kapsel-Protocol/kapsel-core)**

</div>
