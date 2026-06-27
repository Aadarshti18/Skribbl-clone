import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "../context/GameContext";

export function HomePage() {
  const { createRoom, joinRoom, errorMessage, clearError, roomId } = useGame();
  const navigate = useNavigate();

  const [mode, setMode] = useState<"create" | "join">("create");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  React.useEffect(() => {
    if (roomId) navigate(`/room/${roomId}`);
  }, [roomId, navigate]);

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    createRoom(name.trim(), {});
  }

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !code.trim()) return;
    joinRoom(code.trim().toUpperCase(), name.trim());
  }

  return (
    <div className="home-page">
      <div className="home-hero">
        <h1 className="font-display home-logo">
          Doodle <span className="home-logo-accent">Dash</span>
        </h1>
        <p className="home-tagline">Draw it. Guess it. Laugh about it.</p>
      </div>

      <div className="card home-card">
        <div className="home-tabs">
          <button
            className={`home-tab ${mode === "create" ? "home-tab--active" : ""}`}
            onClick={() => {
              setMode("create");
              clearError();
            }}
          >
            Create room
          </button>
          <button
            className={`home-tab ${mode === "join" ? "home-tab--active" : ""}`}
            onClick={() => {
              setMode("join");
              clearError();
            }}
          >
            Join room
          </button>
        </div>

        {mode === "create" ? (
          <form className="home-form" onSubmit={handleCreate}>
            <label className="home-label">
              Your name
              <input
                className="text-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Doodle Master"
                maxLength={20}
                autoFocus
              />
            </label>
            <button className="btn btn-primary home-submit" type="submit" disabled={!name.trim()}>
              Create room
            </button>
            <p className="home-hint">You'll be the host — pick the settings in the lobby.</p>
          </form>
        ) : (
          <form className="home-form" onSubmit={handleJoin}>
            <label className="home-label">
              Your name
              <input
                className="text-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Pixel Pete"
                maxLength={20}
              />
            </label>
            <label className="home-label">
              Room code
              <input
                className="text-input home-code-input"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
                maxLength={6}
              />
            </label>
            <button className="btn btn-primary home-submit" type="submit" disabled={!name.trim() || !code.trim()}>
              Join room
            </button>
          </form>
        )}

        {errorMessage && <div className="home-error">{errorMessage}</div>}
      </div>

      <div className="home-howto">
        <h2 className="font-display home-howto-title">How it works</h2>
        <ol className="home-howto-list">
          <li>Create a room or join one with a code from a friend.</li>
          <li>Each round, one player draws a secret word.</li>
          <li>Everyone else races to guess it in the chat.</li>
          <li>Fastest correct guesses score the most points!</li>
        </ol>
      </div>
    </div>
  );
}
