import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const JWT_SECRET = process.env.JWT_SECRET;

// Cadastrar Usuário
export const register = async (req, res) => {
    try {
        const { email, name, password, phone, type } = req.body;

        // 1. Validação básica de campos obrigatórios
        if (!email || !name || !password || !phone) {
            return res.status(400).json({ message: "Todos os campos são obrigatórios!" });
        }

        // 2. Verifica se o usuário já existe
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            return res.status(400).json({ message: "Já existe uma conta com esse email!" });
        }

        // 3. Criptografa a senha
        const salt = await bcrypt.genSalt(10);
        const hashPassword = await bcrypt.hash(password, salt);

        // 4. Define o UserType (Aceita o que vem do front, ou define USER como padrão)
        // Valores permitidos: STORE, RIDER, ADMIN, USER
        const finalType = type || "USER";

        // 5. Cria o usuário no banco de dados (MongoDB via Prisma)
        const userDB = await prisma.user.create({
            data: {
                email,
                name,
                password: hashPassword,
                phone, // Adicionado conforme o novo Schema
                type: finalType,
                createdAt: new Date(),
            },
        });

        // 6. Gera o token JWT
        const token = jwt.sign({ id: userDB.id }, JWT_SECRET, { expiresIn: '7d' });

        // 7. Retorna o token e as informações do usuário (sem a senha)
        res.status(201).json({
            message: "Usuário criado com sucesso!",
            token,
            user: {
                id: userDB.id,
                name: userDB.name,
                email: userDB.email,
                phone: userDB.phone,
                type: userDB.type,
                createdAt: userDB.createdAt,
            },
        });

    } catch (error) {
        console.error("Erro ao criar conta:", error);
        res.status(500).json({ message: "Erro no servidor ao realizar o cadastro." });
    }
};