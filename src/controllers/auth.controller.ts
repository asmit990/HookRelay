import express, { Request, Response } from "express"
import passport from "passport";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { prisma } from "../config/db/client";

const app = express()

app.get("/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get("/auth/google/callback",
  passport.authenticate("google", { session: false }),
  (req, res) => {
    const user = req.user as any;

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET!,
      { expiresIn: "20h" }
    );

    res.json({ token });
  }
);

export const registerHandler = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: "MISSING_FIELDS", message: "Email and password are required" });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ success: false, error: "USER_EXISTS", message: "Email is already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const apiKey = crypto.randomBytes(32).toString('hex');
    const secretKey = crypto.randomBytes(32).toString('hex');

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        apiKey,
        secretKey,
      }
    });

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET!,
      { expiresIn: "20h" }
    );

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

  } catch (error) {
    console.error("[registerHandler] error:", error);
    res.status(500).json({ success: false, error: "SERVER_ERROR", message: "Something went wrong" });
  }
};

export const loginHandler = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: "MISSING_FIELDS", message: "Email and password are required" });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ success: false, error: "INVALID_CREDENTIALS", message: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: "INVALID_CREDENTIALS", message: "Invalid email or password" });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET!,
      { expiresIn: "20h" }
    );

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

  } catch (error) {
    console.error("[loginHandler] error:", error);
    res.status(500).json({ success: false, error: "SERVER_ERROR", message: "Something went wrong" });
  }
};

export const meHandler = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    const user = await prisma.user.findUnique({
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
  } catch (error) {
    console.error("[meHandler] error:", error);
    res.status(500).json({ success: false, error: "SERVER_ERROR", message: "Something went wrong" });
  }
};
