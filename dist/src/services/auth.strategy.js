"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const passport_1 = __importDefault(require("passport"));
const passport_google_oauth20_1 = require("passport-google-oauth20");
const client_1 = require("../config/db/client");
const crypto_1 = __importDefault(require("crypto"));
passport_1.default.use(new passport_google_oauth20_1.Strategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/auth/google/callback",
}, async (accessToken, refreshToken, profile, done) => {
    try {
        const email = profile.emails?.[0].value;
        if (!email) {
            return done(new Error("No email found"));
        }
        let user = await client_1.prisma.user.findUnique({
            where: { email }
        });
        if (!user) {
            user = await client_1.prisma.user.create({
                data: {
                    email,
                    apiKey: crypto_1.default.randomBytes(32).toString("hex"),
                    secretKey: crypto_1.default.randomBytes(32).toString("hex"),
                    passwordHash: "", // required field in your schema
                }
            });
        }
        return done(null, user);
    }
    catch (err) {
        return done(err);
    }
}));
