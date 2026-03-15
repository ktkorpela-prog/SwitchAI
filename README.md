# SwitchAI

**Self-hosted shared AI chat rooms for households and small teams.**

One person pays for the API keys. Everyone else joins free via an invite code. All AI models participate in a single chronological thread — switch between them mid-conversation without losing context.

> Open source · MIT licence · No accounts · No cloud

---

## Features

- **Multi-model chat** — Claude, GPT-4, Gemini, and Mistral in the same thread
- **@mention routing** — `@claude`, `@gpt4`, `@gemini`, `@mistral`, or `@everyone`
- **Shared context** — all models read the same history; no re-explaining when you switch
- **Friction sliders** — tune each model from "supportive" to "devil's advocate" (0–10)
- **Streaming responses** with per-message token counts and a Stop button
- **File & image uploads** — drag-and-drop or paste from clipboard
- **Reply threading** — quote any message when replying
- **Persistent room memory** — `context.md` prepended to every model's system prompt
- **Member management** — Owner can view all members and kick someone
- **API key manager** — enter keys in-app; stored locally in `keys.local.json`, never shared
- **Light / dark mode**
- **Session persistence** — survives page refresh with correct role
- **Reconnection UI** — auto-reconnects on network drop

---

## Quick Start

### Prerequisites

- Node.js 20+
- API key(s) for at least one model:
  - [Anthropic](https://console.anthropic.com/) — Claude
  - [OpenAI](https://platform.openai.com/) — GPT-4 *(requires billing, not ChatGPT Plus)*
  - [Google AI Studio](https://aistudio.google.com/) — Gemini
  - [Mistral](https://console.mistral.ai/) — Mistral

### Install & run

```bash
git clone https://github.com/ktkorpela-prog/SwitchAI
cd SwitchAI
npm run install:all   # installs server + client deps
```

Create a `.env` file in the project root (optional — you can also add keys in-app):

```env
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-proj-...
GOOGLE_GEMINI_API_KEY=AIza...
MISTRAL_API_KEY=...
PORT=3000
```

```bash
npm start             # builds client + starts server
```

Open [http://localhost:3000](http://localhost:3000).

### Local network (invite your household)

Find your machine's local IP (`ipconfig` on Windows, `ifconfig` on Mac/Linux) and share `http://YOUR_IP:3000` with anyone on the same Wi-Fi. They join with the invite code shown after creating a room.

---

## How It Works

| File | Purpose |
|------|---------|
| `server/rooms/<roomId>/history.md` | Append-only conversation log |
| `server/rooms/<roomId>/context.md` | Persistent room memory — prepended to every system prompt |
| `server/rooms/<roomId>/members.md` | Member list with roles and join timestamps |
| `server/rooms/<roomId>/settings.json` | Friction config, token totals, invite code |
| `keys.local.json` | API keys (gitignored, never shared) |

No database. Everything is plain text files.

---

## Adding Models

Models are enabled by providing their API key — either in `.env` at startup or via **Manage API Keys** in the sidebar (Owner only). Keys are stored in `keys.local.json` on your machine and are never sent to other clients.

| Model | Env Variable | @mention |
|-------|-------------|---------|
| Claude | `ANTHROPIC_API_KEY` | `@claude` |
| GPT-4 | `OPENAI_API_KEY` | `@gpt4` |
| Gemini | `GOOGLE_GEMINI_API_KEY` | `@gemini` |
| Mistral | `MISTRAL_API_KEY` | `@mistral` |

Use `@everyone` to ask all configured models at once.

---

## Friction Levels

Each model has a friction level (0–10) set by the room Owner:

| Range | Behaviour |
|-------|-----------|
| 0–1 | Warm and encouraging — focus on strengths |
| 2–3 | Kind and balanced — gentle honest feedback |
| 4–6 | Direct and balanced — honest, no bias (default) |
| 7–8 | Questioning — notes assumptions, asks for clarification |
| 9–10 | Devil's advocate — challenges everything |

---

## Room Context

Every room has a `context.md` file — the shared brain. Everything in it is prepended to every model's system prompt on every message. Edit it via **Edit room context** in the sidebar (Owner only) to set preferences, ongoing projects, and house rules.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `HISTORY_CONTEXT_LINES` | `50` | History blocks included in each model call |
| `ANTHROPIC_API_KEY` | — | Claude |
| `OPENAI_API_KEY` | — | GPT-4 |
| `GOOGLE_GEMINI_API_KEY` | — | Gemini |
| `MISTRAL_API_KEY` | — | Mistral |

---

## Project Structure

```
SwitchAI/
├── server/
│   ├── index.js           # Express + Socket.io entry point
│   ├── keystore.js        # API key storage (keys.local.json)
│   ├── models/
│   │   ├── router.js      # @mention parser, history builder, stream orchestration
│   │   ├── claude.js
│   │   ├── openai.js
│   │   ├── gemini.js
│   │   └── mistral.js
│   └── routes/
│       ├── rooms.js       # Room CRUD, history, members, context
│       ├── files.js       # File upload/serve (Multer)
│       └── keys.js        # API key management endpoints
├── client/
│   └── src/
│       ├── App.jsx
│       └── components/
│           ├── Onboarding.jsx
│           ├── ChatWindow.jsx
│           ├── Sidebar.jsx
│           ├── Message.jsx
│           ├── InputBar.jsx
│           ├── TypingIndicator.jsx
│           └── FrictionSlider.jsx
└── .env                   # API keys (gitignored)
```

---

## Contributing

Adding a new model is intentionally simple:
1. Create `server/models/yourmodel.js` following the pattern of the existing model files
2. Register it in `server/models/router.js` and `client/src/constants.js`

---

## Licence

[MIT](LICENSE) — built with ❤️ by [ktkorpela-prog](https://github.com/ktkorpela-prog).
