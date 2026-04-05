import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client'
import axios from 'axios';
import { uploadAndOptimizeImage } from '../image/uploadImageController.js';
import multer from 'multer';
import { formatAddressFromNominatim, normalizeAddressString } from '../../lib/addressUtils.js';

const prisma = new PrismaClient()

const JWT_SECRET = process.env.JWT_SECRET;

// Cadastrar Usuário
export const register = async (req, res) => {
    try {
        const { email, name, password, phone, type, address, coordinates: coordinatesInput } = req.body;

        // 1. Validação básica de campos obrigatórios
        if (!email || !name || !password || !phone) {
            return res.status(400).json({ message: "Todos os campos são obrigatórios!" });
        }

        // 2. 🔥 Verifica se o usuário já existe por E-mail OU Telefone
        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: email },
                    { phone: phone }
                ]
            }
        });

        if (existingUser) {
            const conflictField = existingUser.email === email ? "e-mail" : "número de telefone";
            return res.status(400).json({ 
                message: `Já existe uma conta cadastrada com este ${conflictField}!` 
            });
        }

        // 3. Coordenadas: prioriza body (ex: GPS do front); senão geocoding pelo endereço
        let coordinates = (coordinatesInput && String(coordinatesInput).trim()) || null;
        let formattedAddress = address ? normalizeAddressString(address) : null;
        if (!coordinates && address) {
            try {
                const encodedAddress = encodeURIComponent(address);
                const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&q=${encodedAddress}&limit=1`;
                
                const response = await axios.get(url, {
                    headers: { 'User-Agent': 'OxenteExpress_App' }
                });

                if (response.data && response.data.length > 0) {
                    coordinates = `${response.data[0].lat},${response.data[0].lon}`;
                    formattedAddress = formatAddressFromNominatim(response.data[0]);
                }
            } catch (geoError) {
                console.error("Erro ao buscar coordenadas no cadastro:", geoError);
            }
        }

        // 4. Validação extra para Lojas
        if (type === 'STORE' && !address) {
            return res.status(400).json({ message: "Lojas precisam cadastrar um endereço fixo." });
        }

        // 5. Criptografa a senha
        const salt = await bcrypt.genSalt(10);
        const hashPassword = await bcrypt.hash(password, salt);

        let finalType = type || "USER";
        if (finalType === "CLIENT") finalType = "USER";

        // 6. Cria o usuário no banco de dados
        let userDB = await prisma.user.create({
            data: {
                email,
                name,
                password: hashPassword,
                phone,
                type: finalType,
                address: formattedAddress || null,
                coordinates: coordinates || null,
                createdAt: new Date(),
            },
        });

        if (req.file) {
            try {
                // O serviço retorna apenas o caminho relativo 'users/id.webp'
                const avatarUrl = await uploadAndOptimizeImage(req.file, 'users', userDB.id);
                
                // Atualiza o usuário recém-criado com o link da imagem
                userDB = await prisma.user.update({
                    where: { id: userDB.id },
                    data: { avatarUrl }
                });
            } catch (uploadError) {
                console.error("Erro ao subir avatar:", uploadError);
            }
        }

        // 7. Gera o token JWT
        const token = jwt.sign({ id: userDB.id }, JWT_SECRET, { expiresIn: '7d' });

        res.status(201).json({
            message: "Usuário criado com sucesso!",
            token,
            user: {
                id: userDB.id,
                name: userDB.name,
                email: userDB.email,
                avatarUrl: userDB.avatarUrl,
                phone: userDB.phone,
                type: userDB.type,
                address: userDB.address,
                coordinates: userDB.coordinates,
                createdAt: userDB.createdAt,
            },
        });

    } catch (error) {
        console.error("Erro ao criar conta:", error);
        res.status(500).json({ message: "Erro no servidor ao realizar o cadastro." });
    }
};