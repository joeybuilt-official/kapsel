import { describe, test, expect, beforeEach } from 'vitest';
import { createMockSdk, triggerSchedule, getSentMessages, invokeTool, resetState } from '@kapsel/sdk-mock';
import { activate } from './index.js';

const mockStripeCredentials = {
  stripe: { type: 'api_key' as const, data: { key: 'sk_test_mock' } },
};

describe('skill-stripe-monitor', () => {
  let sdk: ReturnType<typeof createMockSdk>;

  beforeEach(async () => {
    sdk = createMockSdk({ connections: mockStripeCredentials });
    await activate(sdk);
  });

  test('registers expected tools', () => {
    expect(sdk._state.tools.has('stripe_get_mrr')).toBe(true);
    expect(sdk._state.tools.has('stripe_get_customers')).toBe(true);
  });

  test('registers daily_revenue_report schedule', () => {
    expect(sdk._state.schedules.has('daily_revenue_report')).toBe(true);
  });

  test('registers mrr_card widget', () => {
    expect(sdk._state.widgets.has('mrr_card')).toBe(true);
  });
});
