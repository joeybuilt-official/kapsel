# agent-devops

Example [Kapsel](https://kapsel.sh) agent extension. Handles deployment tasks and responds to failing CI.

**Demonstrates:**
- `shouldActivate` with type and keyword matching
- `plan` with one-way door declarations
- `executeStep` with conditional tool invocation
- `onEscalation` for failure handling
- Event subscriptions via `sdk.events.subscribe`
- Full agent contract implementation
