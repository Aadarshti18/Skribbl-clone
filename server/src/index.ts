import express from "express";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import { RoomManager } from "./managers/RoomManager.js";
import { MessageHandler } from "./managers/MessageHandler.js";

dotenv.config();

process.on("uncaughtException", (err) => {
  // eslint-disable-next-line no-console
  console.error("[uncaughtException]", err);
});
process.on("unhandledRejection", (err) => {
  // eslint-disable-next-line no-console
  console.error("[unhandledRejection]", err);
});

const PORT = Number(process.env.PORT) || 3001;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN.split(","), credentials: true }));
app.use(express.json());

const httpServer = createServer(app);

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: CLIENT_ORIGIN.split(","),
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const roomManager = new RoomManager(io);
const messageHandler = new MessageHandler(io, roomManager);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", rooms: roomManager.roomCount, uptime: process.uptime() });
});

app.get("/api/rooms/public", (_req, res) => {
  res.json({ rooms: roomManager.getPublicRooms() });
});

app.get("/api/rooms/:id/exists", (req, res) => {
  const room = roomManager.getRoom(req.params.id);
  res.json({ exists: !!room });
});

io.on("connection", (socket) => {
  messageHandler.register(socket);
});

httpServer.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`skribbl-clone server listening on port ${PORT}`);
});
