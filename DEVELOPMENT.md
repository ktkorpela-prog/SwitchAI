# SwitchAI — Development Notes

## Project Status
Scaffold complete. Phase 1 (MVP) built and running.

## Quick Start (after clone)
```bash
cd SwitchAI
cp .env.example .env       # Add your API key(s)
npm run install:all        # Installs root + client deps
npm start                  # Builds client, starts server
```
Then open http://localhost:3000

For hot-reload during development:
```bash
npm run dev
```

---

## Environment Setup (`.env`)

| Variable               | Required | Notes                              |
|------------------------|----------|------------------------------------|
| `PORT`                 | No       | Default: 3000                      |
| `ROOM_SECRET`          | Yes      | Random string, used for room auth  |
| `ANTHROPIC_API_KEY`    | No       | Enables `@claude`                  |
| `OPENAI_API_KEY`       | No       | Enables `@gpt4`                    |
| `GOOGLE_GEMINI_API_KEY`| No       | Enables `@gemini`                  |
| `MISTRAL_API_KEY`      | No       | Enables `@mistral`                 |
| `TAVILY_API_KEY`       | No       | Enables `+web` search flag         |

At least one API key is required for AI responses. Missing keys disable that model gracefully — they do not break the app.

**Getting API keys:**
- Anthropic: console.anthropic.com
- OpenAI: platform.openai.com/api-keys
- Google: aistudio.google.com
- Mistral: console.mistral.ai

**⚠️ OpenAI gotcha:** A ChatGPT Plus subscription does NOT include API access. They run on separate billing ledgers. You must enable billing at platform.openai.com/settings/billing before API calls will work. A 401 error is almost always this.

---

## How Rooms Work

Rooms are stored as plain files under `/server/rooms/{room-id}/`:

```
/server/rooms/my-room/
  history.md      ← append-only conversation log
  context.md      ← shared AI memory / system prompt
  members.md      ← member list with roles
  settings.json   ← friction sliders + enabled models
  /uploads        ← file attachments
```

To reset a room, delete its folder and restart.

---

## Adding a New AI Model

1. Create `/server/models/{modelname}.js` with this interface:
   ```js
   function isConfigured() { return !!process.env.YOUR_API_KEY; }
   async function call(messages, systemPrompt, frictionLevel, onChunk) { ... }
   module.exports = { call, isConfigured };
   ```
2. Register it in `server/models/router.js` — add to `MODEL_MAP`
3. Add the API key variable to `.env.example`
4. Add the badge colour to `client/src/constants.js`

---

## Development Phases

| Phase | Status | Description |
|-------|--------|-------------|
| 1 — Core MVP       | ✅ Done   | Server, Socket.io, Claude, React UI, markdown persistence |
| 2 — Multi-Model    | ✅ Done   | GPT-4, Gemini, Mistral, @everyone, friction slider |
| 3 — Files & Memory | 🔲 Next   | File upload UI, context.md editor, reply-to-message |
| 4 — Polish         | 🔲 Later  | Light mode, reconnection, @mention autocomplete, onboarding |

### Web Search (`+web` flag)

Add `TAVILY_API_KEY` to `.env` to enable. Get a free key at https://app.tavily.com (2000 queries/month free).

Usage: `@claude +web what happened in the news today?`

Works with all models. The search runs server-side, results are injected as context before the model call. Messages using `+web` show a blue `web` badge in chat.

---

## Known Issues / TODO

- [ ] File upload UI wired on frontend (backend route exists, paperclip button is placeholder)
- [ ] context.md editor in sidebar (backend route exists, UI not built)
- [ ] Reply-to-message (quoted preview)
- [x] Member presence — show all users currently in the room in real time (green dot = online, gray = offline)
- [ ] Light/dark mode toggle
- [ ] Replace OpenAI API key — previous key was accidentally exposed, revoke at platform.openai.com/api-keys

---

## Repository

GitHub: https://github.com/ktkorpela-prog/SwitchAI
Spec: `SwitchAI_Spec_v1.0.docx` (in Documents)
Licence: MIT
