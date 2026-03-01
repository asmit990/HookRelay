import express from "express"
import passport from "passport";
import  jwt  from "jsonwebtoken";
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