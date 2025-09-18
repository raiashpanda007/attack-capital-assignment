import { Router } from "express";
import { AgentToken, GenerateToken, startWarmTransfer, completeTransfer, subscribeTransfer, subscribeRoom } from "../controllers";
const router = Router();

router.post("/create-token", GenerateToken);
router.post("/agent-token", AgentToken);

// Warm transfer endpoints
router.post("/start-warm-transfer", startWarmTransfer);
router.post("/complete-transfer", completeTransfer);

// SSE subscribe for users to receive transfer tokens
router.get("/subscribe-transfer/:identity", subscribeTransfer);

// SSE room-level subscribe so agents in a room can listen for warm-start events
router.get("/subscribe-room/:room", subscribeRoom);

export default router