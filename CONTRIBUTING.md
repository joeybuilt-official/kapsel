# Contributing to Kapsel

Kapsel is an open protocol. Contributions that improve the spec, tooling, or ecosystem are welcome.

## How to Contribute

### Spec Changes

1. Open an issue describing the problem or gap.
2. Discuss in the issue until there's rough consensus.
3. Submit a PR against `specification/kapsel-protocol.md`.
4. PRs require at least one review from a maintainer.

### Bug Reports

If something in the spec is ambiguous, contradictory, or incomplete — open an issue. Include:
- Which section is affected
- What's unclear or broken
- A suggested fix (if you have one)

### Host Implementations

Building a Kapsel-compatible host? Open an issue to register it. We track implementations to validate the spec against real-world usage.

### Extensions

Building extensions? Report friction points as issues. The spec should make extension development straightforward — if it doesn't, that's a spec bug.

## Code of Conduct

Be constructive. Disagree on substance, not on people. The goal is a protocol that works for everyone.

## License

All contributions to the spec and reference implementations are licensed under Apache 2.0. By contributing, you agree to license your contribution under the same terms.

## Spec Versioning

The spec follows semver:
- **Patch** (0.2.x): Clarifications, typo fixes
- **Minor** (0.x.0): New optional features, backwards compatible
- **Major** (x.0.0): Breaking changes

During 0.x, breaking changes may occur in minor versions. After 1.0, the spec follows strict semver.
