import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { createUser, findUserByEmail } from "../config/db";

const SALT_ROUNDS = 18;

export async function signUpUser(
  email: string,
  password: string
) {
  const existingUser = await findUserByEmail(email);

  if (existingUser) {
    throw new Error("USER_EXISTS");
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const apiKey = crypto.randomBytes(32).toString("hex");
  const secretKey = crypto.randomBytes(32).toString("hex");

  const newUser = await createUser({
    email,
    passwordHash,
    apiKey,
    secretKey
  });

  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET_NOT_DEFINED");
  }

  const token = jwt.sign(
    { userId: newUser.id },
    process.env.JWT_SECRET,
    { expiresIn: "20h" }
  );

  return token;
}

const loginUser = async (email: string, password: string) => {
  const user = await findUserByEmail(email);

  if (!user) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    throw new Error("INVALID_CREDENTIALS");
  }

  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET_NOT_DEFINED");
  }

  const token = jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: "20h" }
  );

  return token;
};

export const auth = {
  signUpUser,
  loginUser,
};
