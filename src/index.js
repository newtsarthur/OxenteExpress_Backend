import 'dotenv/config'
import express from 'express'
import cors from 'cors'
// import prisma from './config/database.js'; // 2. IMPORTA O PRISMA DEPOIS DO ENV
import publicRoutes from './routes/public.js'
import privateRoutes from './routes/private.js'
import auth from './middlewares/auth.js'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const app = express()

// Configuração do CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

const port = process.env.PORT || 3000;

app.use(express.json())

// Rotas
app.use('/', publicRoutes)
app.use('/', auth, privateRoutes)

app.listen(port, () => console.log(`🚀 Server rodando na porta ${port}`));