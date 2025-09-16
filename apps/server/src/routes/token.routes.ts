import { Router } from "express";
import { GenerateToken } from "../controllers";
const router = Router();

router.post("/create-token",GenerateToken);

export default router