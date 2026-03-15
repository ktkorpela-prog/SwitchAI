# Contributing to SwitchAI

Thanks for your interest in contributing! SwitchAI is intentionally simple and self-hosted — please keep that spirit in mind.

## How to contribute

1. **Fork** the repo and create a branch from `main`
2. **Make your changes** — keep them focused and minimal
3. **Test locally** with `npm run dev` before submitting
4. **Open a pull request** with a clear description of what you changed and why

## Guidelines

- Keep the stack: Node.js / Express / Socket.io / React / Tailwind — no new frameworks
- No database — markdown and JSON file persistence is intentional
- New AI models are welcome — follow the pattern in `server/models/` and update `DEVELOPMENT.md`
- If you're fixing a bug, include steps to reproduce it in the PR description
- If you're adding a feature, open an issue first to discuss it

## Reporting bugs

Open a [GitHub issue](https://github.com/ktkorpela-prog/SwitchAI/issues) with steps to reproduce, your OS, and Node.js version.

## Security issues

See [SECURITY.md](SECURITY.md).
