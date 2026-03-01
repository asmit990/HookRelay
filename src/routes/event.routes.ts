import { Router } from "express";
import { getDashboard, triggerEvent } from "../controllers/event.controller";

const route = Router()

route.get("/", getDashboard)
route.post("/trigger", triggerEvent)

export default route;
