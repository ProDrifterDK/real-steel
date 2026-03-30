# Real Steel Integration Test Guide

Corresponds to plan Tasks 14 (smoke test) and 15 (two-user integration test).

**Prerequisites:** Run `npm run build` before starting. All commands run from the project root.

---

## Test 1: Smoke Test — Serve + Join (Spectator)

Verifies: server starts, TUI connects, header renders, input works.

**Terminal 1 — Server:**
```bash
node dist/cli.js serve --port 3000 --url ws://localhost:3000
```

Expected output:
```
Ring server running locally on ws://localhost:3000
Public URL: ws://localhost:3000
Share this URL with other participants.
```

**Terminal 2 — Join (no Claude):**
```bash
node dist/cli.js join ws://localhost:3000 --name Pedro --no-claude
```

Verify:
- [x] TUI renders with header showing "Real Steel" and `ws://localhost:3000`
- [x] Connection indicator shows connected
- [x] Input bar appears at bottom with `>` prompt
- [x] You can type and press Enter — your message appears in the chat (fixed: commit 07f92a9)
- [ ] Timestamp shows next to your message

> **Bug found & fixed (2026-03-30):** ChatView.tsx had `{'  '}` (bare text outside `<Text>`)
> causing Ink crash on first message. Also wasn't using MessageBubble component.
> Fixed in commit `07f92a9`. Rebuild with `npm run build` before retesting.

**Cleanup:** Ctrl+C in both terminals.

---

## Test 2: Two Users — Message Exchange

Verifies: broadcast works, both users see each other's messages and system events.

**Terminal 1 — Server:**
```bash
node dist/cli.js serve --port 3000 --url ws://localhost:3000
```

**Terminal 2 — Pedro:**
```bash
node dist/cli.js join ws://localhost:3000 --name Pedro --no-claude
```

**Terminal 3 — Samuel:**
```bash
node dist/cli.js join ws://localhost:3000 --name Samuel --no-claude
```

Verify:
- [ ] Pedro sees a system event when Samuel joins ("Samuel has joined the ring")
- [ ] Samuel sees Pedro's earlier join in the catch-up buffer
- [ ] Pedro types "hello" → Samuel sees it with Pedro's name and timestamp
- [ ] Samuel types "hi there" → Pedro sees it with Samuel's name and timestamp
- [ ] Header participant count updates when users join/leave
- [ ] Date separator appears (e.g., "── 30 de marzo, 2026 ──")

**Cleanup:** Ctrl+C in all terminals. Verify Pedro sees Samuel's leave event before closing.

---

## Test 3: Claude Daemon Integration

Verifies: daemon connects, Claude responds after debounce, agent messages render with styling.

**Terminal 1 — Server:**
```bash
node dist/cli.js serve --port 3000 --url ws://localhost:3000
```

**Terminal 2 — Chat TUI (spectator):**
```bash
node dist/cli.js join ws://localhost:3000 --name Pedro --no-claude
```

**Terminal 3 — Join with Claude daemon:**
```bash
node dist/cli.js join ws://localhost:3000 --name Pedro --privacy claude-decides
```

> Note: Terminal 3 starts both a TUI and a daemon. The daemon connects as `Claude-Pedro`.

Verify:
- [ ] Terminal 2 sees system event: "Claude-Pedro has joined the ring"
- [ ] Terminal 2 sees system event: "Pedro has joined the ring" (from Terminal 3's TUI)
- [ ] Header participant count increases
- [ ] Type a question in Terminal 2 (e.g., "What files are in this project?")
- [ ] After ~5 seconds (debounce), Claude-Pedro responds in the chat
- [ ] Claude's response shows with magenta name color and robot emoji prefix
- [ ] Claude's markdown renders (bold, code blocks, etc.)

**If Claude doesn't respond:**
- Check Terminal 3 stderr for daemon logs (`[daemon] Connected to ring as Claude-Pedro`)
- Ensure `claude` CLI is installed and available in PATH
- Try a simpler prompt: "Say hello"
- Check rate limiting: only 2 invocations per minute by default

**Cleanup:** Ctrl+C in all terminals.

---

## Test 4: Privacy Modes (Optional)

Verifies: privacy flags are accepted and passed to daemon.

**Whitelist mode:**
```bash
node dist/cli.js join ws://localhost:3000 --name Pedro \
  --privacy whitelist --privacy-paths /home/user/project-a /home/user/project-b
```

**Blacklist mode:**
```bash
node dist/cli.js join ws://localhost:3000 --name Pedro \
  --privacy blacklist --privacy-paths .env credentials.json
```

Verify:
- [ ] Commands start without errors
- [ ] Daemon logs show connection

---

## Test 5: Spectator Mode (Optional)

Verifies: `--no-claude` prevents daemon from starting.

```bash
node dist/cli.js join ws://localhost:3000 --name Observer --no-claude
```

Verify:
- [ ] Only one system event: "Observer has joined the ring" (no "Claude-Observer")
- [ ] TUI works normally for reading and sending messages
- [ ] No Claude responses to messages from this user

---

## Results Summary

| Test | Status | Notes |
|------|--------|-------|
| 1. Smoke test (serve + join) | | |
| 2. Two users (message exchange) | | |
| 3. Claude daemon integration | | |
| 4. Privacy modes (optional) | | |
| 5. Spectator mode (optional) | | |
