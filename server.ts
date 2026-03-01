import "./src/services/auth.strategy";
import authRoutes from "./routes/auth.routes";
import express from "express"


const app = express()


app.use("/auth", authRoutes);