import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import publicRoutes from './routes/public.js'
import privateRoutes from './routes/private.js'
import auth from './middlewares/auth.js'
import { initSocket } from './lib/socket.js'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const app = express()

// Configuração do CORS
const defaultOrigins = [
  "http://localhost:5173",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://127.0.0.1:5173",
];
const fromEnv = process.env.FRONTEND_URL?.split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const corsOrigin = fromEnv && fromEnv.length > 0 ? fromEnv : defaultOrigins;

app.use(
  cors({
    origin: corsOrigin,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

const port = process.env.PORT || 3000;

app.use(express.json())

// Rotas
app.use('/', publicRoutes)
app.use('/', auth, privateRoutes)

app.listen(port, () => console.log(`🚀 Server rodando na porta ${port}`));