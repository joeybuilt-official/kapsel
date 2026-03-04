/**
 * @kapsel/sdk
 * TypeScript SDK for building Kapsel-compatible extensions.
 *
 * Import types to implement extension contracts.
 * The actual KapselSDK instance is passed to your activate() function by the host.
 *
 * @example
 * ```typescript
 * import type { KapselSDK } from '@kapsel/sdk';
 *
 * export async function activate(sdk: KapselSDK): Promise<void> {
 *   sdk.registerTool({
 *     name: 'my_tool',
 *     description: 'Does something useful.',
 *     parameters: { type: 'object', properties: {} },
 *     handler: async (params, context) => ({ result: 'ok' }),
 *   });
 * }
 * ```
 */

// Core SDK interface
export type { KapselSDK } from './types/sdk.js';
export type {
  HostInfo,
  MemoryEntry,
  ConnectionCredentials,
  ScheduleRegistration,
  WidgetRegistration,
  ToolRegistration,
  ToolSummary,
  InvokeContext,
  NotificationLevel,
  TaskCreateOptions,
  TaskFilter,
} from './types/sdk.js';

// Manifest types
export type {
  KapselManifest,
  ExtensionType,
  CapabilityToken,
  HostComplianceLevel,
  MCPServerConfig,
  AgentHints,
  ResourceHints,
  JSONSchema,
} from './types/manifest.js';

// Message protocol types
export type {
  KapselMessage,
  KapselError,
  ErrorCode,
  MessageType,
  InboundMessage,
  OutboundMessage,
  Attachment,
  MessagePriority,
  InvokeContext as MessageInvokeContext,
  WorkerContext,
} from './types/messages.js';

// Task types
export type {
  Task,
  TaskSummary,
  TaskStep,
  TaskStatus,
  TaskType,
  VerificationResult,
} from './types/tasks.js';

// Agent types
export type {
  AgentExtension,
  Plan,
  PlanStep,
  StepResult,
  ToolCall,
  OneWayDoor,
  OneWayDoorType,
  EscalationReason,
  EscalationResponse,
  ShouldActivateResult,
} from './types/agent.js';

// Channel types
export type { ChannelExtension, ChannelSendResult, ChannelHealthResult } from './types/channel.js';

// Event types and utilities
export type {
  StandardTopic,
  TaskCreatedPayload,
  TaskCompletedPayload,
  TaskFailedPayload,
  TaskBlockedPayload,
  ChannelMessageReceivedPayload,
  ChannelHealthChangedPayload,
  ExtensionActivatedPayload,
  ExtensionDeactivatedPayload,
  ExtensionCrashedPayload,
  ConnectionAddedPayload,
  ConnectionRemovedPayload,
  MemoryWrittenPayload,
} from './types/events.js';
export { TOPICS, customTopic } from './types/events.js';

// Validation
export { validateManifest } from './validation/manifest.js';
export type { ValidationResult, ValidationError } from './validation/manifest.js';
