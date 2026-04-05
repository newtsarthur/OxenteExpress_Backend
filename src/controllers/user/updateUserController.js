import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { uploadAndOptimizeImage } from '../image/uploadImageController.js';
import { normalizeAddressString } from '../../lib/addressUtils.js';
import { getIo } from '../../lib/socket.js';

const prisma = new PrismaClient();

export const updateUser = async (req, res) => {
  try {
    const userId = req.userId; // ID extraído do token pelo middleware de auth
    const { name, email, password, phone, address, coordinates } = req.body;

    // 1. Validações de duplicidade (E-mail e Telefone)
    if (email || phone) {
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [
            email ? { email } : null,
            phone ? { phone } : null
          ].filter(Boolean),
          NOT: { id: userId } // Garante que não estamos comparando com o próprio usuário
        }
      });

      if (existingUser) {
        return res.status(400).json({ message: "E-mail ou Telefone já estão em uso por outra conta." });
      }
    }

    // 2. Prepara o objeto de atualização
    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (phone) updateData.phone = phone;
    if (address) updateData.address = normalizeAddressString(address);
    if (coordinates !== undefined && coordinates !== null && String(coordinates).trim() !== "") {
      updateData.coordinates = String(coordinates).trim();
    }
    
    if (password) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(password, salt);
    }

    // 3. 🔥 Lógica da Imagem (Avatar)
    if (req.file) {
      try {
        // O serviço usa o ID do usuário para o nome do arquivo: users/userId.webp
        const avatarPath = await uploadAndOptimizeImage(req.file, 'users', userId);
        console.log(`[updateUser] new avatarPath for user ${userId}:`, avatarPath);
        updateData.avatarUrl = avatarPath; // Salva apenas o caminho relativo no banco
      } catch (uploadError) {
        console.error("Erro ao processar nova imagem de perfil:", uploadError);
        return res.status(500).json({ message: "Falha ao processar a imagem de perfil.", error: uploadError.message || uploadError });
      }
    }

    // 4. Executa o update no Prisma
    let updatedUser;
    try {
      updatedUser = await prisma.user.update({
        where: { id: userId },
        data: updateData,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          type: true,
          avatarUrl: true,
          address: true,
          coordinates: true,
        },
      });
      console.log(`[updateUser] Salvando no banco para user ${userId}:`, updateData);
    } catch (dbError) {
      console.error(`[updateUser] Erro ao salvar no banco para user ${userId}:`, dbError);
      return res.status(500).json({ message: "Falha ao salvar o perfil no banco.", error: dbError.message || dbError });
    }

    // 5. Emite evento de atualização via Socket.io
    const io = getIo();
    if (io) {
      io.emit('user_updated', {
        action: 'update',
        user: updatedUser
      });
    }

    res.status(200).json({ 
      message: "Perfil atualizado com sucesso!", 
      user: updatedUser 
    });

  } catch (error) {
    res.status(500).json({ message: "Erro ao atualizar perfil.", error: error.message });
  }
};