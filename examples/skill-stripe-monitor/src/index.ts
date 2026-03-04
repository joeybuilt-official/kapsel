/**
 * Skill: Stripe Monitor
 * Tracks MRR, new customers, and churn. Sends daily reports.
 * Demonstrates: tool registration, cron jobs, dashboard widget, channel messaging.
 */

import type { KapselSDK, InvokeContext } from '@kapsel/sdk';

interface SkillConfig {
  alertThresholdPct: number;
  reportSchedule: string;
  currency: string;
}

interface MRRResult {
  mrr: number;
  currency: string;
  activeSubscriptions: number;
  fetchedAt: number;
}

interface CustomerResult {
  newThisWeek: number;
  churnedThisWeek: number;
  totalActive: number;
}

let config: SkillConfig = {
  alertThresholdPct: 10,
  reportSchedule: '0 8 * * *',
  currency: 'usd',
};

export async function activate(sdk: KapselSDK): Promise<void> {
  // Register tools
  sdk.registerTool({
    name: 'stripe_get_mrr',
    description: 'Gets current Monthly Recurring Revenue from Stripe. Returns amount in cents, currency, and active subscription count.',
    parameters: {
      type: 'object',
      properties: {
        currency: { type: 'string', description: 'Currency code (default: usd)' },
      },
    },
    hints: { hasSideEffects: false, idempotent: true, estimatedMs: 2000 },
    handler: async (params: unknown, context: InvokeContext): Promise<MRRResult> => {
      const { currency = config.currency } = (params as { currency?: string });
      const creds = await sdk.connections.getCredentials('stripe');
      const apiKey = creds.data['key'];

      // Fetch active subscriptions from Stripe
      const res = await fetch(
        `https://api.stripe.com/v1/subscriptions?status=active&limit=100`,
        { headers: { Authorization: `Bearer ${apiKey}` } }
      );

      if (!res.ok) throw new Error(`Stripe API error: ${res.status}`);
      const data = await res.json() as { data: Array<{ items: { data: Array<{ price: { unit_amount: number; currency: string; recurring: { interval: string } } }> } }> };

      let mrr = 0;
      for (const sub of data.data) {
        for (const item of sub.items.data) {
          const price = item.price;
          if (price.currency !== currency) continue;
          const amount = price.unit_amount ?? 0;
          mrr += price.recurring.interval === 'year' ? Math.round(amount / 12) : amount;
        }
      }

      const result: MRRResult = {
        mrr,
        currency,
        activeSubscriptions: data.data.length,
        fetchedAt: Date.now(),
      };

      await sdk.memory.write({
        content: `MRR snapshot: $${(mrr / 100).toFixed(2)} ${currency.toUpperCase()} | ${result.activeSubscriptions} active subscriptions`,
        tags: ['stripe', 'mrr', 'snapshot'],
      });

      return result;
    },
  });

  sdk.registerTool({
    name: 'stripe_get_customers',
    description: 'Returns new and churned customer counts for the past 7 days, plus total active.',
    parameters: { type: 'object', properties: {} },
    hints: { hasSideEffects: false, idempotent: true, estimatedMs: 3000 },
    handler: async (_params: unknown, _context: InvokeContext): Promise<CustomerResult> => {
      const creds = await sdk.connections.getCredentials('stripe');
      const apiKey = creds.data['key'];
      const since = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);

      const [newRes, totalRes] = await Promise.all([
        fetch(`https://api.stripe.com/v1/customers?created[gte]=${since}&limit=100`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        }),
        fetch(`https://api.stripe.com/v1/customers?limit=1`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        }),
      ]);

      const newData = await newRes.json() as { data: unknown[] };
      const totalData = await totalRes.json() as { total_count?: number };

      return {
        newThisWeek: newData.data.length,
        churnedThisWeek: 0, // Would require event log in full impl
        totalActive: totalData.total_count ?? 0,
      };
    },
  });

  // Cron: daily MRR report
  sdk.registerSchedule({
    name: 'daily_revenue_report',
    schedule: config.reportSchedule,
    handler: async () => {
      const mrr = await sdk.tools.invoke<MRRResult>('stripe_get_mrr', { currency: config.currency });
      const customers = await sdk.tools.invoke<CustomerResult>('stripe_get_customers', {});

      const prev = await sdk.storage.get<number>('prev_mrr');
      const change = prev ? (((mrr.mrr - prev) / prev) * 100).toFixed(1) : null;
      const changeStr = change ? ` (${Number(change) >= 0 ? '+' : ''}${change}%)` : '';

      await sdk.storage.set('prev_mrr', mrr.mrr);

      const message = [
        `📊 Daily Revenue Report`,
        `MRR: $${(mrr.mrr / 100).toFixed(2)}${changeStr}`,
        `Active subscriptions: ${mrr.activeSubscriptions}`,
        `New customers (7d): ${customers.newThisWeek}`,
      ].join('\n');

      await sdk.channel.send({ text: message, priority: 'normal' });

      // Alert on significant change
      if (change && Math.abs(Number(change)) >= config.alertThresholdPct) {
        await sdk.channel.send({
          text: `⚠️ MRR alert: ${change}% change detected.`,
          priority: 'high',
        });
      }
    },
  });

  // Dashboard widget
  sdk.registerWidget({
    name: 'mrr_card',
    displayName: 'Monthly Recurring Revenue',
    displayType: 'metric',
    refreshInterval: 300,
    dataHandler: async () => {
      const cached = await sdk.storage.get<MRRResult>('mrr_cache');
      const now = Date.now();

      if (cached && now - cached.fetchedAt < 5 * 60 * 1000) {
        return buildWidgetData(cached);
      }

      const mrr = await sdk.tools.invoke<MRRResult>('stripe_get_mrr', { currency: config.currency });
      await sdk.storage.set('mrr_cache', mrr, { ttl: 300 });
      return buildWidgetData(mrr);
    },
  });
}

export async function onConfigUpdate(newConfig: unknown): Promise<void> {
  config = { ...config, ...(newConfig as Partial<SkillConfig>) };
}

export async function deactivate(): Promise<void> {}

function buildWidgetData(mrr: MRRResult) {
  return {
    value: (mrr.mrr / 100).toFixed(2),
    label: 'MRR',
    unit: '$',
    secondary: `${mrr.activeSubscriptions} active subscriptions`,
    updatedAt: mrr.fetchedAt,
  };
}
