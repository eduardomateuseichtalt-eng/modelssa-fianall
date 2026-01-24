import { Router, Request, Response } from "express";
import redis from "../redis";
import { asyncHandler } from "../lib/async-handler";

const router = Router();

router.post("/cache-image", asyncHandler(async (req: Request, res: Response) => {
  const { id, url } = req.body;

  if (!id || !url) {
    return res.status(400).json({ error: "Id e URL sao obrigatorios" });
  }

  await redis.set(`image:${id}`, url);
  return res.json({ status: "ok", id });
}));

router.get("/get-image/:id", asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const url = await redis.get(`image:${id}`);

  if (!url) {
    return res.status(404).json({ error: "Imagem nao encontrada" });
  }

  return res.json({ id, url });
}));

export default router;
