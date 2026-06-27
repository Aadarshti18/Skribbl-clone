import { io } from "socket.io-client";

const URL = "http://localhost:3001";
let failures = 0;

function assert(cond, msg) {
  if (!cond) {
    failures++;
    console.error("ASSERT FAILED:", msg);
  } else {
    console.log("ok:", msg);
  }
}

async function run() {
  const clients = [io(URL), io(URL), io(URL)];
  const names = ["Alice", "Bob", "Carol"];
  const ids = [null, null, null];
  let roomId = null;
  const drawerTurns = []; // track sequence of drawerIds seen
  let gameOverPayload = null;
  const roundEndPayloads = [];

  function findIndexById(id) {
    return ids.indexOf(id);
  }

  clients[0].on("connect", () => {
    clients[0].emit("create_room", {
      hostName: names[0],
      settings: { rounds: 2, drawTimeSec: 6, hints: 2, wordCount: 2, maxPlayers: 5 },
    });
  });

  clients[0].on("room_created", (p) => {
    roomId = p.roomId;
    ids[0] = p.playerId;
    clients[1].emit("join_room", { roomId, playerName: names[1] });
  });

  clients[1].on("joined_room", (p) => {
    ids[1] = p.playerId;
    clients[2].emit("join_room", { roomId, playerName: names[2] });
  });

  clients[2].on("joined_room", (p) => {
    ids[2] = p.playerId;
    setTimeout(() => clients[0].emit("start_game"), 200);
  });

  clients.forEach((c, idx) => {
    c.on("error_message", (e) => {
      failures++;
      console.error("SERVER ERROR:", JSON.stringify(e));
    });

    c.on("round_start", (p) => {
      console.log(`[client ${idx} / ${names[idx]}] round_start: drawer=${p.drawerId} round=${p.round}/${p.totalRounds} hasWordOptions=${!!p.wordOptions}`);
      if (p.wordOptions) {
        // this client is the drawer
        drawerTurns.push(p.drawerId);
        setTimeout(() => c.emit("word_chosen", { word: p.wordOptions[0] }), 100);
      }
    });

    c.on("game_state", (p) => {
      if (p.phase === "drawing" && p.word === null) {
        // non-drawer perspective; have non-drawers guess wrong then... we need the actual word
      }
    });

    c.on("round_end", (p) => {
      if (idx === 0) console.log(`round_end: word=${p.word} nextDrawerId=${p.nextDrawerId} reason=${p.reason}`);
      roundEndPayloads.push(p);
    });

    c.on("game_over", (p) => {
      gameOverPayload = p;
    });
  });

  // Each client tracks the word when it's drawing (private game_state) and
  // broadcasts knowledge via closure since this is a single test process.
  const knownWordByDrawer = {};
  clients.forEach((c, idx) => {
    c.on("game_state", (p) => {
      if (p.word) {
        knownWordByDrawer[p.drawerId] = p.word;
      }
    });
  });

  // Non-drawers guess shortly after drawing phase starts, using whatever
  // word has become known for the current drawer.
  const guessedFor = new Set();
  clients.forEach((c, idx) => {
    c.on("game_state", (p) => {
      if (p.phase === "drawing" && p.drawerId !== ids[idx]) {
        const key = `${p.drawerId}-${p.round}`;
        if (!guessedFor.has(key + "-" + idx)) {
          const word = knownWordByDrawer[p.drawerId];
          if (word) {
            guessedFor.add(key + "-" + idx);
            setTimeout(() => c.emit("guess", { text: word }), 400 + idx * 50);
          }
        }
      }
    });
  });

  await new Promise((resolve) => {
    clients[clients.length - 1].on("game_over", () => {
      setTimeout(resolve, 800);
    });
    setTimeout(() => {
      console.error("TIMEOUT waiting for game_over");
      resolve();
    }, 150000);
  });

  // --- Assertions ---
  assert(gameOverPayload !== null, "game_over event was received");
  if (gameOverPayload) {
    assert(gameOverPayload.leaderboard.length === 3, "leaderboard has all 3 players");
    const sorted = [...gameOverPayload.leaderboard].every(
      (p, i, arr) => i === 0 || arr[i - 1].score >= p.score
    );
    assert(sorted, "leaderboard is sorted descending by score");
    assert(
      gameOverPayload.winner.score === gameOverPayload.leaderboard[0].score,
      "winner matches top of leaderboard"
    );
  }

  // With 3 players and 2 rounds, each player should draw exactly twice (6 total turns)
  assert(drawerTurns.length === 6, `expected 6 total drawer turns, got ${drawerTurns.length}`);
  const drawCounts = {};
  for (const d of drawerTurns) drawCounts[d] = (drawCounts[d] || 0) + 1;
  for (const id of ids) {
    assert(drawCounts[id] === 2, `player ${id} drew exactly twice (got ${drawCounts[id]})`);
  }

  // Every round_end should report scores for all 3 players. With 3 players
  // and 2 rounds, there are 6 total turns; each broadcast is received once
  // per connected client, so 6 turns * 3 clients = 18 received events.
  assert(roundEndPayloads.length === 18, `expected 18 received round_end events (6 turns x 3 clients), got ${roundEndPayloads.length}`);
  assert(
    roundEndPayloads.every((p) => p.scores.length === 3),
    "every round_end has scores for all 3 players"
  );

  // Last round_end's nextDrawerId should be null (game ending)
  const last = roundEndPayloads[roundEndPayloads.length - 1];
  assert(last.nextDrawerId === null, "final round_end has nextDrawerId === null");

  console.log(`\n${failures === 0 ? "ALL PASSED" : failures + " FAILURES"}`);
  clients.forEach((c) => c.close());
  process.exit(failures === 0 ? 0 : 1);
}

run();
