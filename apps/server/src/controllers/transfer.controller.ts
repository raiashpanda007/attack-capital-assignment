import { Router, Response as ExResponse } from "express";
import { asyncHandler, Response } from "../utils";
import { z as zod } from "zod";
import { generateTokenForIdentity } from "../utils/tokenhelper";
import { RoomServiceClient } from "livekit-server-sdk";
import { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } from "../config";

const StartWarmSchema = zod.object({
  roomName: zod.string(),
  agentIdentity: zod.string().optional(),
});

const CompleteTransferSchema = zod.object({
  roomName: zod.string(),
});

type WarmEntry = {
  supportRoom: string;
  agentIdentity?: string;
  agentToken?: string;
};

const warmTransfers: Record<string, WarmEntry> = {};

// SSE client registry keyed by participant identity
const sseClients: Record<string, ExResponse[]> = {};

// SSE registry keyed by room base name (e.g., 'test') for room-level events
const sseRoomClients: Record<string, ExResponse[]> = {};

function sendSSE(identity: string, data: any) {
  const conns = sseClients[identity] || [];
  for (const res of conns) {
    try {
      console.log(`Sending SSE to identity=${identity}`, data);
      res.write(`event: transfer\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (e) {
      // ignore
    }
  }
}

function sendSSERoom(room: string, data: any) {
  console.log(`Sending SSRoom event to room=${room}`, data);
  const conns = sseRoomClients[room] || [];
  for (const res of conns) {
    try {
      res.write(`event: room_event\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (e) {}
  }
}

export const subscribeTransfer = (req: any, res: ExResponse) => {
  const identity = req.params.identity;
  if (!identity) {
    res.status(400).send("Missing identity");
    return;
  }

  // set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  // register
  sseClients[identity] = sseClients[identity] || [];
  sseClients[identity].push(res);

  // heartbeat
  const keepAlive = setInterval(() => {
    try {
      res.write(`:\n`);
    } catch (e) {}
  }, 20000);

  req.on("close", () => {
    clearInterval(keepAlive);
    const arr = sseClients[identity] || [];
    sseClients[identity] = arr.filter((r) => r !== res);
  });
};

export const subscribeRoom = (req: any, res: ExResponse) => {
  const room = req.params.room;
  if (!room) {
    res.status(400).send("Missing room");
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  sseRoomClients[room] = sseRoomClients[room] || [];
  sseRoomClients[room].push(res);
  console.log(`New room SSE subscriber for room=${room}. total=${sseRoomClients[room].length}`);

  // If a warm transfer is already active for this room, immediately notify the new subscriber
  try {
    const existing = warmTransfers[room];
    if (existing) {
      console.log(`Notifying new subscriber immediately: room=${room} warm transfer exists supportRoom=${existing.supportRoom}`);
      res.write(`event: room_event\n`);
      res.write(`data: ${JSON.stringify({ type: "warm_started", supportRoom: existing.supportRoom })}\n\n`);
    }
  } catch (e) {}

  const keepAlive = setInterval(() => {
    try {
      res.write(`:\n`);
    } catch (e) {}
  }, 20000);

  req.on("close", () => {
    clearInterval(keepAlive);
    const arr = sseRoomClients[room] || [];
    sseRoomClients[room] = arr.filter((r) => r !== res);
  });
};

/**
 * Agent requests to start a warm transfer.
 * Returns an agent token for the support room so Agent1 can join and prep.
 */
export const startWarmTransfer = asyncHandler(async (req, res) => {
  const parse = StartWarmSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json(new Response(400, "Invalid request", parse.error));
  }
  const { roomName, agentIdentity } = parse.data;
  const supportRoom = `${roomName}-support-room`;
  // If a warm transfer already exists for this room, don't recreate it.
  // Instead, generate a support token for the requesting agent identity and return that.
  const existing = warmTransfers[roomName];
  if (existing) {
    try {
      // ensure room-level subscribers know a warm transfer is active
      sendSSERoom(roomName, { type: "warm_started", supportRoom: existing.supportRoom });
    } catch (e) {}

    const tokenForRequester = await generateTokenForIdentity(existing.supportRoom, agentIdentity ?? "agent");
    return res.status(200).json(new Response(200, "Warm transfer already started", { token: tokenForRequester, supportRoom: existing.supportRoom, alreadyStarted: true }));
  }

  // generate token for agent to join support room and record the warm transfer
  const agentToken = await generateTokenForIdentity(supportRoom, agentIdentity ?? "agent");
  warmTransfers[roomName] = { supportRoom, agentIdentity, agentToken };

  // notify any room-level subscribers that warm transfer started
  try {
    sendSSERoom(roomName, { type: "warm_started", supportRoom });
  } catch (e) {}

  return res.status(200).json(new Response(200, "Warm transfer started", { token: agentToken, supportRoom }));
});

/**
 * Complete the transfer: generate a token for the user to join support room.
 * Returns a user token that the agent can copy/send to the user.
 */
export const completeTransfer = asyncHandler(async (req, res) => {
  const parse = CompleteTransferSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json(new Response(400, "Invalid request", parse.error));
  }
  const { roomName } = parse.data;
  const entry = warmTransfers[roomName];
  if (!entry) {
    return res.status(400).json(new Response(400, "No pending warm transfer for this room", null));
  }

  // Use RoomServiceClient to list participants in the main room and pick the user(s)
  const mainRoom = `${roomName}-main-room`;
  const roomService = new RoomServiceClient(LIVEKIT_URL!, LIVEKIT_API_KEY!, LIVEKIT_API_SECRET!);

  let participants: any[] = [];
  try {
    participants = await roomService.listParticipants(mainRoom);
  } catch (err: any) {
    console.warn("Could not list participants for room during completeTransfer:", mainRoom, err?.message ?? err);
  }

  // Find non-agent participants (assume agents have identity including 'Agent')
  const userParticipants = (participants || []).filter((p) => {
    const id = p.identity ?? p.name ?? "";
    return !/Agent/i.test(id);
  });

  const results: Array<{ identity: string; token: string }>
    = [];

  // For each user participant, create a support token and notify via SSE if subscribed
  for (const p of userParticipants) {
    const identity = p.identity ?? p.name ?? p.sid;
    try {
      const userToken = await generateTokenForIdentity(entry.supportRoom, identity);
      results.push({ identity, token: userToken });
      // notify via SSE if client subscribed
      sendSSE(identity, { token: userToken, supportRoom: entry.supportRoom });
    } catch (e) {
      console.error("Failed to generate support token for participant", identity, e);
    }
  }

  // Also remove pending warm transfer
  delete warmTransfers[roomName];

  return res.status(200).json(new Response(200, "Transfer completed", { results, supportRoom: entry.supportRoom }));
});