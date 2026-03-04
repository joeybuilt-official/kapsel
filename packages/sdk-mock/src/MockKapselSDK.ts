/**
 * MockKapselSDK
 * In-memory implementation of KapselSDK for testing extensions locally.
 * No host required.
 */

import type {
  KapselSDK,
  HostInfo,
  MemoryEntry,
  ConnectionCredentials,
  ScheduleRegistration,
  WidgetRegistration,
  ToolRegistration,
  ToolSummary,
  InvokeContext,
  Task,
  TaskCreateOptions,
  TaskFilter,
  TaskStatus,
} from '@kapsel/sdk';
import type { OutboundMessage, MessagePriority, Attachment } from '@kapsel/sdk';

export interface MockSentMessage {
  text: string;
  priority: MessagePriority;
  attachments?: Attachment[];
  directChannelId?: string;
}

export interface MockNotification {
  title: string;
  body: string;
  level?: string;
}

export interface MockSDKOptions {
  host?: Partial<HostInfo>;
  connections?: Record<string, ConnectionCredentials>;
}

export interface MockSDKState {
  tools: Map<string, ToolRegistration>;
  schedules: Map<string, ScheduleRegistration>;
  widgets: Map<string, WidgetRegistration>;
  sentMessages: MockSentMessage[];
  notifications: MockNotification[];
  memory: Map<string, MemoryEntry>;
  storage: Map<string, { value: unknown; expiresAt?: number }>;
  tasks: Map<string, Task>;
  eventSubscriptions: Map<string, Array<(payload: unknown) => Promise<void>>>;
  publishedEvents: Array<{ topic: string; payload: unknown }>;
  createdTaskIds: string[];
}

let idCounter = 0;
function genId(): string {
  return `mock-${++idCounter}-${Date.now()}`;
}

export function createMockSdk(options: MockSDKOptions = {}): KapselSDK & { _state: MockSDKState } {
  const state: MockSDKState = {
    tools: new Map(),
    schedules: new Map(),
    widgets: new Map(),
    sentMessages: [],
    notifications: [],
    memory: new Map(),
    storage: new Map(),
    tasks: new Map(),
    eventSubscriptions: new Map(),
    publishedEvents: [],
    createdTaskIds: [],
  };

  const host: HostInfo = {
    kapselVersion: '0.2.0',
    complianceLevel: 'full',
    name: 'kapsel-mock',
    version: '0.0.0',
    ...options.host,
  };

  const connections: Record<string, ConnectionCredentials> = options.connections ?? {};

  const sdk: KapselSDK & { _state: MockSDKState } = {
    host,
    _state: state,

    registerTool(tool) {
      state.tools.set(tool.name, tool);
    },

    registerSchedule(job) {
      state.schedules.set(job.name, job);
    },

    registerWidget(widget) {
      state.widgets.set(widget.name, widget);
    },

    memory: {
      async read(query, opts) {
        const limit = opts?.limit ?? 10;
        const tags = opts?.tags;
        const entries = Array.from(state.memory.values());
        const now = Date.now();
        return entries
          .filter((e) => {
            if (e.ttl && e.createdAt + e.ttl * 1000 < now) return false;
            if (tags && tags.length > 0) {
              return tags.some((t) => e.tags?.includes(t));
            }
            return e.content.toLowerCase().includes(query.toLowerCase());
          })
          .slice(0, limit);
      },

      async write(entry) {
        const id = genId();
        const now = Date.now();
        const memEntry: MemoryEntry = {
          id,
          content: entry.content,
          tags: entry.tags,
          authorExtension: 'mock',
          metadata: entry.metadata,
          createdAt: now,
          updatedAt: now,
          ttl: entry.ttl,
        };
        state.memory.set(id, memEntry);
        return memEntry;
      },

      async delete(id) {
        state.memory.delete(id);
      },
    },

    connections: {
      async getCredentials(service) {
        const creds = connections[service];
        if (!creds) {
          throw new Error(`Mock: no credentials configured for service "${service}"`);
        }
        return creds;
      },

      async isConnected(service) {
        return service in connections;
      },
    },

    channel: {
      async send(message) {
        state.sentMessages.push({
          text: message.text,
          priority: message.priority ?? 'normal',
          attachments: message.attachments,
        });
      },

      async sendDirect(channelId, message) {
        state.sentMessages.push({
          text: message.text,
          priority: message.priority,
          attachments: message.attachments,
          directChannelId: channelId,
        });
      },
    },

    tasks: {
      async create(opts: TaskCreateOptions) {
        const id = genId();
        const now = Date.now();
        const task: Task = {
          id,
          title: opts.title,
          type: opts.type,
          status: 'queued' as TaskStatus,
          steps: [],
          context: opts.context,
          createdAt: now,
          updatedAt: now,
        };
        state.tasks.set(id, task);
        state.createdTaskIds.push(id);
        return task;
      },

      async read(taskId) {
        const task = state.tasks.get(taskId);
        if (!task) throw new Error(`Mock: task "${taskId}" not found`);
        return task;
      },

      async readAll(filter?: TaskFilter) {
        const tasks = Array.from(state.tasks.values());
        return tasks.filter((t) => {
          if (filter?.status && t.status !== filter.status) return false;
          if (filter?.type && t.type !== filter.type) return false;
          return true;
        });
      },
    },

    events: {
      subscribe(topic, handler) {
        const existing = state.eventSubscriptions.get(topic) ?? [];
        existing.push(handler);
        state.eventSubscriptions.set(topic, existing);
        return () => {
          const handlers = state.eventSubscriptions.get(topic) ?? [];
          const idx = handlers.indexOf(handler);
          if (idx !== -1) handlers.splice(idx, 1);
        };
      },

      async publish(topic, payload) {
        state.publishedEvents.push({ topic, payload });
        const handlers = state.eventSubscriptions.get(topic) ?? [];
        await Promise.all(handlers.map((h) => h(payload)));
      },

      unsubscribe(topic) {
        state.eventSubscriptions.delete(topic);
      },
    },

    storage: {
      async get<T = unknown>(key: string): Promise<T | null> {
        const entry = state.storage.get(key);
        if (!entry) return null;
        if (entry.expiresAt && entry.expiresAt < Date.now()) {
          state.storage.delete(key);
          return null;
        }
        return entry.value as T;
      },

      async set<T = unknown>(key: string, value: T, opts?: { ttl?: number }): Promise<void> {
        state.storage.set(key, {
          value,
          expiresAt: opts?.ttl ? Date.now() + opts.ttl * 1000 : undefined,
        });
      },

      async delete(key: string): Promise<void> {
        state.storage.delete(key);
      },

      async list(prefix?: string): Promise<string[]> {
        const keys = Array.from(state.storage.keys());
        return prefix ? keys.filter((k) => k.startsWith(prefix)) : keys;
      },
    },

    tools: {
      async invoke<T = unknown>(toolName: string, params: unknown): Promise<T> {
        const tool = state.tools.get(toolName);
        if (!tool) throw new Error(`Mock: tool "${toolName}" not found`);
        const context: InvokeContext = {
          workspaceId: 'mock-workspace',
          requestId: genId(),
        };
        return tool.handler(params, context) as Promise<T>;
      },

      async list(): Promise<ToolSummary[]> {
        return Array.from(state.tools.values()).map((t) => ({
          name: t.name,
          description: t.description,
          ownerExtension: 'mock',
        }));
      },
    },

    ui: {
      async notify(notification) {
        state.notifications.push(notification);
      },
    },
  };

  return sdk;
}
