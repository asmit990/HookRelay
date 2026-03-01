import { Router } from "express";

const route = Router()

route.get("/", events)
route.post("/trigger", eventTrigger)