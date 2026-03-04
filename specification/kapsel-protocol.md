# Kapsel Protocol Specification

**Version:** 0.2.0-draft  
**Status:** Draft  
**Date:** March 2026  
**Repository:** https://github.com/Kapsel-Protocol/kapsel-core

---

## Table of Contents

- [§1 Introduction](#1-introduction)
- [§2 Extension Types](#2-extension-types)
- [§3 Manifest Schema](#3-manifest-schema)
- [§4 Capability Model](#4-capability-model)
- [§5 Isolation Contract](#5-isolation-contract)
- [§6 Message Protocol](#6-message-protocol)
- [§7 Interaction Model](#7-interaction-model)
- [§8 Agent Contract](#8-agent-contract)
- [§9 Lifecycle Hooks](#9-lifecycle-hooks)
- [§10 Error Handling](#10-error-handling)
- [§11 Versioning and Compatibility](#11-versioning-and-compatibility)
- [§12 Registry Protocol](#12-registry-protocol)
- [§13 Security Requirements](#13-security-requirements)
- [§14 Compliance Levels](#14-compliance-levels)
- [§15 Normative Language](#15-normative-language)

---

## §1 Introduction

### §1.1 Purpose

Kapsel is an open standard for AI extension packaging, discovery, isolation, and execution. It defines the contract between **extensions** (installable units of capability) and **hosts** (platforms that run them).

Every AI platform that builds its own plugin system creates a walled garden. Extensions built for one platform cannot run on another. Developers rebuild the same integrations repeatedly. Kapsel fixes this by standardizing the six-layer contract that all AI extension systems need but currently implement incompatibly.

### §1.2 Scope

This specification defines:

- What an extension **is** (types, manifest, capabilities)
- How extensions are **isolated** from hosts and each other
- How extensions **communicate** with hosts (message protocol)
- How extensions **interact** through hosts (interaction model)
- How **agents** plan, route, and coordinate (agent contract)
- How extensions are **distributed** (registry protocol)
- What hosts must implement at each **compliance level**

This specification does NOT define:

- AI model selection or prompt strategy
- Database schema or storage implementation
- UI framework or rendering
- Business model or pricing
- Internal host architecture beyond the contract surface

### §1.3 Relationship to Other Standards

**MCP (Model Context Protocol):** MCP defines how an LLM calls a tool over a wire protocol. Kapsel defines how that tool — and every other extension type — is packaged, permissioned, isolated, and managed as an installable unit. They are complementary. A Kapsel extension MAY expose MCP-compatible tools. A Kapsel host MAY bridge MCP servers as extensions via the `mcp-server` extension type.

**npm/package registries:** The Kapsel registry protocol is modeled on npm's HTTP API for familiarity. Kapsel packages are not npm packages, but the publishing and discovery patterns are intentionally similar.

**OpenAPI:** Extension tool schemas use JSON Schema for parameter definitions. A Kapsel extension's tools can be described as an OpenAPI path group, but this is not required.

### §1.4 Terminology

See §15 for normative language. Key terms used throughout:

- **Extension:** An installable unit that adds capability to a host.
- **Host:** A platform that implements the Kapsel protocol and runs extensions.
- **Manifest:** The `kapsel.json` file that describes an extension.
- **Capability token:** A string that grants an extension access to a host resource.
- **Worker:** The isolated process or thread in which an extension runs.
- **Tool Registry:** The host-maintained catalog of all callable tools.
- **Task Router:** The host system that routes incoming tasks to agents.
- **Channel Router:** The host system that routes outbound messages to channels.
- **Event Bus:** The host-managed pub/sub system for loosely coupled coordination.

---

## §2 Extension Types

Kapsel defines five extension types. Each type has a distinct role. A single extension package MUST declare exactly one type.

### §2.1 Agent

An Agent is an autonomous extension with its own planning loop. Agents receive tasks, reason about them, invoke tools, and produce outcomes. Agents do not communicate directly with other agents — all coordination happens through the host.

**Characteristics:**
- Declares a `shouldActivate(task)` function the host calls to route tasks
- Implements a `plan(task)` function that returns an ordered list of steps
- Executes steps by invoking tools through the host's Tool Registry
- MAY spawn sub-tasks via the host's Task Router
- Maintains a confidence score that the host uses for routing decisions

**Example use cases:** DevOps agent that monitors builds and deploys fixes, research agent that sources and synthesizes information, coding agent that implements features from Linear tickets.

### §2.2 Skill

A Skill is a bundle of related capabilities: tools, cron jobs, and optional dashboard widgets. Skills are not autonomous — they are invoked by agents or users, not by their own initiative. A skill provides the "hands" that agents use to interact with external services.

**Characteristics:**
- Registers one or more tools into the host's Tool Registry
- MAY register cron jobs that run on a schedule
- MAY register dashboard widgets the host UI renders
- Executes within a single worker with its declared capabilities
- Does not have a planning loop

**Example use cases:** Stripe monitor with MRR tracking, GitHub integration that creates PRs and reads issues, PostHog analytics reader.

### §2.3 Channel

A Channel is a bidirectional messaging adapter. It receives inbound messages from an external service, routes them to the host, and delivers outbound messages from the host to that service.

**Characteristics:**
- Implements `receive(message)` — called by the host when an inbound webhook or poll returns a message
- Implements `send(message)` — called by the host's Channel Router to deliver outbound messages
- Implements `health()` — returns whether the channel connection is active
- Handles authentication and session management for its service
- MAY support multiple concurrent users or workspaces

**Example use cases:** Telegram bot, Slack app, Discord bot, email adapter, SMS gateway.

### §2.4 Tool

A Tool is a single stateless function. It takes parameters, executes, and returns a result. Tools are the atomic unit of capability — skills are composed of tools.

**Characteristics:**
- Declares a single `handler(params, context)` function
- Defines its parameter schema in JSON Schema
- Is stateless — no persistent state between calls
- MUST complete within the host's configured tool timeout
- Registered into the Tool Registry on activation

**Example use cases:** Screenshot capture, PDF text extraction, DNS lookup, currency conversion, URL fetcher.

### §2.5 MCP Server

An MCP Server extension bridges an existing MCP-compatible server into the Kapsel runtime. The host treats the bridged MCP server's tools as Kapsel tools, making them available in the Tool Registry.

**Characteristics:**
- Declares the MCP server URL and transport type (stdio or SSE)
- The host proxies tool calls from the Tool Registry to the MCP server
- The MCP server runs in its own process; the extension manages its lifecycle
- Capability checks still apply — the host enforces Kapsel capabilities even for MCP tool calls

**Example use cases:** postgres-mcp (database access), browser-mcp (browser automation), filesystem-mcp (local file access).

---

## §3 Manifest Schema

Every extension MUST include a `kapsel.json` file at its package root. This file is the canonical source of truth for the extension's identity, requirements, and behavior declarations.

### §3.1 Required Fields

```typescript
interface KapselManifest {
  // Protocol version this extension targets. MUST be a valid semver string.
  kapsel: string;

  // Scoped package name. MUST follow @scope/name format.
  // Allowed characters: lowercase alphanumeric, hyphens, and dots.
  name: string;

  // Extension version. MUST be a valid semver string.
  version: string;

  // Extension type. MUST be one of: "agent" | "skill" | "channel" | "tool" | "mcp-server"
  type: ExtensionType;

  // Relative path to the extension entry point from the package root.
  entry: string;

  // Capability tokens this extension requires.
  // The host MUST reject installation if it cannot grant all declared capabilities.
  capabilities: CapabilityToken[];

  // Human-readable name shown in host UI and registry. Max 50 characters.
  displayName: string;

  // Short description (max 280 characters).
  description: string;

  // Publisher name or organization.
  author: string;

  // SPDX license identifier.
  license: string;
}
```

### §3.2 Optional Fields

```typescript
interface KapselManifestOptional {
  // Minimum host compliance level required. Defaults to "core".
  minHostLevel?: "core" | "standard" | "full";

  // Minimum Kapsel spec version required.
  minKapselVersion?: string;

  // Homepage URL.
  homepage?: string;

  // Source repository URL.
  repository?: string;

  // Keywords for registry discovery. Max 10. Each max 50 characters.
  keywords?: string[];

  // Extension icon URL. MUST be HTTPS. Recommended: 256x256 PNG.
  icon?: string;

  // Screenshot URLs shown in registry listing. Max 5. MUST be HTTPS.
  screenshots?: string[];

  // For "mcp-server" type only.
  mcpServer?: MCPServerConfig;

  // For "agent" type only: routing hints.
  agentHints?: AgentHints;

  // For "channel" type only: rendered as a setup form by the host.
  channelConfig?: JSONSchema;

  // For "skill" type only: rendered as a settings form by the host.
  skillConfig?: JSONSchema;

  // Resource hints. Host MAY enforce stricter limits.
  resourceHints?: ResourceHints;

  // Informational only — hosts MUST NOT enforce peer deps.
  peerExtensions?: string[];
}

interface MCPServerConfig {
  transport: "stdio" | "sse";
  command?: string; // For stdio
  url?: string;     // For SSE
}

interface AgentHints {
  taskTypes?: string[];
  minConfidence?: number;
}

interface ResourceHints {
  maxMemoryMB?: number;
  maxCpuShares?: number;
  maxInvocationMs?: number;
}
```

### §3.3 Manifest Validation

Hosts MUST validate manifests on installation. Validation failures MUST prevent installation and return a structured error.

Required validations:
1. `kapsel` is a valid semver string supported by this host
2. `name` matches `^@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$`
3. `version` is a valid semver string
4. `type` is one of the five defined types
5. `entry` path exists within the package
6. All `capabilities` tokens are recognized (unknown tokens are rejected; host-scoped tokens emit a warning — see §4.3)
7. `displayName` is ≤ 50 characters
8. `description` is ≤ 280 characters
9. `license` is a valid SPDX expression

### §3.4 Complete Example

```json
{
  "kapsel": "0.2.0",
  "name": "@acme/stripe-monitor",
  "version": "1.2.0",
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
  "description": "Tracks MRR, churn, and new customers. Sends daily revenue reports and alerts on significant changes.",
  "author": "acme",
  "license": "MIT",
  "homepage": "https://acme.dev/stripe-monitor",
  "repository": "https://github.com/acme/stripe-monitor",
  "keywords": ["stripe", "revenue", "mrr", "monitoring"],
  "minHostLevel": "standard",
  "skillConfig": {
    "type": "object",
    "properties": {
      "alertThreshold": {
        "type": "number",
        "description": "Alert when MRR changes by more than this percentage",
        "default": 10
      },
      "reportTime": {
        "type": "string",
        "description": "Cron expression for daily report",
        "default": "0 8 * * *"
      }
    }
  },
  "resourceHints": {
    "maxMemoryMB": 128,
    "maxInvocationMs": 30000
  }
}
```

---

## §4 Capability Model

Capabilities are the permission system for Kapsel extensions. An extension can only access host resources it has declared in its manifest's `capabilities` array. The host checks capabilities at every SDK call — declaration alone does not grant access.

### §4.1 Principles

1. **Declared at install time.** An extension cannot acquire new capabilities at runtime.
2. **Checked at call time.** The host MUST verify the calling extension holds the required capability on every SDK method that requires one.
3. **Scoped, not global.** Extensions MUST NOT declare capabilities they do not use.
4. **User-visible.** The host UI MUST display declared capabilities to the user before installation.

### §4.2 Standard Capability Tokens

The following 18 tokens are standard. Hosts at Standard or Full compliance MUST support all of them.

#### Memory

| Token | Grants Access To |
|-------|-----------------|
| `memory:read` | Read entries from the shared memory store (workspace-scoped) |
| `memory:write` | Write and update entries in the memory store |
| `memory:delete` | Delete entries from memory |

#### Connections

| Token | Grants Access To |
|-------|-----------------|
| `connections:<service>` | Credentials for the named service (e.g. `connections:stripe`). Wildcard `connections:*` is NOT allowed. |

#### Channels

| Token | Grants Access To |
|-------|-----------------|
| `channel:send` | Send messages via the Channel Router (router selects channel) |
| `channel:send-direct` | Send to a specific channel by ID (requires user configuration) |
| `channel:receive` | Register as an inbound channel (channel type only) |

#### Schedule

| Token | Grants Access To |
|-------|-----------------|
| `schedule:register` | Register recurring cron jobs |
| `schedule:manage` | Cancel and modify own cron jobs |

#### UI

| Token | Grants Access To |
|-------|-----------------|
| `ui:register-widget` | Register dashboard widgets |
| `ui:notify` | Send in-app notifications |

#### Tasks

| Token | Grants Access To |
|-------|-----------------|
| `tasks:create` | Create new tasks in the Task Router (agent type only) |
| `tasks:read` | Read own task status and metadata |
| `tasks:read-all` | Read all tasks in the workspace (requires explicit user grant) |

#### Events

| Token | Grants Access To |
|-------|-----------------|
| `events:subscribe` | Subscribe to Event Bus topics |
| `events:publish` | Publish events to the `ext.<scope>.*` namespace only (see §7.4) |

#### Storage

| Token | Grants Access To |
|-------|-----------------|
| `storage:read` | Read from extension-private key-value storage |
| `storage:write` | Write to extension-private key-value storage |

### §4.3 Host-Specific Capability Extensions

Hosts MAY define additional tokens namespaced as `host:<hostname>:<capability>`. Extensions using host-specific capabilities are not portable — this is acceptable and intentional.

Host-scoped tokens are not validated by the Kapsel manifest validator or registry — only the target host can determine whether they are supported and will be granted. Validators MUST treat host-scoped tokens as syntactically valid but MUST emit a warning that host-side verification is required before the extension can be installed.

Hosts MUST reject installation of extensions that declare unrecognized capability tokens, including unrecognized host-scoped tokens.

---

## §5 Isolation Contract

Isolation ensures a misbehaving extension cannot crash the host, corrupt other extensions' state, or access resources it was not granted.

### §5.1 Isolation Requirements

Every extension MUST run in an isolated worker. The isolation boundary MUST enforce:

1. **Memory isolation.** Extension memory is not directly accessible to the host process or other extensions.
2. **Crash containment.** An unhandled exception or OOM in an extension MUST NOT crash the host.
3. **Capability enforcement.** Extensions cannot escalate privileges by any means.
4. **No direct I/O.** Extensions MUST NOT have direct access to the host's database, Redis, filesystem, or network sockets. All I/O goes through the SDK.

### §5.2 Isolation Mechanisms

Hosts MUST implement isolation using one of:

| Mechanism | Notes |
|-----------|-------|
| Worker threads (`worker_threads`) | Minimum. Suitable for trusted or reviewed extensions. |
| Child process | Recommended for most hosts. |
| Docker container | Required for Full compliance when running untrusted extensions. |
| WebAssembly sandbox | Recommended for browser-based hosts. |

### §5.3 Resource Limits

Hosts MUST enforce these minimum limits per worker:

| Resource | Minimum Limit |
|----------|--------------|
| Memory | 256 MB |
| Wall clock per tool invocation | 60 seconds |
| Wall clock per agent execution | 2 hours |
| Concurrent tool calls per extension | 10 |
| Extension-private storage | 100 MB |

### §5.4 Worker Lifecycle

1. **Spawn** — Host spawns worker on extension activation.
2. **Warm** — `activate(sdk)` is called. Extension registers tools, schedules, widgets.
3. **Ready** — Worker is available.
4. **Invoke** — Host sends request; worker processes and responds.
5. **Idle** — Worker waits. Host MAY suspend to reclaim resources.
6. **Crash** — Unhandled error. If crash count ≤ 3 in 5 minutes: restart. If > 3: disable extension and notify user.
7. **Shutdown** — `deactivate()` called, worker terminates.

### §5.5 Security Constraints

- Extensions MUST NOT be able to forge messages that appear to come from the host.
- The message channel MUST be authenticated at the transport level (shared secret passed only at spawn time).
- Extensions MUST NOT have access to the host process's environment variables.
- Extension code MUST be treated as untrusted by default.

---

## §6 Message Protocol

The message protocol defines how hosts and extensions communicate across the isolation boundary. It is transport-agnostic.

### §6.1 Message Envelope

```typescript
interface KapselMessage {
  // UUID v4.
  id: string;
  type: MessageType;
  timestamp: number; // Unix ms
  payload: unknown;
  // Set on responses; omitted on unsolicited messages.
  correlationId?: string;
  error?: KapselError;
}

interface KapselError {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
}
```

### §6.2 Message Types

#### Host → Extension

| Type | Payload | Description |
|------|---------|-------------|
| `invoke.tool` | `{ toolName, params, context }` | Call a tool registered by this extension |
| `invoke.agent.shouldActivate` | `{ task: TaskSummary }` | Ask agent if it should handle this task |
| `invoke.agent.plan` | `{ task: Task }` | Ask agent to produce an execution plan |
| `invoke.agent.execute` | `{ task, plan, stepIndex }` | Execute a specific plan step |
| `invoke.channel.receive` | `{ message: InboundMessage }` | Deliver inbound message to a channel extension |
| `invoke.channel.send` | `{ message: OutboundMessage }` | Ask channel to deliver an outbound message |
| `invoke.channel.health` | `{}` | Ask channel for health status |
| `invoke.widget.data` | `{ widgetName, config }` | Fetch data for a dashboard widget |
| `invoke.schedule` | `{ jobName }` | Trigger a scheduled job |
| `lifecycle.activate` | `{ config, context: WorkerContext }` | Initialize the extension |
| `lifecycle.deactivate` | `{ reason }` | Shut down the extension |
| `lifecycle.configUpdate` | `{ config }` | Configuration was updated |

#### Extension → Host (SDK calls)

| Type | Payload |
|------|---------|
| `sdk.memory.read` | `{ query, tags?, limit? }` |
| `sdk.memory.write` | `{ content, tags?, metadata?, ttl? }` |
| `sdk.memory.delete` | `{ id }` |
| `sdk.connections.getCredentials` | `{ service }` |
| `sdk.channel.send` | `{ text, priority?, attachments? }` |
| `sdk.tasks.create` | `{ title, type, context? }` |
| `sdk.tasks.read` | `{ taskId }` |
| `sdk.events.subscribe` | `{ topic }` |
| `sdk.events.publish` | `{ topic, payload }` |
| `sdk.events.unsubscribe` | `{ topic }` |
| `sdk.storage.get` | `{ key }` |
| `sdk.storage.set` | `{ key, value, ttl? }` |
| `sdk.storage.delete` | `{ key }` |
| `sdk.tools.invoke` | `{ toolName, params }` |
| `sdk.ui.notify` | `{ title, body, level? }` |

#### Host → Extension (Unsolicited)

| Type | Payload |
|------|---------|
| `event.published` | `{ topic, payload, publisherId }` |

### §6.3 Request/Response Semantics

- Every request MUST receive exactly one response.
- Responses MUST set `correlationId` to the request's `id`.
- If a request cannot be processed, the responding party MUST return an error response rather than dropping the message.
- Hosts MUST enforce response timeouts: 60 seconds for tools (default), configurable for agents. Non-response counts toward the crash threshold.

### §6.4 Error Codes

```typescript
type ErrorCode =
  | "CAPABILITY_DENIED"
  | "TOOL_NOT_FOUND"
  | "INVALID_PARAMS"
  | "TIMEOUT"
  | "RATE_LIMITED"
  | "CONNECTION_UNAVAILABLE"
  | "WORKER_CRASHED"
  | "NOT_IMPLEMENTED"
  | "INTERNAL_ERROR"
  | "MANIFEST_INVALID"
  | "VERSION_INCOMPATIBLE"
  | "EXTENSION_DISABLED"
  | "COMPLIANCE_INSUFFICIENT"
```

### §6.5 Shared Payload Types

```typescript
interface InvokeContext {
  workspaceId: string;
  taskId?: string;
  requestId: string;
}

interface WorkerContext {
  workspaceId: string;
  extensionName: string;
  extensionVersion: string;
  hostVersion: string;
  config: unknown;
}

interface TaskSummary {
  id: string;
  title: string;
  type: string;
  context?: unknown;
}

interface InboundMessage {
  id: string;
  text: string;
  senderId: string;
  channelId: string;
  timestamp: number;
  attachments?: Attachment[];
  raw?: unknown;
}

interface OutboundMessage {
  text: string;
  priority: "low" | "normal" | "high" | "critical";
  attachments?: Attachment[];
  replyToId?: string;
}

interface Attachment {
  type: "image" | "file" | "code" | "markdown";
  url?: string;
  content?: string;
  filename?: string;
  mimeType?: string;
}
```

---

## §7 Interaction Model

No extension communicates directly with another extension. All interaction flows through five host-managed systems. This design ensures security (capability checks on every call), reliability (host can restart failed workers without losing messages), and composability (independently written extensions work together without coordination).

### §7.1 Tool Registry

The Tool Registry is a host-maintained catalog of all callable tools from all active extensions.

**Registration:** When an extension's `activate()` calls `sdk.registerTool(...)`, the host adds the tool. When the extension is deactivated, all its tools are removed.

**Name collision:** If two extensions register tools with the same name, the host MUST keep both, disambiguating by prefixing with the extension scope (`@scope/name:toolname`), and log a warning.

**Invocation by agents:** Host looks up tool, validates caller capability, routes to owning extension's worker, returns result. The agent never touches the extension directly.

**Invocation by extensions:** Via `sdk.tools.invoke(toolName, params)`. Host enforces capability and routes transparently.

**Tool registration schema:**

```typescript
interface ToolRegistration {
  name: string;           // Alphanumeric + underscores. Unique within extension.
  description: string;    // Max 500 characters. Shown to agents.
  parameters: JSONSchema; // Must be type "object" at top level.
  hints?: {
    estimatedMs?: number;
    /**
     * Hard abort ceiling for this specific tool, in milliseconds.
     * When set, the host MUST abort the invocation and return TIMEOUT
     * if execution exceeds this value, overriding the host default timeout.
     */
    timeoutMs?: number;
    hasSideEffects?: boolean;
    idempotent?: boolean;
  };
  handler: (params: unknown, context: InvokeContext) => Promise<unknown>;
}
```

### §7.2 Task Router

The Task Router receives incoming work and routes it to the appropriate agent.

**Routing algorithm:**
1. Task is created (from inbound message, cron trigger, user action, or sub-task).
2. Host calls `shouldActivate(taskSummary)` on all active agent extensions concurrently (5-second timeout).
3. Each agent returns `{ activate: boolean, confidence: number }`.
4. Host selects the agent with the highest confidence among those that returned `activate: true`.
5. If no agent activates: task is queued for manual review.
6. Tie-breaking: host uses the agent whose `agentHints.taskTypes` most closely matches the task type.

**Task states:**

```
QUEUED → ROUTED → PLANNING → CONFIRMED → EXECUTING → VERIFYING → COMPLETE
                                                    ↘               ↘
                                                  BLOCKED         ESCALATED
```

**Task schema:**

```typescript
interface Task {
  id: string;
  title: string;
  type: string;
  status: TaskStatus;
  assignedAgentId?: string;
  plan?: Plan;
  steps: TaskStep[];
  context?: unknown;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  qualityScore?: number;
}

interface TaskStep {
  index: number;
  description: string;
  toolCalls: ToolCall[];
  status: "pending" | "executing" | "complete" | "failed";
  verificationResult?: VerificationResult;
  startedAt?: number;
  completedAt?: number;
}
```

### §7.3 Channel Router

The Channel Router manages outbound message delivery across all active channel extensions.

**Routing policy:** When `sdk.channel.send(message)` is called, the router selects delivery based on:
1. User's configured primary channel preference.
2. Channel health (unhealthy channels are skipped).
3. Priority: `critical` messages attempt all healthy channels; others use the primary.

**Inbound routing:** When a channel receives an inbound message, it calls the host's `channel.receive()` method. The host identifies the workspace from pairing configuration, creates a task, and routes it through the Task Router.

**Pairing:** Channels that support DMs MUST implement a pairing flow. An unknown sender triggers a pairing request. The host generates a pairing code. When confirmed, the sender is associated with a workspace.

### §7.4 Event Bus

The Event Bus provides loosely coupled pub/sub coordination between extensions.

#### Topic Namespaces

Topics are divided into two namespaces with strictly different access rules:

**Host namespace** — topics owned and published exclusively by the host runtime. Extensions MUST subscribe to host topics read-only. Extensions MUST NOT publish to any host-owned topic.

Host topic prefixes (exhaustive): `task.`, `sprint.`, `channel.`, `connection.`, `agent.`, `extension.`, `memory.`, `system.`

Hosts MUST enforce this at the message protocol level: `sdk.events.publish` called with a topic matching any host prefix MUST be rejected with `CAPABILITY_DENIED`, regardless of the extension's declared capabilities.

**Extension namespace** — topics owned by extensions. Format: `ext.<scope>.<name>.<event>`.

Examples:
- `ext.acme.stripe-monitor.mrr-alert`
- `ext.myorg.github-ops.pr-merged`

Extensions MUST only publish to topics within their own `ext.<scope>.*` namespace. An extension from `@acme/stripe-monitor` MUST NOT publish to `ext.otherscope.*` topics. Hosts MUST enforce this scope check at call time.

#### Standard Host Topics

| Topic | Published When | Payload |
|-------|---------------|---------|
| `task.created` | A new task is created | `{ taskId, title, type }` |
| `task.completed` | Task reaches COMPLETE | `{ taskId, qualityScore, summary }` |
| `task.failed` | Task reaches ESCALATED | `{ taskId, reason }` |
| `task.blocked` | Task is blocked awaiting confirmation | `{ taskId, confirmationType, code }` |
| `channel.message.received` | Inbound message arrives | `{ channelId, senderId, preview }` |
| `channel.health.changed` | Channel health changes | `{ channelId, healthy, reason }` |
| `extension.activated` | Extension completes activation | `{ extensionName, version }` |
| `extension.deactivated` | Extension is deactivated | `{ extensionName, reason }` |
| `extension.crashed` | Extension worker crashes | `{ extensionName, crashCount }` |
| `connection.added` | Service connection installed | `{ service, connectionId }` |
| `connection.removed` | Service connection removed | `{ service, connectionId }` |
| `memory.written` | Memory entry created or updated | `{ entryId, tags }` |

**Delivery guarantees:** At-most-once within a host runtime. Events are not persisted across host restarts.

### §7.5 Memory Layer

The Memory Layer provides shared, tagged, searchable state for loosely coupled coordination.

**Entry schema:**

```typescript
interface MemoryEntry {
  id: string;
  content: string;        // Text content. Indexed for semantic search.
  tags?: string[];        // Max 20 per entry.
  /** The extension that wrote this entry. Format: @scope/name */
  authorExtension: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  ttl?: number;           // Seconds. Undefined = no expiry.
}
```

**Scoping:** Memory is workspace-scoped. Extensions cannot read memory from other workspaces.

**API:**
- `sdk.memory.read({ query, tags?, limit? })` — semantic search, optional tag filter, default limit 10, max 100.
- `sdk.memory.write({ content, tags?, metadata?, ttl? })` — create or update. Providing `metadata.id` of an owned entry updates it.
- `sdk.memory.delete({ id })` — delete an owned entry.

---

## §8 Agent Contract

Agents are the only extension type with autonomous initiative. This section defines the full contract an agent extension must implement.

### §8.1 Required Interface

```typescript
interface AgentExtension {
  activate(sdk: KapselSDK): Promise<void>;

  // Must respond within 5 seconds.
  shouldActivate(task: TaskSummary, sdk: KapselSDK): Promise<{
    activate: boolean;
    confidence: number; // 0.0–1.0
    reason?: string;
  }>;

  // Must respond within 30 seconds.
  plan(task: Task, sdk: KapselSDK): Promise<Plan>;

  executeStep(
    task: Task,
    plan: Plan,
    stepIndex: number,
    sdk: KapselSDK
  ): Promise<StepResult>;

  // Optional. If not implemented, host applies default verification.
  verifyStep?(task: Task, step: TaskStep, sdk: KapselSDK): Promise<VerificationResult>;

  // Optional. Called when a task is escalated.
  onEscalation?(
    task: Task,
    reason: EscalationReason,
    sdk: KapselSDK
  ): Promise<{ retry: boolean; recoveryPlan?: Plan }>;

  // Optional. Called on graceful shutdown.
  deactivate?(): Promise<void>;
}
```

### §8.2 Plan Schema

```typescript
interface Plan {
  /**
   * Monotonically increasing version number. Starts at 1.
   * The host increments this when an agent re-plans mid-execution (e.g. after escalation recovery).
   * Hosts MUST use this to avoid replaying steps already completed under a prior plan version.
   */
  version: number;
  goalRestatement: string;  // Agent's restatement of the goal. Sent to user.
  steps: PlanStep[];
  estimatedMs?: number;
  confidence: number;       // 0.0–1.0
  oneWayDoors: OneWayDoor[];
  risks?: string[];
}

interface PlanStep {
  index: number;
  description: string;
  tools: string[];           // Tools this step will invoke. Host pre-validates.
  dependsOnPrevious: boolean;
  isOneWayDoor: boolean;
}

interface OneWayDoor {
  stepIndex: number;
  type: OneWayDoorType;
  description: string;
  confirmationCode?: string; // Generated by host, not agent.
}

type OneWayDoorType =
  | "schema_migration"
  | "public_api_change"
  | "resource_deletion"
  | "service_restart"
  | "data_write"
  | "external_publish";
```

### §8.3 Step Result Schema

```typescript
interface StepResult {
  stepIndex: number;
  success: boolean;
  summary: string;     // Max 200 tokens.
  toolCalls: ToolCall[];
  output?: unknown;
  /** Whether execution can proceed to the next step. */
  canContinue: boolean;
  /**
   * Required when canContinue is false.
   * Describes why execution was halted so the host can surface a meaningful
   * message to the user and decide whether to escalate or await input.
   */
  blockedReason?: string;
}

interface ToolCall {
  toolName: string;
  params: unknown;
  result: unknown;
  durationMs: number;
  success: boolean;
  error?: string;
}

interface VerificationResult {
  verified: boolean;
  method: string;
  evidence: string;
  confidence: number;
}
```

### §8.4 One-Way Door Protocol

One-way doors are actions that are difficult or impossible to undo. The host MUST enforce a confirmation protocol for all plan steps flagged as one-way doors.

**Protocol:**
1. Agent's `plan()` sets `isOneWayDoor: true` and `type` on affected steps.
2. Host sends the plan to the user's primary channel. User has a configurable veto window (default: 2 minutes) to `/block` before execution begins.
3. When execution reaches a one-way door step:
   - Host generates a random 6-character alphanumeric code.
   - Host sends: `"Step N requires confirmation. Type this code to proceed: ABC123. Expires in 10 minutes."`
   - Execution pauses until code is received or timeout expires.
   - On timeout: step fails with `CONFIRMATION_EXPIRED`, task escalates.
4. Each one-way door step requires its own confirmation code. Codes are not reusable.

**Bypass:** There is no mechanism to bypass one-way door confirmation. Agents MUST NOT attempt to circumvent this protocol.

### §8.5 Escalation Reasons

```typescript
type EscalationReason =
  | "wall_clock_exceeded"
  | "step_failed_max_retries"
  | "confirmation_expired"
  | "tool_error_unrecoverable"
  | "low_confidence"
  | "user_blocked"
```

### §8.6 Quality Scoring

On task completion, the host calculates a quality score (0–10) by task type. Agents MUST NOT calculate or report their own quality score.

| Task Type | Rubric |
|-----------|--------|
| `coding` | Build passes (30%), tests pass (25%), acceptance criteria met (25%), no scope creep (10%), no TODOs remaining (10%) |
| `deployment` | Health check passes (40%), rollback confirmed available (30%), no regression (30%) |
| `research` | Sources cited (25%), claims verifiable (25%), actionable output (30%), scope respected (20%) |
| `ops` | Operation succeeded (40%), state confirmed (40%), side effects logged (20%) |
| `automation` | Ran without error (40%), expected output produced (40%), idempotent if re-run (20%) |

---

## §9 Lifecycle Hooks

### §9.1 Common Hooks (All Extension Types)

```typescript
interface CommonLifecycleHooks {
  // Required. Registers tools, schedules, widgets, subscriptions.
  activate(sdk: KapselSDK): Promise<void>;

  // Optional. Clean up external connections, flush writes.
  // Host allows max 10 seconds to complete.
  deactivate?(): Promise<void>;

  // Optional. Apply new config without full restart if possible.
  onConfigUpdate?(newConfig: unknown): Promise<void>;
}
```

### §9.2 Channel-Specific Hooks

```typescript
interface ChannelLifecycleHooks extends CommonLifecycleHooks {
  receive(message: InboundMessage, sdk: KapselSDK): Promise<void>;
  send(message: OutboundMessage, sdk: KapselSDK): Promise<{ delivered: boolean; messageId?: string }>;
  health(sdk: KapselSDK): Promise<{ healthy: boolean; reason?: string }>;
  onPairingRequest?(senderId: string, pairingCode: string, sdk: KapselSDK): Promise<void>;
}
```

### §9.3 Hook Execution Guarantees

- `activate()` MUST complete before the extension is considered ready.
- `deactivate()` is best-effort — it may not be called on abnormal host exit.
- `onConfigUpdate()` MUST be called before the new config takes effect in subsequent invocations.
- If `activate()` throws, the extension is considered failed and not retried until reinstall or host restart.

---

## §10 Error Handling

### §10.1 Extension Responsibilities

Extensions MUST:
- Catch all errors within handlers and return structured error responses rather than throwing.
- Never include credentials or secrets in error messages.

Extensions MUST NOT:
- Retry failures internally (the host manages retry logic).
- Swallow errors silently.

### §10.2 Host Responsibilities

Hosts MUST:
- Return `CAPABILITY_DENIED` when a capability check fails.
- Return `TIMEOUT` (not crash) when a worker does not respond within the timeout window.
- Log all errors with: timestamp, extension name, extension version, method name, error code, message, correlation ID.

### §10.3 Retry Policy

| Error Code | Retry? | Backoff |
|-----------|--------|---------|
| `TIMEOUT` | Yes, up to 2 times | Exponential: 1s, 4s |
| `WORKER_CRASHED` | Yes, once (after restart) | After restart completes |
| `INTERNAL_ERROR` | Yes, up to 2 times | Exponential: 2s, 8s |
| `CAPABILITY_DENIED` | No | — |
| `TOOL_NOT_FOUND` | No | — |
| `INVALID_PARAMS` | No | — |
| `CONNECTION_UNAVAILABLE` | No (user action required) | — |
| `EXTENSION_DISABLED` | No (user action required) | — |
| `COMPLIANCE_INSUFFICIENT` | No (host limitation) | — |

---

## §11 Versioning and Compatibility

### §11.1 Spec Versioning

The Kapsel spec follows semver:
- **Patch (0.2.x):** Clarifications, typo fixes. No behavior changes.
- **Minor (0.x.0):** New optional features. Backwards compatible.
- **Major (x.0.0):** Breaking changes.

During 0.x, breaking changes MAY occur in minor versions. After 1.0, strict semver applies.

### §11.2 Extension Compatibility

| Extension targets | Host supports | Compatible? |
|-----------------|---------------|-------------|
| 0.2.x | 0.2.y (any y) | Yes |
| 0.2.x | 0.3.x | Yes (host is newer minor) |
| 0.3.x | 0.2.x | No |
| 1.x.x | 0.x.x | No |

### §11.3 Host Version Advertisement

```typescript
// Available in activate() context
sdk.host.kapselVersion   // e.g., "0.2.0"
sdk.host.complianceLevel // e.g., "full"
sdk.host.name            // e.g., "my-host"
sdk.host.version         // e.g., "1.4.2"
```

### §11.4 Runtime Capability Negotiation

An extension MAY declare a minimum host compliance level via `minHostLevel` in its manifest. The host MUST enforce this at **install time** by rejecting the installation with `COMPLIANCE_INSUFFICIENT` if its compliance level is below the declared minimum.

For extensions that want to conditionally use features based on what the host supports at runtime, the following pattern applies:

```typescript
export async function activate(sdk: KapselSDK): Promise<void> {
  const level = sdk.host.complianceLevel;

  if (level === 'full') {
    // Event Bus is available — subscribe to host topics
    sdk.events.subscribe('task.completed', async (payload) => {
      // react to task completion
    });
  } else {
    // Standard host — fall back to polling via cron
    sdk.registerSchedule({
      name: 'poll_tasks',
      schedule: '*/5 * * * *',
      timezone: 'UTC',
      handler: async () => { /* poll instead */ },
    });
  }
}
```

**Rules:**

1. If `minHostLevel` is declared and the host is below that level, the host MUST reject installation with `COMPLIANCE_INSUFFICIENT` before `activate()` is ever called.
2. If `minHostLevel` is not declared (defaults to `core`), the extension MAY inspect `sdk.host.complianceLevel` at runtime and adapt accordingly.
3. If an extension calls an SDK method that requires a compliance level the host does not implement, the host MUST return `NOT_IMPLEMENTED`. Hosts MUST NOT silently no-op these calls.
4. Extensions SHOULD degrade gracefully rather than fail hard when optional compliance features are unavailable. If graceful degradation is impossible, the extension SHOULD throw from `activate()` with a descriptive error message rather than silently malfunctioning at runtime.

---

## §12 Registry Protocol

The registry provides a standard HTTP API for publishing, discovering, and installing extensions. Any organization MAY run a registry. The protocol is the same regardless of operator.

### §12.1 Endpoints

#### Health Check

```
GET /health

200: { "status": "ok", "kapselVersion": "0.2.0", "name": "registry.kapsel.sh", "version": "1.0.0" }
```

#### Publish Extension

```
PUT /extensions/:scope/:name/:version
Authorization: Bearer <publisher-token>
Content-Type: application/octet-stream
Body: .tar.gz package

201: { "name": "@scope/name", "version": "1.0.0", "publishedAt": 1709123456789, "tarballUrl": "..." }
409: Version already exists
422: Manifest validation failed
```

#### Get Extension Metadata

```
GET /extensions/:scope/:name

200: {
  "name": "@scope/name",
  "type": "skill",
  "displayName": "...",
  "description": "...",
  "author": "...",
  "license": "MIT",
  "latestVersion": "1.2.0",
  "versions": ["1.0.0", "1.1.0", "1.2.0"],
  "keywords": ["stripe"],
  "downloads": { "weekly": 142, "total": 4820 }
}
```

#### Get Specific Version

```
GET /extensions/:scope/:name/:version

200: {
  "name": "@scope/name",
  "version": "1.2.0",
  "manifest": { ...kapsel.json... },
  "tarballUrl": "...",
  "publishedAt": 1709123456789,
  "shasum": "sha256:abc123...",
  "deprecated": false,
  "deprecationReason": null
}
```

#### Deprecate / Un-deprecate a Version

Marks a published version as unsafe without removing it. Deprecated versions remain downloadable (existing installs are not force-removed) but MUST be surfaced with a warning in all registry responses and host UI. Hosts MUST warn users before installing a deprecated version.

```
PATCH /extensions/:scope/:name/:version
Authorization: Bearer <publisher-token>
Content-Type: application/json
Body: { "deprecated": true, "deprecationReason": "Critical security vulnerability — upgrade to 1.2.1" }

200: {
  "name": "@scope/name",
  "version": "1.0.0",
  "deprecated": true,
  "deprecationReason": "Critical security vulnerability — upgrade to 1.2.1"
}
401: Unauthorized
403: Token scope mismatch
404: Version not found
```

To un-deprecate: send `{ "deprecated": false }`. `deprecationReason` is ignored when `deprecated` is false and MUST be cleared by the registry.

#### Search Extensions

```
GET /search?q=stripe&type=skill&limit=20&offset=0

200: {
  "total": 7,
  "results": [
    {
      "name": "@acme/stripe-monitor",
      "type": "skill",
      "displayName": "...",
      "latestVersion": "1.2.0",
      "downloads": { "weekly": 142 },
      "deprecated": false
    }
  ]
}
```

`deprecated` in search results reflects whether the **latest version** is deprecated. Hosts SHOULD visually distinguish deprecated extensions in their marketplace UI.

#### Download Tarball

```
GET /extensions/:scope/:name/:version.tar.gz

200: Binary .tar.gz stream
404: Not found
```

Hosts SHOULD warn users before downloading a tarball for a deprecated version.

#### Publisher Authentication

```
POST /auth/token
Body: { "githubToken": "<GitHub OAuth token>" }

200: { "token": "<publisher-token>", "scope": "acme", "expiresAt": 1709209856789 }
```

### §12.2 Package Format

The `.tar.gz` MUST contain:

```
@scope/name-1.0.0/
├── kapsel.json       # Required
├── dist/             # Required: compiled output
│   └── index.js
├── README.md         # Recommended
├── CHANGELOG.md      # Recommended
└── LICENSE           # Required
```

MUST NOT contain: `node_modules/`, `.env` files, credentials. Dependencies MUST be bundled into `dist/`.

### §12.3 Security Scanning

Registries SHOULD perform automated security scanning on submission:
- Static analysis for known malicious patterns
- Dependency audit against known vulnerability databases
- Manifest validation (already required for publish acceptance)

Quarantined extensions are not returned in search results.

### §12.4 Registry Federation

Hosts MAY be configured with multiple registries. Registries are queried in configured priority order. Hosts MUST display which registry an extension came from.

---

## §13 Security Requirements

### §13.1 Credential Handling

- Credentials MUST be fetched fresh from the host's encrypted store at call time. They MUST NOT be cached beyond the current invocation.
- Credentials MUST NOT appear in logs, error messages, event payloads, or memory entries.
- Hosts MUST store credentials encrypted at rest (AES-256-GCM or equivalent).
- When a connection is removed, the host MUST delete associated credentials.

### §13.2 Code Execution Safety

- Extension code MUST be treated as untrusted regardless of registry source.
- Hosts MUST NOT grant extensions access to the host's process environment.
- Hosts MUST NOT grant extensions access to the host's database, cache, or internal network.
- All messages crossing the isolation boundary MUST be validated against known schemas. Malformed messages MUST be rejected.

### §13.3 Registry Security

- All write endpoints MUST require authentication.
- Publisher tokens MUST be scoped to a single `@scope`.
- Tarballs MUST be served over HTTPS only.
- The registry MUST provide a `shasum` for every version. Hosts MUST verify shasum before installing.

### §13.4 Transport Security

- All communication with external registries MUST use TLS 1.2 or later.
- The host–worker message channel MUST be authenticated (§5.5).
- Extensions MUST NOT be able to open connections to the host's internal network ranges.

---

## §14 Compliance Levels

Hosts declare a compliance level signaling which parts of Kapsel they implement.

### §14.1 Core

Minimum viable Kapsel host.

**Requirements:**
- Manifest parsing and validation (§3)
- Capability checking at call time (§4)
- At least one isolation mechanism (§5)
- At least one extension type fully supported (§2)
- Lifecycle hooks: `activate`, `deactivate` (§9)
- All standard error codes including `COMPLIANCE_INSUFFICIENT` (§6.4)
- Message protocol for supported extension types (§6)

### §14.2 Standard

Full-featured host capable of multi-extension workflows.

**Requirements:** Everything in Core, plus:
- All five extension types (§2)
- All 18 standard capability tokens (§4.2)
- Tool Registry with collision handling and `timeoutMs` enforcement (§7.1)
- Task Router with confidence-based routing (§7.2)
- Channel Router with health-based failover (§7.3)
- Memory Layer (§7.5)
- Agent Contract: `shouldActivate`, `plan`, `executeStep`, `verifyStep` (§8)
- One-way door protocol (§8.4)
- Quality scoring for standard task types (§8.6)
- Registry integration: install from a registry (§12)
- `minHostLevel` enforcement at install time (§11.4)

### §14.3 Full

Production-grade host supporting autonomous multi-agent workflows.

**Requirements:** Everything in Standard, plus:
- Event Bus with all standard topics and namespace enforcement (§7.4)
- Multi-agent routing: concurrent `shouldActivate`, confidence tiebreaking
- Agent escalation and recovery (`onEscalation`) (§8.5)
- Registry: publish, discover, and deprecate (§12.1)
- All lifecycle hooks including `onConfigUpdate` (§9)
- Complete retry policy including `COMPLIANCE_INSUFFICIENT` (§10.3)
- Runtime capability negotiation: `NOT_IMPLEMENTED` on unsupported SDK calls (§11.4)

### §14.4 Declaring Compliance

Hosts MUST declare their compliance level in:
1. The registry health endpoint (`GET /health`)
2. The SDK context (`sdk.host.complianceLevel`)
3. Their public documentation

Hosts MUST NOT declare a compliance level they do not fully implement.

---

## §15 Normative Language

- **MUST / MUST NOT:** Absolute requirement. Non-compliance = non-conformance.
- **SHALL / SHALL NOT:** Equivalent to MUST / MUST NOT.
- **SHOULD / SHOULD NOT:** Recommended. There may be valid reasons to deviate, but implications must be understood.
- **MAY:** Optional. Permitted but not required.

---

## Appendix A: Complete SDK Interface

```typescript
interface KapselSDK {
  host: {
    kapselVersion: string;
    complianceLevel: "core" | "standard" | "full";
    name: string;
    version: string;
  };

  // Registration (called during activate())
  registerTool(tool: ToolRegistration): void;
  registerSchedule(job: ScheduleRegistration): void;
  registerWidget(widget: WidgetRegistration): void;

  memory: {
    read(query: string, options?: { tags?: string[]; limit?: number }): Promise<MemoryEntry[]>;
    write(entry: { content: string; tags?: string[]; metadata?: Record<string, unknown>; ttl?: number }): Promise<MemoryEntry>;
    delete(id: string): Promise<void>;
  };

  connections: {
    getCredentials(service: string): Promise<ConnectionCredentials>;
    isConnected(service: string): Promise<boolean>;
  };

  channel: {
    send(message: { text: string; priority?: MessagePriority; attachments?: Attachment[] }): Promise<void>;
    sendDirect(channelId: string, message: OutboundMessage): Promise<void>;
  };

  tasks: {
    create(task: { title: string; type: string; context?: unknown }): Promise<Task>;
    read(taskId: string): Promise<Task>;
    readAll(filter?: { status?: TaskStatus; type?: string }): Promise<Task[]>;
  };

  events: {
    /**
     * Subscribe to any topic. Extensions may subscribe to host-owned topics.
     * Returns an unsubscribe function.
     */
    subscribe(topic: string, handler: (payload: unknown) => Promise<void>): () => void;
    /**
     * Publish to the ext.<scope>.* namespace only.
     * Publishing to host-owned topic prefixes returns CAPABILITY_DENIED.
     * Publishing outside the extension's own scope returns CAPABILITY_DENIED.
     */
    publish(topic: string, payload: unknown): Promise<void>;
    unsubscribe(topic: string): void;
  };

  storage: {
    get<T = unknown>(key: string): Promise<T | null>;
    set<T = unknown>(key: string, value: T, options?: { ttl?: number }): Promise<void>;
    delete(key: string): Promise<void>;
    /** Returns up to options.limit keys (default 1000, max 1000). */
    list(prefix?: string, options?: { limit?: number }): Promise<string[]>;
  };

  tools: {
    invoke<T = unknown>(toolName: string, params: unknown): Promise<T>;
    list(): Promise<ToolSummary[]>;
  };

  ui: {
    notify(notification: { title: string; body: string; level?: NotificationLevel }): Promise<void>;
  };
}

interface ConnectionCredentials {
  type: "api_key" | "oauth2" | "basic" | "webhook";
  data: Record<string, string>;
}

interface ScheduleRegistration {
  name: string;
  schedule: string;    // 5-field cron expression
  timezone?: string;   // IANA timezone string (e.g. 'America/New_York'). Defaults to 'UTC'.
  handler(): Promise<void>;
}

interface WidgetRegistration {
  name: string;
  displayName: string;
  displayType: "metric" | "chart" | "list" | "status" | "custom";
  refreshInterval: number; // seconds
  dataHandler(config: unknown): Promise<unknown>;
}

interface ToolRegistration {
  name: string;
  description: string; // Max 500 chars. Shown to agents.
  parameters: JSONSchema; // Must be type "object" at top level.
  hints?: {
    estimatedMs?: number;
    timeoutMs?: number;      // Hard abort ceiling. Overrides host default for this tool.
    hasSideEffects?: boolean;
    idempotent?: boolean;
  };
  handler(params: unknown, context: InvokeContext): Promise<unknown>;
}

interface ToolSummary {
  name: string;
  description: string;
  ownerExtension: string;
}

type MessagePriority = "low" | "normal" | "high" | "critical";
type NotificationLevel = "info" | "warning" | "error";
```

---

## Appendix B: Interaction Matrix

| From \ To | Tool Registry | Task Router | Channel Router | Event Bus | Memory | Tasks | Storage |
|-----------|:------------:|:-----------:|:--------------:|:---------:|:------:|:-----:|:-------:|
| **Agent** | Invoke | Create sub-tasks | Send | Sub + Pub (ext.scope.* only) | R/W | Create, Read All | R/W |
| **Skill** | Register + Invoke | — | Send | Sub + Pub (ext.scope.* only) | R/W | — | R/W |
| **Channel** | — | Route inbound | Register + health | Subscribe only | — | — | R/W |
| **Tool** | Register | — | — | — | R/W | — | R/W |
| **MCP Server** | Register (bridged) | — | — | — | — | — | — |

---

## Appendix C: Extension Type Quick Reference

| Property | Agent | Skill | Channel | Tool | MCP Server |
|----------|:-----:|:-----:|:-------:|:----:|:----------:|
| Autonomous initiative | Yes | No | No | No | No |
| Registers tools | Yes | Yes | No | Yes | Yes (bridged) |
| Registers cron jobs | Yes | Yes | No | No | No |
| Registers widgets | No | Yes | No | No | No |
| Has planning loop | Yes | No | No | No | No |
| Handles inbound messages | No | No | Yes | No | No |
| Min host level | Standard | Core | Standard | Core | Standard |

---

*Kapsel Protocol v0.2.0-draft — Apache 2.0 — https://github.com/Kapsel-Protocol/kapsel-core*
