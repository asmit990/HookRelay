import { Router } from "express";

const route = Router()


route.get("/", listwebHooks)
route.post("/", createwebHooks)
route.patch("/:id", webhooksServices)
route.delete("/:id", webhookServices )
route.patch("/:id/toggle")