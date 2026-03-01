"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const event_controller_1 = require("../controllers/event.controller");
const route = (0, express_1.Router)();
route.get("/", event_controller_1.getDashboard);
route.post("/trigger", event_controller_1.triggerEvent);
exports.default = route;
