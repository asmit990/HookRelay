"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.auth = void 0;
exports.signUpUser = signUpUser;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const db_1 = require("../config/db");
const SALT_ROUNDS = 18;
async function signUpUser(email, password) {
    const existingUser = await (0, db_1.findUserByEmail)(email);
    if (existingUser) {
        throw new Error("USER_EXISTS");
    }
    const passwordHash = await bcrypt_1.default.hash(password, SALT_ROUNDS);
    const apiKey = crypto_1.default.randomBytes(32).toString("hex");
    const secretKey = crypto_1.default.randomBytes(32).toString("hex");
    const newUser = await (0, db_1.createUser)({
        email,
        passwordHash,
        apiKey,
        secretKey
    });
    if (!process.env.JWT_SECRET) {
        throw new Error("JWT_SECRET_NOT_DEFINED");
    }
    const token = jsonwebtoken_1.default.sign({ userId: newUser.id }, process.env.JWT_SECRET, { expiresIn: "20h" });
    return token;
}
const loginUser = async (email, password) => {
    const user = await (0, db_1.findUserByEmail)(email);
    if (!user) {
        throw new Error("INVALID_CREDENTIALS");
    }
    const isMatch = await bcrypt_1.default.compare(password, user.passwordHash);
    if (!isMatch) {
        throw new Error("INVALID_CREDENTIALS");
    }
    if (!process.env.JWT_SECRET) {
        throw new Error("JWT_SECRET_NOT_DEFINED");
    }
    const token = jsonwebtoken_1.default.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: "20h" });
    return token;
};
exports.auth = {
    signUpUser,
    loginUser,
};
