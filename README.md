# SwitchAI

> A shared AI channel for families and teams — split the cost, keep the conversation.

SwitchAI is an open source, real-time shared chat room where multiple humans interact with multiple AI models in a single chronological thread. Think Slack — but the channel has AI participants who listen to everything and respond only when addressed directly.

---

## Prerequisites

- [Node.js 20+](https://nodejs.org/)
- At least one AI API key (Anthropic, OpenAI, Google, or Mistral)

## Quick Start

```bash
git clone https://github.com/ktkorpela-prog/SwitchAI.git
cd SwitchAI
cp .env.example .env        # Add your API key(s)
npm run install:all
npm start
```

Then open [http://localhost:3000](http://localhost:3000).

---

## Adding Models

Edit `.env` and add the API key for any model you want to enable:

| Model     | Env Variable            | @mention   |
|-----------|-------------------------|------------|
| Claude    | `ANTHROPIC_API_KEY`     | `@claude`  |
| GPT-4     | `OPENAI_API_KEY`        | `@gpt4`    |
| Gemini    | `GOOGLE_GEMINI_API_KEY` | `@gemini`  |
| Mistral   | `MISTRAL_API_KEY`       | `@mistral` |

Use `@everyone` to ask all configured models at once.

---

## How context.md Works

Every room has a `context.md` file — the shared brain. Everything in it is prepended to every model's system prompt. Edit it via the sidebar (Owner only) to set preferences, ongoing projects, and house rules for your AI.

---

## How the Friction Slider Works

Each model has a friction level (0–10) set by the room Owner:

| Value | Behaviour |
|-------|-----------|
| 0     | Fully supportive — validates, encourages |
| 5     | Neutral — direct and balanced (default) |
| 10    | Devil's advocate — challenges everything |

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Adding a new model is intentionally simple — see [Extending SwitchAI](#extending-switchai) in the spec.

## Licence

[MIT](LICENSE)
