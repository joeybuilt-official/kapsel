/**
 * Kapsel Event Bus Standard Topics
 * Corresponds to §7.4 of the Kapsel Protocol Specification
 */

// Standard topic constants — use these instead of string literals
export const TOPICS = {
  TASK_CREATED: 'task.created',
  TASK_COMPLETED: 'task.completed',
  TASK_FAILED: 'task.failed',
  TASK_BLOCKED: 'task.blocked',
  CHANNEL_MESSAGE_RECEIVED: 'channel.message.received',
  CHANNEL_HEALTH_CHANGED: 'channel.health.changed',
  EXTENSION_ACTIVATED: 'extension.activated',
  EXTENSION_DEACTIVATED: 'extension.deactivated',
  EXTENSION_CRASHED: 'extension.crashed',
  CONNECTION_ADDED: 'connection.added',
  CONNECTION_REMOVED: 'connection.removed',
  MEMORY_WRITTEN: 'memory.written',
} as const;

export type StandardTopic = (typeof TOPICS)[keyof typeof TOPICS];

// Payload types for standard topics
export interface TaskCreatedPayload {
  taskId: string;
  title: string;
  type: string;
}

export interface TaskCompletedPayload {
  taskId: string;
  qualityScore?: number;
  summary: string;
}

export interface TaskFailedPayload {
  taskId: string;
  reason: string;
}

export interface TaskBlockedPayload {
  taskId: string;
  confirmationType: string;
  code: string;
}

export interface ChannelMessageReceivedPayload {
  channelId: string;
  senderId: string;
  preview: string;
}

export interface ChannelHealthChangedPayload {
  channelId: string;
  healthy: boolean;
  reason?: string;
}

export interface ExtensionActivatedPayload {
  extensionName: string;
  version: string;
}

export interface ExtensionDeactivatedPayload {
  extensionName: string;
  reason: string;
}

export interface ExtensionCrashedPayload {
  extensionName: string;
  crashCount: number;
}

export interface ConnectionAddedPayload {
  service: string;
  connectionId: string;
}

export interface ConnectionRemovedPayload {
  service: string;
  connectionId: string;
}

export interface MemoryWrittenPayload {
  entryId: string;
  tags?: string[];
}

/**
 * Helper to build a custom event topic.
 * Extension custom topics must be in the ext.<scope>.<name>.<event> namespace.
 */
export function customTopic(scope: string, extensionName: string, event: string): string {
  return `ext.${scope}.${extensionName}.${event}`;
}
