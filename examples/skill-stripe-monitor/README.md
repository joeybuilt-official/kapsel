# skill-stripe-monitor

Example [Kapsel](https://kapsel.sh) skill extension. Tracks Stripe MRR, sends daily revenue reports, and shows an MRR dashboard widget.

**Demonstrates:**
- Tool registration with parameters and hints
- Cron job scheduling
- Dashboard widget registration
- `sdk.connections.getCredentials()` for Stripe API access
- `sdk.storage` for caching and state
- `sdk.memory.write()` for leaving searchable records
- `sdk.channel.send()` for messaging
- Testing with `@kapsel/sdk-mock`

## Capabilities Required

```json
["memory:read", "memory:write", "connections:stripe", "channel:send",
 "schedule:register", "ui:register-widget", "storage:read", "storage:write"]
```

## Running Tests

```bash
pnpm test
```

The tests use `@kapsel/sdk-mock` — no Stripe account or running host needed.
