/**
 * @kapsel/sdk-mock
 * In-memory mock host for testing Kapsel extensions.
 *
 * @example
 * ```typescript
 * import { createMockSdk, triggerSchedule, getSentMessages } from '@kapsel/sdk-mock';
 * import { activate } from '../src/index.js';
 *
 * test('sends daily report', async () => {
 *   const sdk = createMockSdk({
 *     connections: {
 *       stripe: { type: 'api_key', data: { key: 'sk_test_...' } },
 *     },
 *   });
 *
 *   await activate(sdk);
 *   await triggerSchedule(sdk, 'daily_report');
 *
 *   const messages = getSentMessages(sdk);
 *   expect(messages).toHaveLength(1);
 *   expect(messages[0]?.text).toContain('MRR');
 * });
 * ```
 */

export { createMockSdk } from './MockKapselSDK.js';
export type { MockSentMessage, MockNotification, MockSDKOptions, MockSDKState } from './MockKapselSDK.js';
export {
  triggerSchedule,
  invokeTool,
  getWidgetData,
  emitEvent,
  getSentMessages,
  getPublishedEvents,
  resetState,
} from './helpers.js';
