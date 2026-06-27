import { io } from "socket.io-client";

const URL = "http://localhost:3001";

function log(tag, ...args) {
  console.log(`[${tag}]`, ...args);
}

async function run() {
  const host = io(URL, { transports: ["websocket"] });
  const guest = io(URL, { transports: ["websocket"] });

  let roomId;
  let hostPlayerId;
  let guestPlayerId;
  let wordOptionsForHost = null;
  let chosenWord = null;

  host.on("connect", () => {
    log("host", "connected", host.id);
    host.emit("create_room", {
      hostName: "Alice",
      settings: { rounds: 2, drawTimeSec: 8, hints: 1, wordCount: 2 },
    });
  });

  host.on("room_created", (payload) => {
    log("host", "room_created", payload);
    roomId = payload.roomId;
    hostPlayerId = payload.playerId;
    // now connect guest
    guest.emit("join_room", { roomId, playerName: "Bob" });
  });

  host.on("joined_room", (p) => log("host", "joined_room", JSON.stringify(p)));
  host.on("player_joined", (p) => {
    log("host", "player_joined", JSON.stringify(p));
    // start game now that 2 players are present
    host.emit("start_game");
  });

  host.on("round_start", (p) => {
    log("host", "round_start", JSON.stringify(p));
    if (p.wordOptions) {
      chosenWord = p.wordOptions[0];
      host.emit("word_chosen", { word: chosenWord });
    }
  });

  let hostLastGuessedRoundKey = null;
  host.on("game_state", (p) => {
    log("host", "game_state", JSON.stringify(p));
    const roundKey = `${p.drawerId}-${p.round}-${p.phase}`;
    if (p.phase === "drawing" && p.drawerId !== hostPlayerId && chosenWord && hostLastGuessedRoundKey !== roundKey) {
      hostLastGuessedRoundKey = roundKey;
      const wordToGuess = chosenWord;
      setTimeout(() => {
        log("host", "submitting guess", wordToGuess);
        host.emit("guess", { text: wordToGuess });
      }, 600);
    }
  });
  host.on("error_message", (p) => log("host", "ERROR", JSON.stringify(p)));

  guest.on("connect", () => log("guest", "connected", guest.id));
  guest.on("joined_room", (p) => {
    log("guest", "joined_room", JSON.stringify(p));
    guestPlayerId = p.playerId;
  });

  guest.on("round_start", (p) => {
    log("guest", "round_start", JSON.stringify(p));
    if (p.wordOptions) {
      chosenWord = p.wordOptions[0];
      guest.emit("word_chosen", { word: chosenWord });
    }
  });

  guest.on("hint_update", (p) => log("guest", "hint_update", JSON.stringify(p)));
  let lastGuessedRoundKey = null;
  guest.on("game_state", (p) => {
    log("guest", "game_state", JSON.stringify(p));
    const roundKey = `${p.drawerId}-${p.round}-${p.phase}`;
    // once we are in drawing phase and we know the word (test cheats by using chosenWord), submit guess after short delay
    if (p.phase === "drawing" && chosenWord && p.drawerId !== guestPlayerId && lastGuessedRoundKey !== roundKey) {
      lastGuessedRoundKey = roundKey;
      const wordToGuess = chosenWord;
      setTimeout(() => {
        log("guest", "submitting guess", wordToGuess);
        guest.emit("guess", { text: wordToGuess });
      }, 500);
    }
  });

  guest.on("guess_result", (p) => log("guest", "guess_result", JSON.stringify(p)));
  guest.on("chat_message", (p) => log("guest", "chat_message", JSON.stringify(p)));
  guest.on("round_end", (p) => log("guest", "round_end", JSON.stringify(p)));
  guest.on("game_over", (p) => {
    log("guest", "game_over", JSON.stringify(p));
    setTimeout(() => {
      host.close();
      guest.close();
      process.exit(0);
    }, 500);
  });
  guest.on("error_message", (p) => log("guest", "ERROR", JSON.stringify(p)));

  // safety timeout
  setTimeout(() => {
    log("test", "TIMEOUT - did not complete game in time");
    process.exit(1);
  }, 30000);
}

run();
