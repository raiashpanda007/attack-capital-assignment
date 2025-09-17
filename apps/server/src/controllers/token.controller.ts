import { asyncHandler, Response } from "../utils";
import { z as zod } from "zod";
import { AccessToken } from "livekit-server-sdk";
import { LIVEKIT_API_KEY, LIVEKIT_API_SECRET } from "../config";

const GenerateTokenSchema = zod.object({
  userName: zod.string().min(3).max(30),
  roomName: zod.string().min(3).max(50),
});
const GenerateToken = asyncHandler(async (req, res) => {
  const parseResult = GenerateTokenSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res
      .status(400)
      .json(new Response(400, "Invalid request data", parseResult.error));
  }

  const { userName, roomName } = parseResult.data;

  const finalRoomName = `${roomName}-main-room`;

  const at = new AccessToken(LIVEKIT_API_KEY!, LIVEKIT_API_SECRET!, {
    identity: userName,
    ttl: 600,
  });

  at.addGrant({
    roomJoin: true,
    room: finalRoomName,
    canPublish: true,
    canSubscribe: true,
  });

  const token = await at.toJwt();

  return res
    .status(200)
    .json(
      new Response(200, "Token generated successfully", {
        token,
        room: finalRoomName,
      })
    );
});

export default GenerateToken;
