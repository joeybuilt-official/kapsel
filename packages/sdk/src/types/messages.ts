/**
 * Kapsel Message Protocol Types
 * Corresponds to §6 of the Kapsel Protocol Specification
 */

import type { Task, TaskSummary, TaskStep } from './tasks.js';
import type { Plan, StepResult } from './agent.js';

export type ErrorCode =
  | 'CAPABILITY_DENIED'
  | 'TOOL_NOT_FOUND'
  | 'INVALID_PARAMS'
  | 'TIMEOUT'
  | 'RATE_LIMITED'
  | 'CONNECTION_UNAVAILABLE'
  | 'WORKER_CRASHED'
  | 'NOT_IMPLEMENTED'
  | 'INTERNAL_ERROR'
  | 'MANIFEST_INVALID'
  | 'VERSION_INCOMPATIBLE'
  | 'EXTENSION_DISABLED';

export interface KapselError {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export interface KapselMessage {
  /** UUID v4 */
  id: string;
  type: MessageType;
  /** Unix milliseconds */
  timestamp: number;
  payload: unknown;
  /** Set on responses; omitted on unsolicited messages */
  correlationId?: string;
  error?: KapselError;
}

export type MessageType =
  // Host → Extension
  | 'invoke.tool'
  | 'invoke.agent.shouldActivate'
  | 'invoke.agent.plan'
  | 'invoke.agent.execute'
  | 'invoke.channel.receive'
  | 'invoke.channel.send'
  | 'invoke.channel.health'
  | 'invoke.widget.data'
  | 'invoke.schedule'
  | 'lifecycle.activate'
  | 'lifecycle.deactivate'
  | 'lifecycle.configUpdate'
  // Extension → Host
  | 'sdk.memory.read'
  | 'sdk.memory.write'
  | 'sdk.memory.delete'
  | 'sdk.connections.getCredentials'
  | 'sdk.channel.send'
  | 'sdk.channel.sendDirect'
  | 'sdk.tasks.create'
  | 'sdk.tasks.read'
  | 'sdk.tasks.readAll'
  | 'sdk.events.subscribe'
  | 'sdk.events.publish'
  | 'sdk.events.unsubscribe'
  | 'sdk.storage.get'
  | 'sdk.storage.set'
  | 'sdk.storage.delete'
  | 'sdk.storage.list'
  | 'sdk.tools.invoke'
  | 'sdk.tools.list'
  | 'sdk.ui.notify'
  // Host → Extension (unsolicited)
  | 'event.published';

// Payload types for host → extension invocations
export interface InvokeToolPayload {
  toolName: string;
  params: unknown;
  context: InvokeContext;
}

export interface InvokeAgentShouldActivatePayload {
  task: TaskSummary;
}

export interface InvokeAgentPlanPayload {
  task: Task;
}

export interface InvokeAgentExecutePayload {
  task: Task;
  plan: Plan;
  stepIndex: number;
}

export interface InvokeChannelReceivePayload {
  message: InboundMessage;
}

export interface InvokeChannelSendPayload {
  message: OutboundMessage;
}

export interface InvokeWidgetDataPayload {
  widgetName: string;
  config: unknown;
}

export interface InvokeSchedulePayload {
  jobName: string;
}

export interface LifecycleActivatePayload {
  config: unknown;
  context: WorkerContext;
}

export interface LifecycleDeactivatePayload {
  reason: string;
}

export interface LifecycleConfigUpdatePayload {
  config: unknown;
}

export interface EventPublishedPayload {
  topic: string;
  payload: unknown;
  publisherId: string;
}

// Shared context types
export interface InvokeContext {
  workspaceId: string;
  taskId?: string;
  requestId: string;
}

export interface WorkerContext {
  workspaceId: string;
  extensionName: string;
  extensionVersion: string;
  hostVersion: string;
  config: unknown;
}

export interface InboundMessage {
  id: string;
  text: string;
  senderId: string;
  channelId: string;
  timestamp: number;
  attachments?: Attachment[];
  raw?: unknown;
}

export interface OutboundMessage {
  text: string;
  priority: MessagePriority;
  attachments?: Attachment[];
  replyToId?: string;
}

export interface Attachment {
  type: 'image' | 'file' | 'code' | 'markdown';
  url?: string;
  content?: string;
  filename?: string;
  mimeType?: string;
}

export type MessagePriority = 'low' | 'normal' | 'high' | 'critical';
