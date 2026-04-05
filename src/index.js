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
const allowedOrigins = [process.env.FRONTEND_URL, 'http://localhost:5173', 'http://localhost:3000'].filter(Boolean);

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

const port = process.env.PORT || 3000;

app.use(express.json())

// Rotas
app.use('/', publicRoutes)
app.use('/', auth, privateRoutes)

export default app;

// O listen só deve rodar localmente, não na Vercel
if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => console.log(`🚀 Server rodando na porta ${port}`));
}