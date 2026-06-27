import React from "react";
import { Routes, Route } from "react-router-dom";
import { SocketProvider } from "./context/SocketContext";
import { GameProvider } from "./context/GameContext";
import { HomePage } from "./pages/HomePage";
import { LobbyPage } from "./pages/LobbyPage";
import { GamePage } from "./pages/GamePage";

export default function App() {
  return (
    <SocketProvider>
      <GameProvider>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/room/:roomId" element={<LobbyPage />} />
          <Route path="/room/:roomId/game" element={<GamePage />} />
        </Routes>
      </GameProvider>
    </SocketProvider>
  );
}
