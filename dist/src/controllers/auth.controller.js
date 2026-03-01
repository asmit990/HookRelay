"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.meHandler = exports.loginHandler = exports.registerHandler = void 0;
const express_1 = __importDefault(require("express"));
const passport_1 = __importDefault(require("passport"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const crypto_1 = __importDefault(require("crypto"));
const client_1 = require("../config/db/client");
const app = (0, express_1.default)();
app.get("/auth/google", passport_1.default.authenticate("google", { scope: ["profile", "email"] }));
app.get("/auth/google/callback", passport_1.default.authenticate("google", { session: false }), (req, res) => {
    const user = req.user;
    const token = jsonwebtoken_1.default.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: "20h" });
    res.json({ token });
});
const registerHandler = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, error: "MISSING_FIELDS", message: "Email and password are required" });
        }
        const existingUser = await client_1.prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(409).json({ success: false, error: "USER_EXISTS", message: "Email is already registered" });
        }
        const passwordHash = await bcrypt_1.default.hash(password, 10);
        const apiKey = crypto_1.default.randomBytes(32).toString('hex');
        const secretKey = crypto_1.default.randomBytes(32).toString('hex');
        const user = await client_1.prisma.user.create({
            data: {
                email,
                passwordHash,
                apiKey,
                secretKey,
            }
        });
        const token = jsonwebtoken_1.default.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: "20h" });
        res.status(201).json({
            success: true,
            message: "Registration successful",
            data: {
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    apiKey: user.apiKey
                }
            }
        });
    }
    catch (error) {
        console.error("[registerHandler] error:", error);
        res.status(500).json({ success: false, error: "SERVER_ERROR", message: "Something went wrong" });
    }
};
exports.registerHandler = registerHandler;
const loginHandler = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, error: "MISSING_FIELDS", message: "Email and password are required" });
        }
        const user = await client_1.prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(401).json({ success: false, error: "INVALID_CREDENTIALS", message: "Invalid email or password" });
        }
        const isMatch = await bcrypt_1.default.compare(password, user.passwordHash);
        if (!isMatch) {
            return res.status(401).json({ success: false, error: "INVALID_CREDENTIALS", message: "Invalid email or password" });
        }
        const token = jsonwebtoken_1.default.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: "20h" });
        res.status(200).json({
            success: true,
            message: "Login successful",
            data: {
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    apiKey: user.apiKey
                }
            }
        });
    }
    catch (error) {
        console.error("[loginHandler] error:", error);
        res.status(500).json({ success: false, error: "SERVER_ERROR", message: "Something went wrong" });
    }
};
exports.loginHandler = loginHandler;
const meHandler = async (req, res) => {
    try {
        const userId = req.userId;
        const user = await client_1.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                apiKey: true,
                createdAt: true,
            }
        });
        if (!user) {
            return res.status(404).json({ success: false, error: "USER_NOT_FOUND", message: "User not found" });
        }
        res.status(200).json({ success: true, data: user });
    }
    catch (error) {
        console.error("[meHandler] error:", error);
        res.status(500).json({ success: false, error: "SERVER_ERROR", message: "Something went wrong" });
    }
};
exports.meHandler = meHandler;
