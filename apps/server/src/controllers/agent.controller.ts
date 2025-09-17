import { asyncHandler, Response } from "../utils";
import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import { LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL } from "../config";
import { z as zod } from "zod";


const AgentTokenSchema = zod.object({
    roomName: zod.string()
});

const generateToken = async (roomName: string, identity: string) => {
    const at = new AccessToken(LIVEKIT_API_KEY!, LIVEKIT_API_SECRET!, {
        identity,
        ttl: 3600, 
    });

    at.addGrant({
        roomJoin: true,
        room: roomName,
        canPublish: true,
        canSubscribe: true,
    });

    const token = await at.toJwt();
    return token;
}
const AgentToken = asyncHandler(async (req, res) => {
    try {
        const parseResult = AgentTokenSchema.safeParse(req.body);
        if (!parseResult.success) {
            return res.status(400).json(new Response(400, "Invalid request data", parseResult.error));
        }
        const { roomName } = parseResult.data;

        const roomService = new RoomServiceClient(LIVEKIT_URL!, LIVEKIT_API_KEY!, LIVEKIT_API_SECRET!);
        const participants = await roomService.listParticipants(`${roomName}-main-room`);
        console.log("Participants in room:", participants.length);
        console.debug(participants);
        if (participants.length === 0 || participants.length === 1) {
            const token = await generateToken(`${roomName}-main-room`, "Agent A");
            return res.status(200).json(new Response(200, "Token generated successfully", { token, room: `${roomName}-main-room` }));
        } else {
            const token = await generateToken(`${roomName}-support-room`, "Agent B");
            return res.status(200).json(new Response(200, "Token generated successfully", { token, room: `${roomName}-support-room` }));

        }
        

    } catch (error) {
        console.error("Error generating agent token:", error);
        return res.status(500).json(new Response(500, "Internal server error", error as string));
    }


})

export default AgentToken;