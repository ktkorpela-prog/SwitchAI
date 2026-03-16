# SwitchAI — Session Changelog
**Date:** 2026-03-16
**Branch:** add-oss-files (PR #4 → main)

---

## Features Added

### Real-time member presence
- Sidebar now shows a green dot for online users and gray for offline
- Server tracks connected users per room via Socket.io
- Updates in real time on join, disconnect, and kick

### Web search (`+web` flag)
- Add `+web` to any `@mention` to fetch live search results before the model replies
- Example: `@claude +web latest AI news`
- Powered by Tavily (free tier, 1,000 searches/month)
- Blue `web` badge shown on messages that used `+web`
- Requires `TAVILY_API_KEY` in `.env`

### Token-efficient context pipeline
- Three new server modules: `tokenizer.js`, `promptClassifier.js`, `contextBuilder.js`
- **Minimal mode** — short/trivial prompts (greetings, yes/no, <30 chars) send only the last 3 messages with a 256-token output cap
- **Normal mode** — sends recent history up to `MAX_CONTEXT_TOKENS` (default 8,000), newest first
- Hard ceiling at `HARD_REQUEST_TOKEN_CEILING` (default 12,000) rejects oversized requests
- All 4 models now cap output via `max_tokens`
- AI messages show `input→output tok` split and context mode badge

### Paginated history load
- On rejoin, only the last 100 messages load — no more full-history scroll
- "Load older messages" button appears at the top of chat when more history exists
- Fully backward compatible — history.md is unchanged

### Archive history (Owner only)
- New "Archive history" button in sidebar for room Owners
- Saves `history.md` to a timestamped archive file (`history-archive-YYYY-MM-DDT....md`)
- Resets chat to a clean slate for all users in the room
- Nothing is deleted — archive is kept on the server

---

## Security Fixes (9 total)

| # | Issue | Fix |
|---|-------|-----|
| 1 | Path traversal in file downloads | `path.basename()` + path containment check in `files.js` |
| 2 | Directory traversal via `roomId` | Allowlist regex `[a-z0-9-]` enforced in routes and socket handler |
| 3 | Predictable upload filenames | Switched to `crypto.randomUUID()` + extension whitelist |
| 4 | XSS via ReactMarkdown | Custom components block `javascript:` and `data:` URIs |
| 5 | Username pipe injection into `members.md` | `escapeMd()` applied before all markdown writes |
| 6 | Invite code brute-force | `express-rate-limit` on `/api/rooms/join` (10 attempts / 15 min / IP) |
| 7 | Security headers | `helmet` added; Socket.io CORS changed from `*` to same-origin; HSTS disabled for LAN |
| 8 | Prompt injection via `+web` | Search results sanitized, truncated, labelled "reference only" |
| 9 | `ROOM_SECRET` unused | Now enforced as server password required to create rooms |

---

## Open Source Files Added

- **LICENSE** — MIT licence
- **CONTRIBUTING.md** — contributor guide
- **SECURITY.md** — responsible disclosure policy (hello@essentianlabs.com)

---

## Documentation Updates

- **README.md** — added web search, member presence, token pipeline, new env vars table, updated project structure
- **DEVELOPMENT.md** — all phases marked complete, web search section added, security fixes documented
- **`.env.example`** — added `TAVILY_API_KEY`, `ALLOWED_ORIGINS`, 10 token/context config vars, `ROOM_SECRET` clarified

---

## New Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `TAVILY_API_KEY` | — | Enables `+web` search |
| `ALLOWED_ORIGINS` | — | Comma-separated origins for Socket.io CORS |
| `MAX_CONTEXT_TOKENS` | `8000` | Max history tokens per request |
| `MAX_RECENT_MESSAGES` | `30` | Max message blocks from history |
| `MAX_CONTEXT_CHARS` | `32000` | Max chars from context.md |
| `MAX_OUTPUT_TOKENS_DEFAULT` | `1024` | Output cap for normal prompts |
| `MAX_OUTPUT_TOKENS_SHORT_REPLY` | `256` | Output cap for trivial prompts |
| `MAX_OUTPUT_TOKENS_LONG_REPLY` | `4096` | Output cap for extended mode |
| `LOW_CONTEXT_MESSAGE_CHAR_THRESHOLD` | `120` | Char threshold for minimal mode |
| `HARD_REQUEST_TOKEN_CEILING` | `12000` | Absolute max tokens before rejection |
| `ENABLE_TOKEN_DEBUG` | `false` | Log context decisions to server console |

---

## New Dependencies

| Package | Purpose |
|---------|---------|
| `helmet` | Security headers (CSP, X-Frame-Options, etc.) |
| `express-rate-limit` | Rate limiting on join endpoint |

---

## Known Issues / TODOs Carried Forward

- [ ] Investigate "Leave room" button — Karina unable to exit room and return to onboarding page
- [ ] Replace exposed OpenAI API key — revoke at platform.openai.com/api-keys
