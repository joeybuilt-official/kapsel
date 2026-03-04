/**
 * Kapsel SDK Interface
 * The complete API available to extensions via the sdk parameter in activate()
 * Corresponds to Appendix A of the Kapsel Protocol Specification
 */

import type { HostComplianceLevel } from './manifest.js';
import type { Task, TaskStatus, TaskType, VerificationResult } from './tasks.js';
import type {
  InboundMessage,
  OutboundMessage,
  MessagePriority,
  Attachment,
} from './messages.js';
import type { JSONSchema } from './manifest.js';

export type NotificationLevel = 'info' | 'warning' | 'error';

export interface HostInfo {
  kapselVersion: string;
  complianceLevel: HostComplianceLevel;
  name: string;
  version: string;
}

export interface MemoryEntry {
  id: string;
  content: string;
  tags?: string[];
  authorExtension: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  ttl?: number;
}

export interface ConnectionCredentials {
  type: 'api_key' | 'oauth2' | 'basic' | 'webhook';
  data: Record<string, string>;
}

export interface ScheduleRegistration {
  name: string;
  /** 5-field cron expression */
  schedule: string;
  handler(): Promise<void>;
}

export interface WidgetDisplayType {
  type: 'metric' | 'chart' | 'list' | 'status' | 'custom';
}

export interface WidgetRegistration {
  name: string;
  displayName: string;
  displayType: 'metric' | 'chart' | 'list' | 'status' | 'custom';
  /** Refresh interval in seconds */
  refreshInterval: number;
  dataHandler(config: unknown): Promise<unknown>;
}

export interface ToolRegistration {
  /** Alphanumeric and underscores. Unique within the extension. */
  name: string;
  /** Max 500 characters. Shown to agents. */
  description: string;
  /** Must be type "object" at top level. */
  parameters: JSONSchema;
  hints?: {
    /** Estimated execution time in ms */
    estimatedMs?: number;
    /** Whether this tool has external side effects */
    hasSideEffects?: boolean;
    /** Whether calling with same params produces same result */
    idempotent?: boolean;
  };
  handler(params: unknown, context: InvokeContext): Promise<unknown>;
}

export interface InvokeContext {
  workspaceId: string;
  taskId?: string;
  requestId: string;
}

export interface ToolSummary {
  name: string;
  description: string;
  ownerExtension: string;
}

export interface TaskCreateOptions {
  title: string;
  type: TaskType | string;
  context?: unknown;
}

export interface TaskFilter {
  status?: TaskStatus;
  type?: string;
}

/**
 * The complete Kapsel SDK interface.
 * All extension types receive this in their activate() call.
 * Methods only work if the corresponding capability is declared in kapsel.json.
 */
export interface KapselSDK {
  /** Information about the host runtime */
  host: HostInfo;

  /**
   * Registration methods. Only valid during activate().
   * Calling after activation completes is a no-op with a warning.
   */
  registerTool(tool: ToolRegistration): void;
  registerSchedule(job: ScheduleRegistration): void;
  registerWidget(widget: WidgetRegistration): void;

  memory: {
    /** Requires memory:read capability */
    read(query: string, options?: { tags?: string[]; limit?: number }): Promise<MemoryEntry[]>;
    /** Requires memory:write capability */
    write(entry: {
      content: string;
      tags?: string[];
      metadata?: Record<string, unknown>;
      ttl?: number;
    }): Promise<MemoryEntry>;
    /** Requires memory:delete capability */
    delete(id: string): Promise<void>;
  };

  connections: {
    /** Requires connections:<service> capability */
    getCredentials(service: string): Promise<ConnectionCredentials>;
    isConnected(service: string): Promise<boolean>;
  };

  channel: {
    /** Requires channel:send capability */
    send(message: {
      text: string;
      priority?: MessagePriority;
      attachments?: Attachment[];
    }): Promise<void>;
    /** Requires channel:send-direct capability */
    sendDirect(channelId: string, message: OutboundMessage): Promise<void>;
  };

  tasks: {
    /** Requires tasks:create capability */
    create(task: TaskCreateOptions): Promise<Task>;
    /** Requires tasks:read capability */
    read(taskId: string): Promise<Task>;
    /** Requires tasks:read-all capability */
    readAll(filter?: TaskFilter): Promise<Task[]>;
  };

  events: {
    /** Requires events:subscribe capability. Returns unsubscribe function. */
    subscribe(topic: string, handler: (payload: unknown) => Promise<void>): () => void;
    /** Requires events:publish capability. Topic must be in ext.<scope>.* namespace. */
    publish(topic: string, payload: unknown): Promise<void>;
    unsubscribe(topic: string): void;
  };

  storage: {
    /** Requires storage:read capability */
    get<T = unknown>(key: string): Promise<T | null>;
    /** Requires storage:write capability */
    set<T = unknown>(key: string, value: T, options?: { ttl?: number }): Promise<void>;
    /** Requires storage:write capability */
    delete(key: string): Promise<void>;
    /** Requires storage:read capability */
    list(prefix?: string): Promise<string[]>;
  };

  tools: {
    invoke<T = unknown>(toolName: string, params: unknown): Promise<T>;
    list(): Promise<ToolSummary[]>;
  };

  ui: {
    /** Requires ui:notify capability */
    notify(notification: {
      title: string;
      body: string;
      level?: NotificationLevel;
    }): Promise<void>;
  };
}
