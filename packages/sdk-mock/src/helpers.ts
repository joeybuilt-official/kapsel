/**
 * Test helper utilities for sdk-mock.
 * Provides convenience functions for simulating host-side events.
 */

import type { MockSDKState } from './MockKapselSDK.js';
import type { KapselSDK } from '@kapsel/sdk';
import type { InboundMessage } from '@kapsel/sdk';

type MockSDK = KapselSDK & { _state: MockSDKState };

/**
 * Trigger a registered cron job by name.
 */
export async function triggerSchedule(sdk: MockSDK, jobName: string): Promise<void> {
  const job = sdk._state.schedules.get(jobName);
  if (!job) throw new Error(`No schedule registered with name "${jobName}"`);
  await job.handler();
}

/**
 * Invoke a registered tool by name with given params.
 */
export async function invokeTool<T = unknown>(sdk: MockSDK, toolName: string, params: unknown): Promise<T> {
  return sdk.tools.invoke<T>(toolName, params);
}

/**
 * Fetch widget data for a registered widget.
 */
export async function getWidgetData(sdk: MockSDK, widgetName: string, config: unknown = {}): Promise<unknown> {
  const widget = sdk._state.widgets.get(widgetName);
  if (!widget) throw new Error(`No widget registered with name "${widgetName}"`);
  return widget.dataHandler(config);
}

/**
 * Emit a host event to all subscribers on this topic.
 */
export async function emitEvent(sdk: MockSDK, topic: string, payload: unknown): Promise<void> {
  const handlers = sdk._state.eventSubscriptions.get(topic) ?? [];
  await Promise.all(handlers.map((h) => h(payload)));
}

/**
 * Get all messages sent via sdk.channel.send() since mock creation.
 */
export function getSentMessages(sdk: MockSDK) {
  return sdk._state.sentMessages;
}

/**
 * Get all events published via sdk.events.publish().
 */
export function getPublishedEvents(sdk: MockSDK) {
  return sdk._state.publishedEvents;
}

/**
 * Reset all state (messages, storage, memory, tasks, events).
 * Keeps registered tools, schedules, and widgets.
 */
export function resetState(sdk: MockSDK): void {
  sdk._state.sentMessages.length = 0;
  sdk._state.notifications.length = 0;
  sdk._state.publishedEvents.length = 0;
  sdk._state.createdTaskIds.length = 0;
  sdk._state.memory.clear();
  sdk._state.storage.clear();
  sdk._state.tasks.clear();
  sdk._state.eventSubscriptions.clear();
}
