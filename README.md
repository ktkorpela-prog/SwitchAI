# SwitchAI

**Self-hosted shared AI chat rooms for households and small teams.**

One person pays for the API keys. Everyone else joins free via an invite code. All AI models participate in a single chronological thread — switch between them mid-conversation without losing context.

> Open source · MIT licence · No accounts · No cloud

---

## Features

- **Multi-model chat** — Claude, GPT-4, Gemini, and Mistral in the same thread
- **@mention routing** — `@claude`, `@gpt4`, `@gemini`, `@mistral`, or `@everyone`
- **Web search** — add `+web` to any message to fetch live results before the model replies (`@claude +web latest AI news`)
- **Shared context** — all models read the same history; no re-explaining when you switch
- **Friction sliders** — tune each model from "supportive" to "devil's advocate" (0–10)
- **Streaming responses** with per-message input/output token counts and a Stop button
- **File & image uploads** — drag-and-drop or paste from clipboard
- **Reply threading** — quote any message when replying
- **Persistent room memory** — `context.md` prepended to every model's system prompt
- **Real-time member presence** — sidebar shows who is currently online (green) or offline (gray)
- **Member management** — Owner can view all members and kick someone
- **API key manager** — enter keys in-app; stored locally in `keys.local.json`, never shared
- **Token-efficient context pipeline** — short/trivial prompts use minimal context automatically; hard limits prevent runaway costs
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

## Web Search (`+web`)

Add `+web` to any `@mention` message to fetch live search results before the model replies:

```
@claude +web what happened in the news today?
@everyone +web latest developments in fusion energy
```

Results are fetched server-side via [Tavily](https://app.tavily.com) (free tier: 1,000 searches/month) and injected as context. The model sees them as provided information — it does not browse the web itself. Messages using `+web` show a blue **web** badge in chat.

To enable, add `TAVILY_API_KEY` to your `.env`.

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

## Context & Token Limits

SwitchAI automatically manages how much history is sent to each model:

- **Minimal mode** — triggered for short or trivial prompts (greetings, yes/no, <30 chars). Sends the last 3 messages only with a 256-token output cap.
- **Normal mode** — sends recent history up to `MAX_CONTEXT_TOKENS` (default 8,000), newest messages first, oldest dropped when the budget is full. Output capped at 1,024 tokens.
- **Hard ceiling** — if estimated input exceeds `HARD_REQUEST_TOKEN_CEILING` (default 12,000), the request is rejected with an inline error rather than sending a runaway call.

Token usage per message is shown as `input→output tok` on each AI response.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `ROOM_SECRET` | — | Required. Random string for room auth |
| `ANTHROPIC_API_KEY` | — | Enables `@claude` |
| `OPENAI_API_KEY` | — | Enables `@gpt4` |
| `GOOGLE_GEMINI_API_KEY` | — | Enables `@gemini` |
| `MISTRAL_API_KEY` | — | Enables `@mistral` |
| `TAVILY_API_KEY` | — | Enables `+web` search flag |
| `MAX_CONTEXT_TOKENS` | `8000` | Max history tokens per request |
| `MAX_RECENT_MESSAGES` | `30` | Max message blocks from history |
| `MAX_CONTEXT_CHARS` | `32000` | Max chars from context.md |
| `MAX_OUTPUT_TOKENS_DEFAULT` | `1024` | Output cap for normal prompts |
| `MAX_OUTPUT_TOKENS_SHORT_REPLY` | `256` | Output cap for trivial prompts |
| `MAX_OUTPUT_TOKENS_LONG_REPLY` | `4096` | Output cap for extended mode |
| `LOW_CONTEXT_MESSAGE_CHAR_THRESHOLD` | `120` | Char length below which trivial patterns trigger minimal mode |
| `HARD_REQUEST_TOKEN_CEILING` | `12000` | Absolute max tokens before request is rejected |
| `ENABLE_TOKEN_DEBUG` | `false` | Log context decisions to server console |

---

## Project Structure

```
SwitchAI/
├── server/
│   ├── index.js              # Express + Socket.io entry point
│   ├── keystore.js           # API key storage (keys.local.json)
│   ├── search.js             # Tavily web search (+web flag)
│   ├── tokenizer.js          # Token estimation utility
│   ├── promptClassifier.js   # Classifies prompts → minimal / normal mode
│   ├── contextBuilder.js     # Layered context builder with budget enforcement
│   ├── models/
│   │   ├── router.js         # @mention parser, context pipeline, stream orchestration
│   │   ├── claude.js
│   │   ├── openai.js
│   │   ├── gemini.js
│   │   └── mistral.js
│   └── routes/
│       ├── rooms.js          # Room CRUD, history, members, context
│       ├── files.js          # File upload/serve (Multer)
│       └── keys.js           # API key management endpoints
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
└── .env                      # Local config (gitignored)
```

---

## Contributing

Adding a new model is intentionally simple:
1. Create `server/models/yourmodel.js` following the pattern of the existing model files
2. Register it in `server/models/router.js` and `client/src/constants.js`

---

## Licence

[MIT](LICENSE) — built with ❤️ by [ktkorpela-prog](https://github.com/ktkorpela-prog).
