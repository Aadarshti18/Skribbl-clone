# 🎨 Doodle Dash — a skribbl.io Clone

A real-time multiplayer drawing-and-guessing game, inspired by [skribbl.io](https://skribbl.io). Built with **React + TypeScript + Vite** on the frontend and **Node.js + Express + Socket.IO** on the backend.

> **Live URL:** _add your deployed URL here after deploying, e.g. `https://your-skribbl-clone.onrender.com`_

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Setup & Local Development](#setup--local-development)
- [Environment Variables](#environment-variables)
- [Architecture Overview](#architecture-overview)
- [WebSocket Event Reference](#websocket-event-reference)
- [Code Walkthrough](#code-walkthrough)
- [Testing](#testing)
- [Deployment](#deployment)
- [Known Limitations / Future Ideas](#known-limitations--future-ideas)

---

## Features

**Must-have (all implemented):**
- Create a room with configurable settings (max players, rounds, draw time, word count, hints, word mode, public/private)
- Join a room via room code or invite link
- Lobby with live player list, ready state, host-only "Start game" control
- Turn-based rounds — one drawer per round, everyone else guesses, turns rotate so everyone draws
- Real-time canvas sync — every stroke is broadcast and rendered on all clients via Socket.IO
- Word selection — drawer picks 1 of N words; everyone else sees underscores (`_ _ a _ _`)
- Guessing — typed guesses are checked server-side (case/trim/accent-insensitive); correct guesses score points
- Scoring & leaderboard, with a winner announced at game end
- Drawing tools: brush with color palette, brush size, eraser, undo, clear canvas (drawer-only)

**Should-have (all implemented):**
- Hints — letters reveal progressively over the draw timer
- Chat — general chat always available; guesses route through chat input automatically while guessing is live
- Draw-time countdown with a visual ring timer
- Private rooms (invite-link only, hidden from any public listing)

**Nice-to-have (partially implemented):**
- ✅ Word categories (animals, objects, actions, food, places, misc) baked into the word bank
- ✅ Eraser tool
- ✅ Kick (host moderation)
- ✅ "Close guess" feedback (private to the guesser, via edit-distance check)
- ✅ Custom word list — host can add comma-separated words in the lobby; they're appended to (not a replacement for) the built-in bank
- ✅ Word modes: Normal / Hidden fully implemented; **Combination** is accepted as a setting (validated, stored, selectable in the lobby) but currently behaves identically to Normal — the spec marks this mode `(optional)`, so distinct combination-mode logic (e.g. mixing hidden + partial reveal) was deprioritized; see [Known Limitations](#known-limitations--future-ideas)
- ⬜ Votekick, ban, report, avatars beyond color-seeded circles, spectator mode, replay, multi-language word lists — not implemented; see [Known Limitations](#known-limitations--future-ideas)

---

## Tech Stack

| Layer      | Technology                                  |
|------------|----------------------------------------------|
| Frontend   | React 18 + TypeScript + Vite                |
| Canvas     | HTML5 Canvas API (custom drawing logic, no library) |
| Backend    | Node.js + Express                            |
| Realtime   | Socket.IO                                    |
| Routing    | React Router                                 |
| Database   | None for MVP — all state is in-memory per room (see [Limitations](#known-limitations--future-ideas)) |
| Word list  | Static categorized TS module (`server/src/data/words.ts`) |

No database was used for this MVP since rooms are ephemeral and the assignment marks persistence as optional. Swapping in Postgres/SQLite for room/score history would be a small, additive change (see Limitations).

---

## Project Structure

```
skribbl-clone/
├── package.json              # root convenience scripts (run client+server together)
├── render.yaml                # Render blueprint (server + static client)
├── .gitignore
│
├── server/                    # Express + Socket.IO backend
│   ├── package.json
│   ├── tsconfig.json
│   ├── railway.json           # Railway deploy config
│   ├── .env.example
│   ├── tests/                 # integration test scripts (see Testing section)
│   │   ├── test_flow.mjs
│   │   └── test_3player.mjs
│   └── src/
│       ├── index.ts                    # app entry point: Express + Socket.IO server
│       ├── types.ts                     # shared socket event payload types
│       ├── data/
│       │   └── words.ts                 # categorized word bank + random word picker
│       ├── utils/
│       │   └── wordUtils.ts              # guess matching, blanks/hints, settings validation
│       ├── models/
│       │   ├── Player.ts                 # Player class (score, drawing state, avatar)
│       │   ├── Game.ts                    # Game class (turn order, word state, scoring rules)
│       │   └── Room.ts                    # Room class (players, settings, timers, broadcasting)
│       └── managers/
│           ├── RoomManager.ts             # creates/looks up/destroys Room instances
│           ├── GameController.ts          # drives round flow: start → choose word → draw → tick → end
│           └── MessageHandler.ts          # wires every Socket.IO event to Room/Game logic
│
└── client/                    # React + TypeScript + Vite frontend
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    ├── vercel.json             # Vercel deploy config (static + rewrites)
    ├── netlify.toml             # Netlify deploy config (static + redirects)
    ├── .env.example
    ├── index.html
    └── src/
        ├── main.tsx                       # React root
        ├── App.tsx                         # routes: Home / Lobby / Game
        ├── index.css                       # design tokens + all component styles
        ├── vite-env.d.ts
        ├── types/
        │   └── socketTypes.ts               # mirrors server/src/types.ts (the shared contract)
        ├── context/
        │   ├── SocketContext.tsx             # single Socket.IO connection, exposed via hook
        │   └── GameContext.tsx               # central game state store; subscribes to every server event
        ├── pages/
        │   ├── HomePage.tsx                   # create room / join room
        │   ├── LobbyPage.tsx                   # room code, settings, player list, start button
        │   └── GamePage.tsx                    # main gameplay screen
        └── components/
            ├── DrawingCanvas.tsx                # canvas, pointer events, stroke sync, toolbar
            ├── ChatPanel.tsx                      # chat feed + guess/chat input
            ├── PlayersList.tsx                    # sidebar scoreboard with host kick controls
            ├── GameHeader.tsx                      # round counter, word blanks, countdown ring
            ├── WordPicker.tsx                      # drawer's word-choice modal
            └── EndOverlays.tsx                     # round-end banner + game-over leaderboard modal
```

---

## Setup & Local Development

### Prerequisites
- Node.js **v18+** (v20 recommended)
- npm v9+

### 1. Clone and install

```bash
git clone <your-repo-url>
cd skribbl-clone

# install root dev deps (concurrently) + both apps in one go
npm run install:all
```

(Or install each app separately: `cd server && npm install`, then `cd ../client && npm install`.)

### 2. Configure environment variables

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

The defaults work out of the box for local development — no editing needed unless you change ports.

### 3. Run both apps together

From the repo root:

```bash
npm run dev
```

This starts:
- the backend on **http://localhost:3001**
- the frontend on **http://localhost:5173**

Open `http://localhost:5173` in two or more browser tabs (or share your local IP with a friend on the same network) to test multiplayer locally.

> Prefer running them separately? Use `npm run dev:server` and `npm run dev:client` in two terminals.

### 4. Build for production

```bash
npm run build       # builds both server (tsc) and client (vite build)
npm start            # starts the compiled server (serves API + Socket.IO; pair with a static host for the client)
```

---

## Environment Variables

**`server/.env`**

| Variable        | Default                  | Description                                                        |
|-----------------|---------------------------|----------------------------------------------------------------------|
| `PORT`          | `3001`                    | Port the Express/Socket.IO server listens on                        |
| `CLIENT_ORIGIN` | `http://localhost:5173`  | Comma-separated list of allowed CORS/Socket.IO origins. Add your deployed frontend URL here. |

**`client/.env`**

| Variable           | Default                   | Description                                  |
|--------------------|-----------------------------|------------------------------------------------|
| `VITE_SERVER_URL`  | `http://localhost:3001`  | URL of the backend Socket.IO/Express server |

---

## Architecture Overview

### High-level flow

```
 ┌─────────────┐        Socket.IO (WebSocket)        ┌─────────────────┐
 │   Browser   │ ───────────────────────────────────▶ │  Express Server │
 │  (React UI) │ ◀─────────────────────────────────── │   + Socket.IO    │
 └─────────────┘        events (see table below)      └─────────────────┘
       │                                                        │
       │ renders                                                │ owns
       ▼                                                        ▼
 HTML5 <canvas>                                          RoomManager
 (local strokes drawn                                      └── Room (per game)
  immediately + remote                                          ├── players: Map<id, Player>
  strokes drawn from                                            ├── game: Game | null
  broadcast events)                                             └── GameController (round flow/timers)
```

Each browser tab holds exactly **one Socket.IO connection** (`client/src/context/SocketContext.tsx`). All game state in the React app — players, scores, current word blanks, chat, timers — lives in **`GameContext.tsx`**, which subscribes to every server-emitted event once and derives state from it. Components never talk to the socket directly except through the `useGame()` hook's action methods (`createRoom`, `sendGuess`, `emitDrawStart`, etc.), keeping the wire protocol in one place.

On the server, everything is modeled with plain OOP classes (per the assignment's bonus suggestion):

- **`Player`** — a participant: id, name, score, `isDrawing`/`hasGuessedCorrectly` flags, connection state.
- **`Game`** — pure game-state machine for *one* play-through of a room: turn order, current phase (`lobby → choosing_word → drawing → round_end → game_over`), the current word, revealed hint indices, and guess scoring math. Has no knowledge of sockets.
- **`Room`** — owns the player list, room settings, the active `Game` (if any), and timer handles; knows how to broadcast to its own Socket.IO room namespace (`room:<ID>`).
- **`RoomManager`** — the top-level registry: generates unique room codes, creates/looks up/destroys `Room`s.
- **`GameController`** — orchestrates *timing*: starting rounds, the per-second tick interval, scheduling the auto-word-pick timeout, scheduling the "next round in 4s" delay, and computing round-end/game-over transitions. Kept separate from `Game` so game *rules* and round *timing/orchestration* aren't tangled together.
- **`MessageHandler`** — the only class that touches `socket.on(...)`. Every inbound event is validated (room exists? are you the host? is it your turn?) before delegating into `Room`/`Game`/`GameController`.

### How drawing strokes are captured, sent, and rendered

1. **Capture (drawer only):** `DrawingCanvas.tsx` listens for native Pointer Events (`pointerdown/move/up`) on the `<canvas>`, which unifies mouse, touch, and stylus input. On `pointerdown` a new stroke gets a client-generated `strokeId` and is drawn locally immediately (no round-trip latency for the artist).
2. **Normalize:** coordinates are sent as numbers **normalized to the canvas's own width/height (0–1 range)**, not raw pixels — so two clients with different window sizes still render proportionally identical drawings.
3. **Send:** three events go to the server: `draw_start` (`x, y, color, size, tool`), `draw_move` (`x, y` only, many times per stroke), `draw_end` (`strokeId` only).
4. **Server validation + relay:** `MessageHandler` checks the sender is actually `game.currentDrawerId` and the phase is `drawing`, then re-broadcasts as a single unified `draw_data` event (`{ type: "start"|"move"|"end", stroke }`) to everyone in the room, **including the drawer**, so all clients render from the same source of truth.
5. **Render (everyone):** `GameContext` forwards `draw_data` events to whichever component subscribed via `onDrawData()`. `DrawingCanvas` keeps an in-progress `Map<strokeId, StrokeRecord>` for remote strokes; on `end` the finished stroke moves into a permanent `strokesRef` array. A single `redrawAll()` clears and replays every stored stroke each time something changes — simple and fast enough at this scale (small per-room canvases), and trivially supports **undo** (pop the last stroke, redraw) and **clear** (empty the array, redraw).

### How game state (rounds, turn order, scoring) is managed

- `Game.drawerOrder` is a snapshot of player IDs taken when `start_game` fires; `Game.drawerIndex` walks through it. When `drawerIndex` would run past the end of the array, it wraps to `0` **and** increments `Game.round`. The game ends once the last drawer in rotation finishes their turn in the final round (computed in `GameController.finishRound`, see inline comments — this exact boundary condition was unit-tested with a 3-player/2-round scenario to confirm rotation, round counting, and end-of-game detection are all correct).
- A round ends for one of three reasons, all funneled through `GameController.finishRound(reason)`: `"time_up"` (the per-second tick interval hits zero), `"all_guessed"` (every connected non-drawer has guessed correctly), or `"drawer_left"` (the current drawer disconnects mid-round).
- Scoring: a correct guess awards `max(10, round(50 + timeLeftRatio * 100))` points to the guesser (faster guesses score more), plus a flat `+10` to the drawer per correct guess received — rewarding drawers for choosing a "guessable" drawing style, not just the guessers.
- Disconnect handling: if a non-drawer disconnects mid-game they're marked `connected: false` (so the UI can show a 📡 icon) and skipped in future turn rotation, but kept in the player list with their score intact in case of reconnect-by-rejoin. If the **host** disconnects, the next connected player is automatically promoted to host.

### How WebSockets are used for real-time sync

Every player connects once via Socket.IO; on `create_room`/`join_room` their socket is added to a Socket.IO **room** namespaced `room:<roomId>` (`socket.join(...)`). All further game traffic — drawing, guesses, chat, state updates — is scoped to that namespace via `io.to('room:<roomId>').emit(...)`, so rooms are fully isolated from each other on the same server process. Two kinds of payload patterns are used:
- **Broadcasts** (`game_state`, `round_start`, `draw_data`, `chat_message`, etc.) go to everyone in the room.
- **Private emits** — most importantly, the drawer's actual secret word and their word-choice options — are sent only to that one socket via `io.to(socket.id).emit(...)`, so opening dev tools' network tab as a guesser never leaks the answer.

### Word-matching logic (case, trim, partial)

Implemented in `server/src/utils/wordUtils.ts`:
- `normalize()` lowercases, trims, collapses internal whitespace, and strips accents (so `"café"` and `"cafe"` are treated the same).
- An **exact match** compares normalized strings, with a secondary pass that also strips punctuation so `"don't"` / `"dont"` still match.
- A **"close" match** (Levenshtein edit-distance of exactly 1, only for words ≥4 letters) triggers a private "close guess!" hint to that one guesser without awarding points or revealing the word to anyone else — encouraging another attempt rather than just failing silently.
- Everything else is treated as ordinary chat (so wrong guesses don't spam the feed as failed attempts — they just look like normal messages, exactly like skribbl.io).

### Deployment setup and platform constraints

See [Deployment](#deployment) below for the full breakdown — in short: **the Socket.IO server needs a host with WebSocket support** (Render or Railway, both included as ready-made configs in this repo), while the static React build can go anywhere, including Vercel or Netlify, **as long as it's pointed at a separately-hosted WebSocket backend** via `VITE_SERVER_URL` (Vercel/Netlify serverless functions don't support persistent WebSocket connections).

---

## WebSocket Event Reference

This mirrors the table in the assignment brief, plus a few additions (`update_settings`, `kick_player`, `time_tick`, `hint_update`, `error_message`, `kicked`) needed to fully implement the feature set. The authoritative types live in `server/src/types.ts` (server) and `client/src/types/socketTypes.ts` (client — kept in sync manually since there's no shared package in this MVP; see [Limitations](#known-limitations--future-ideas)).

### Room & Lobby
| Event | Direction | Payload | Description |
|---|---|---|---|
| `create_room` | Client→Server | `{ hostName, settings }` | Host creates a room |
| `join_room` | Client→Server | `{ roomId, playerName }` | Player joins a room |
| `room_created` | Server→Client | `{ roomId, playerId, settings }` | Confirms room creation to the host |
| `joined_room` | Server→Client | `{ roomId, playerId, players, settings, hostId }` | Confirms join to that player |
| `player_joined` | Server→Clients | `{ player, players }` | Broadcast: new player |
| `player_left` | Server→Clients | `{ playerId, players, newHostId? }` | Broadcast: player left / disconnected |
| `start_game` | Client→Server | `{}` | Host starts the game (host-only) |
| `update_settings` | Client→Server | `{ settings }` | Host updates room settings (lobby-only) |
| `settings_updated` | Server→Clients | `{ settings }` | Broadcast updated settings |
| `kick_player` | Client→Server | `{ playerId }` | Host removes a player |
| `kicked` | Server→Client | `{ reason }` | Tells the removed player why |

### Game State
| Event | Direction | Payload | Description |
|---|---|---|---|
| `game_state` | Server→Clients | `{ phase, round, totalRounds, drawerId, word, blank, timeLeft, hintsRevealed }` | Full state snapshot (drawer gets `word` populated; everyone else gets `null`) |
| `round_start` | Server→Clients | `{ drawerId, drawerName, wordOptions, drawTime, round, totalRounds }` | New round begins; only the drawer's payload includes `wordOptions` |
| `word_chosen` | Client→Server | `{ word }` | Drawer picked their word |
| `time_tick` | Server→Clients | `{ timeLeft }` | Per-second countdown update |
| `hint_update` | Server→Clients | `{ blank, hintsRevealed }` | A new letter hint was revealed |
| `round_end` | Server→Clients | `{ word, scores, nextDrawerId, reason }` | Round over — shows the word & updated scores |
| `game_over` | Server→Clients | `{ winner, leaderboard }` | Game finished |

### Drawing
| Event | Direction | Payload | Description |
|---|---|---|---|
| `draw_start` | Client→Server | `{ strokeId, x, y, color, size, tool }` | Drawer starts a stroke (drawer-only, validated) |
| `draw_move` | Client→Server | `{ strokeId, x, y }` | Drawer continues a stroke |
| `draw_end` | Client→Server | `{ strokeId }` | Drawer ends a stroke |
| `draw_data` | Server→Clients | `{ type: "start"\|"move"\|"end", stroke }` | Broadcast stroke to all, including the drawer |
| `canvas_clear` | Client→Server / Server→Clients | `{}` | Drawer clears the canvas; broadcast to all |
| `draw_undo` | Client→Server / Server→Clients | `{}` | Drawer undoes the last stroke; broadcast to all |

### Chat & Guessing
| Event | Direction | Payload | Description |
|---|---|---|---|
| `guess` | Client→Server | `{ text }` | Player submits a guess |
| `guess_result` | Server→Clients (or private for "close") | `{ correct, playerId, playerName, points, isClose? }` | Result of a guess |
| `chat` | Client→Server | `{ text }` | General chat message (or routed as a guess automatically while guessing is active) |
| `chat_message` | Server→Clients | `{ id, playerId, playerName, text, type }` | Broadcast chat / system / correct-guess message |
| `error_message` | Server→Client | `{ code, message }` | Validation error (wrong turn, room full, not host, etc.) |

---

## Code Walkthrough

Suggested reading order if you're reviewing this codebase (e.g. for the assignment's "code walkthrough readiness" requirement):

1. **`server/src/types.ts`** — read this first; it's the contract every other server file implements.
2. **`server/src/models/Player.ts`** → **`Game.ts`** → **`Room.ts`** — the three core domain classes, smallest to largest.
3. **`server/src/managers/RoomManager.ts`** — trivial registry, quick read.
4. **`server/src/managers/GameController.ts`** — the heart of round/turn orchestration; read `advanceToNextDrawer` → `chooseWord`/`onWordChosen` → `startTicking` → `finishRound` → `endGame` in that order, since that's the literal lifecycle of one round.
5. **`server/src/managers/MessageHandler.ts`** — see how every socket event maps onto the classes above; this is the "wiring" layer.
6. **`server/src/utils/wordUtils.ts`** — small, self-contained, worth reading for the guess-matching and hint logic specifically.
7. **`client/src/context/GameContext.tsx`** — the client-side mirror of the server's event surface; once you understand this, every component is just "read some fields, call some action methods."
8. **`client/src/components/DrawingCanvas.tsx`** — the trickiest client file; the comments around normalized coordinates and the remote-stroke `Map` explain the two things that aren't obvious from the React code alone.

---

## Testing

Two Socket.IO integration test scripts (no test framework dependency — plain Node scripts using `socket.io-client`) live in `server/tests/`. They spin up real socket connections against a running server instance and play through full games, asserting on the actual events received.

```bash
# 1. start the server in one terminal
cd server && npm run dev

# 2. in another terminal, run either test
node tests/test_flow.mjs       # 2-player, 2-round full game flow (~25s)
node tests/test_3player.mjs    # 3-player, 2-round full game with assertions on rotation/scoring/game-over (~70s, since draw time has a 15s floor)
```

`test_3player.mjs` is the more rigorous of the two: it asserts every player draws exactly twice (turn rotation correctness), that round-end broadcasts always carry all players' scores, that the leaderboard is sorted correctly, and that `nextDrawerId` is `null` exactly once — on the very last round-end before `game_over`.

> **Note on timing:** `drawTimeSec` has a 15-second floor (see [Room Settings](#feature-breakdown-recap) below / `clampSettings` in `wordUtils.ts`), so a full multi-round test genuinely takes a while in wall-clock time — this is expected, not a bug in the test.

---

## Deployment

This repo ships ready-to-use config for every platform mentioned in the assignment brief — **none of these have been triggered**; you'll need to connect your own GitHub repo / CLI login to actually deploy.

| Platform | Config file | What it deploys |
|---|---|---|
| **Render** | `/render.yaml` | Both the Node/Socket.IO server *and* a static client, via Render's Blueprint feature ("New +" → "Blueprint" → point at this repo) |
| **Railway** | `/server/railway.json` | The server only — pair with any static host for the client, or run the client through Railway as a second service |
| **Vercel** | `/client/vercel.json` | The client only (static + SPA rewrites) — point `VITE_SERVER_URL` at a server hosted on Render/Railway, since Vercel's serverless functions don't support long-lived WebSocket connections |
| **Netlify** | `/client/netlify.toml` | Same idea as Vercel — static client only, paired with a separately hosted WebSocket backend |

**General steps for any platform:**
1. Deploy the server first (Render or Railway — both have native WebSocket support).
2. Note its live URL, then set `CLIENT_ORIGIN` on the server to your eventual frontend URL.
3. Deploy the client, setting `VITE_SERVER_URL` to the server's live URL as a build-time env var.
4. If you changed `CLIENT_ORIGIN` after the first deploy, redeploy the server so CORS picks up the new origin.
5. Confirm the core loop — create room → join → draw → guess → score → game over — works against the **live URLs**, not just localhost.
6. Paste your live URL at the top of this README.

---

## Known Limitations / Future Ideas

- **In-memory state only** — all rooms/scores live in server RAM and are lost on restart or redeploy. A real deployment with autoscaling would need a shared store (Redis pub/sub for cross-instance broadcast, Postgres for persistent history) — the brief marks a database as optional for the MVP, so this was intentionally deferred.
- **Reconnection is partial** — a disconnected player keeps their score and seat if the *tab* reconnects fast enough mid-game, but there's no reconnect-with-same-identity flow (rejoining gets you a fresh `playerId`). A production version would persist a reconnect token in `localStorage`/`sessionStorage`... except this project explicitly avoids browser storage per its build constraints, so that'd need a server-issued signed token instead.
- **Single-process only** — `RoomManager` is an in-memory `Map`; running multiple server instances behind a load balancer would require sticky sessions or a Socket.IO Redis adapter.
- **No content moderation** beyond host-kick — no profanity filter on chat/names, no votekick/ban/report.
- **Word list is mostly static** — the built-in bank has no multi-language support yet, though hosts can now append their own words via the lobby UI, and the data model (`server/src/data/words.ts`) is structured to make full custom-list replacement or i18n straightforward additions.
- **Client/server types are duplicated**, not shared via a workspace package — acceptable at this scale, but a `packages/shared-types` workspace would remove the manual sync risk in a larger project.
# Skribbl-clone
