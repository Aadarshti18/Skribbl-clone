import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useGame } from "../context/GameContext";
import { PlayersList } from "../components/PlayersList";
import { RoomSettings, WordMode } from "../types/socketTypes";

export function LobbyPage() {
  const { roomId: urlRoomId } = useParams();
  const navigate = useNavigate();
  const {
    roomId,
    playerId,
    hostId,
    settings,
    players,
    phase,
    startGame,
    updateSettings,
    leaveRoom,
    errorMessage,
    clearError,
    kicked,
  } = useGame();

  const [copied, setCopied] = useState(false);
  const amHost = hostId === playerId;

  React.useEffect(() => {
    if (!roomId && urlRoomId) {
      // We landed here directly (e.g. refresh) without joining state; bounce home.
      navigate("/");
    }
  }, [roomId, urlRoomId, navigate]);

  React.useEffect(() => {
    if (phase !== "lobby" && phase !== "game_over") {
      navigate(`/room/${roomId}/game`);
    }
  }, [phase, roomId, navigate]);

  if (kicked) {
    return (
      <div className="lobby-kicked card">
        <h2>You were removed from the room</h2>
        <button className="btn btn-primary" onClick={() => navigate("/")}>
          Back home
        </button>
      </div>
    );
  }

  if (!settings) return null;

  function patchSettings(patch: Partial<RoomSettings>) {
    updateSettings({ ...settings, ...patch });
  }

  function handleCopyLink() {
    const url = `${window.location.origin}/room/${roomId}`;
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  function handleCopyCode() {
    navigator.clipboard?.writeText(roomId ?? "").then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <div className="lobby-page">
      <div className="lobby-main">
        <div className="card lobby-room-card">
          <div className="lobby-room-code-row">
            <div>
              <span className="lobby-room-label">Room code</span>
              <div className="lobby-room-code">{roomId}</div>
            </div>
            <div className="lobby-room-actions">
              <button className="btn btn-sm" onClick={handleCopyCode}>
                {copied ? "Copied!" : "Copy code"}
              </button>
              <button className="btn btn-sm btn-accent" onClick={handleCopyLink}>
                Copy invite link
              </button>
            </div>
          </div>
          {errorMessage && (
            <div className="home-error" onClick={clearError}>
              {errorMessage}
            </div>
          )}
        </div>

        <div className="card lobby-settings-card">
          <h3 className="font-display">Room settings</h3>
          {!amHost && <p className="lobby-settings-readonly">Only the host can change these.</p>}

          <div className="settings-grid">
            <SettingSlider
              label="Players"
              value={settings.maxPlayers}
              min={2}
              max={20}
              step={1}
              suffix=""
              disabled={!amHost}
              onChange={(v) => patchSettings({ maxPlayers: v })}
            />
            <SettingSlider
              label="Rounds"
              value={settings.rounds}
              min={2}
              max={10}
              step={1}
              suffix=""
              disabled={!amHost}
              onChange={(v) => patchSettings({ rounds: v })}
            />
            <SettingSlider
              label="Draw time"
              value={settings.drawTimeSec}
              min={15}
              max={240}
              step={5}
              suffix="s"
              disabled={!amHost}
              onChange={(v) => patchSettings({ drawTimeSec: v })}
            />
            <SettingSlider
              label="Word choices"
              value={settings.wordCount}
              min={1}
              max={5}
              step={1}
              suffix=""
              disabled={!amHost}
              onChange={(v) => patchSettings({ wordCount: v })}
            />
            <SettingSlider
              label="Hints"
              value={settings.hints}
              min={0}
              max={5}
              step={1}
              suffix=""
              disabled={!amHost}
              onChange={(v) => patchSettings({ hints: v })}
            />

            <label className="setting-field">
              <span>Word mode</span>
              <select
                className="text-input"
                value={settings.wordMode}
                disabled={!amHost}
                onChange={(e) => patchSettings({ wordMode: e.target.value as WordMode })}
              >
                <option value="normal">Normal</option>
                <option value="hidden">Hidden (no blanks)</option>
                <option value="combination">Combination</option>
              </select>
            </label>

            <label className="setting-field setting-field--checkbox">
              <input
                type="checkbox"
                checked={settings.isPrivate}
                disabled={!amHost}
                onChange={(e) => patchSettings({ isPrivate: e.target.checked })}
              />
              <span>Private room (invite-only)</span>
            </label>

            <label className="setting-field setting-field--full">
              <span>Custom words (optional, comma-separated)</span>
              <textarea
                className="text-input custom-words-input"
                placeholder="e.g. inside joke, our cat, that one meeting"
                disabled={!amHost}
                defaultValue={settings.customWords?.join(", ") ?? ""}
                onBlur={(e) => {
                  const words = e.target.value
                    .split(",")
                    .map((w) => w.trim())
                    .filter(Boolean);
                  patchSettings({ customWords: words });
                }}
              />
              <span className="setting-field-hint">Added to the built-in word bank — won't replace it.</span>
            </label>
          </div>
        </div>

        <div className="lobby-cta">
          {amHost ? (
            <button className="btn btn-primary lobby-start-btn" onClick={startGame} disabled={players.length < 2}>
              {players.length < 2 ? "Waiting for more players…" : "Start game"}
            </button>
          ) : (
            <p className="lobby-waiting">Waiting for the host to start the game…</p>
          )}
          <button className="btn" onClick={() => { leaveRoom(); navigate("/"); }}>
            Leave room
          </button>
        </div>
      </div>

      <div className="lobby-sidebar">
        <PlayersList showKick />
      </div>
    </div>
  );
}

function SettingSlider({
  label,
  value,
  min,
  max,
  step,
  suffix,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  disabled?: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <label className="setting-field">
      <span>
        {label}: <strong>{value}{suffix}</strong>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
