import { Router } from "express";
import { AgentToken, GenerateToken } from "../controllers";
const router = Router();

router.post("/create-token",GenerateToken);
router.post("/agent-token",AgentToken);

export default router