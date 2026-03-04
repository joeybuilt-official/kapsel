/**
 * Kapsel Manifest Types
 * Corresponds to §3 of the Kapsel Protocol Specification
 */

export type ExtensionType = 'agent' | 'skill' | 'channel' | 'tool' | 'mcp-server';

export type CapabilityToken =
  | 'memory:read'
  | 'memory:write'
  | 'memory:delete'
  | 'channel:send'
  | 'channel:send-direct'
  | 'channel:receive'
  | 'schedule:register'
  | 'schedule:manage'
  | 'ui:register-widget'
  | 'ui:notify'
  | 'tasks:create'
  | 'tasks:read'
  | 'tasks:read-all'
  | 'events:subscribe'
  | 'events:publish'
  | 'storage:read'
  | 'storage:write'
  | `connections:${string}`
  | `host:${string}:${string}`;

export type HostComplianceLevel = 'core' | 'standard' | 'full';

export interface MCPServerConfig {
  transport: 'stdio' | 'sse';
  /** Required when transport is 'stdio' */
  command?: string;
  /** Required when transport is 'sse' */
  url?: string;
}

export interface AgentHints {
  /** Task type strings this agent handles. Used for tiebreaking. */
  taskTypes?: string[];
  /** Minimum confidence this agent returns when it will activate. */
  minConfidence?: number;
}

export interface ResourceHints {
  maxMemoryMB?: number;
  maxCpuShares?: number;
  maxInvocationMs?: number;
}

export interface JSONSchema {
  type: string;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  description?: string;
  default?: unknown;
  enum?: unknown[];
  items?: JSONSchema;
  [key: string]: unknown;
}

/**
 * Informational tool declaration for static discovery (§3.1).
 *
 * Hosts MUST NOT use this as a substitute for runtime activation.
 * The authoritative tool list is only available after activate() completes.
 * This field exists so registries and marketplaces can surface tool names
 * without activating every installed extension.
 */
export interface ManifestToolHint {
  /** Tool name. Must match the name passed to sdk.registerTool(). */
  name: string;
  /** Short description shown in registry and marketplace UI. Max 500 characters. */
  description: string;
}

export interface KapselManifest {
  /** Protocol version this extension targets. Must be valid semver. */
  kapsel: string;
  /** Scoped package name. Must match @scope/name format. */
  name: string;
  /** Extension version. Must be valid semver. */
  version: string;
  /** Extension type. */
  type: ExtensionType;
  /** Relative path to entry point from package root. */
  entry: string;
  /** Capability tokens this extension requires. */
  capabilities: CapabilityToken[];
  /** Human-readable name. */
  displayName: string;
  /** Short description. Max 280 characters. */
  description: string;
  /** Publisher name or organization. */
  author: string;
  /** SPDX license identifier. */
  license: string;

  // --- Optional fields ---

  /** Minimum host compliance level required. Defaults to 'core'. */
  minHostLevel?: HostComplianceLevel;
  /** Minimum Kapsel spec version required. */
  minKapselVersion?: string;
  /** Homepage URL. */
  homepage?: string;
  /** Source repository URL. */
  repository?: string;
  /** Keywords for registry discovery. Max 10. */
  keywords?: string[];
  /** Extension icon URL. Must be HTTPS. */
  icon?: string;
  /** Screenshot URLs. Max 5. Must be HTTPS. */
  screenshots?: string[];
  /** For mcp-server type only. */
  mcpServer?: MCPServerConfig;
  /** For agent type only. */
  agentHints?: AgentHints;
  /** For channel type only. Rendered as setup form. */
  channelConfig?: JSONSchema;
  /** For skill type only. Rendered as settings form. */
  skillConfig?: JSONSchema;
  /** Resource hints. Host may enforce stricter limits. */
  resourceHints?: ResourceHints;
  /** Informational only. Hosts must not enforce peer deps. */
  peerExtensions?: string[];
  /**
   * Informational tool declarations for static discovery (§3.1).
   *
   * Hosts MUST NOT use this as a substitute for activation-time tool registration.
   * The authoritative tool list is only available after activate() completes.
   * This field exists so registries and marketplaces can surface tool names
   * before an extension is installed or activated.
   *
   * Tool names listed here SHOULD match names passed to sdk.registerTool() at runtime,
   * but hosts MUST NOT enforce this constraint — it is informational only.
   */
  tools?: ManifestToolHint[];
  /**
   * Informational list of Event Bus topics this extension publishes to (§7.4).
   *
   * All topics MUST be within the ext.<scope>.* namespace.
   * Hosts MUST NOT use this as an allowlist — topic enforcement happens at runtime.
   * This field exists so developers and registry users can understand an extension's
   * event surface without activating it.
   *
   * Example: ["ext.acme.stripe-monitor.mrr-alert", "ext.acme.stripe-monitor.churn-detected"]
   */
  publishTopics?: string[];
}
