import React, { useEffect, useRef, useState } from "react";
import { useGame } from "../context/GameContext";

export function ChatPanel() {
  const { chat, sendChat, sendGuess, phase, drawerId, playerId, players } = useGame();
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  const me = players.find((p) => p.id === playerId);
  const isDrawer = drawerId === playerId;
  const iAlreadyGuessed = !!me?.hasGuessedCorrectly;
  const isGuessingPhase = phase === "drawing" && !isDrawer && !iAlreadyGuessed;

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [chat]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    if (isGuessingPhase) {
      sendGuess(trimmed);
    } else {
      sendChat(trimmed);
    }
    setText("");
  }

  return (
    <div className="chat-panel card">
      <div className="chat-feed" ref={listRef}>
        {chat.length === 0 && <div className="chat-empty">Say hi, or start guessing once drawing begins!</div>}
        {chat.map((m) => (
          <div
            key={m.id}
            className={`chat-line ${m.type === "correct_guess" ? "chat-line--correct" : ""} ${
              m.type === "system" ? "chat-line--system" : ""
            }`}
          >
            {m.type === "chat" ? (
              <>
                <span className="chat-line-name">{m.playerName}:</span> {m.text}
              </>
            ) : (
              <span>{m.type === "correct_guess" ? "🎉 " : ""}{m.text}</span>
            )}
          </div>
        ))}
      </div>

      <form className="chat-input-row" onSubmit={handleSubmit}>
        <input
          className="text-input"
          placeholder={isDrawer ? "You're drawing — chat is open" : isGuessingPhase ? "Type your guess…" : "Say something…"}
          value={text}
          maxLength={200}
          onChange={(e) => setText(e.target.value)}
        />
        <button className="btn btn-primary btn-sm" type="submit" disabled={!text.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
