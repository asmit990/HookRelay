"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const passport_1 = __importDefault(require("passport"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const auth_controller_1 = require("../controllers/auth.controller");
const auth_middlerware_1 = require("../middleware/auth.middlerware");
const router = (0, express_1.Router)();
router.get("/google", passport_1.default.authenticate("google", { scope: ["profile", "email"] }));
router.get("/google/callback", passport_1.default.authenticate("google", { session: false }), (req, res) => {
    const user = req.user;
    const token = jsonwebtoken_1.default.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: "20h" });
    res.json({ token });
});
router.post("/register", auth_controller_1.registerHandler);
router.post("/login", auth_controller_1.loginHandler);
router.get("/me", auth_middlerware_1.authMiddleware, auth_controller_1.meHandler);
exports.default = router;
