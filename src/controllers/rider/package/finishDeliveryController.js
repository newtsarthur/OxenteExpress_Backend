import { PrismaClient } from '@prisma/client';
import { getIo } from '../../../lib/socket.js';

const prisma = new PrismaClient();

export const finishDelivery = async (req, res) => {
  try {
    const { packageId, deliveryCode } = req.body;
    const riderId = req.userId;

    // 1. Busca o pacote e inclui o Batch para validar o entregador
    const pkg = await prisma.package.findUnique({
      where: { id: packageId },
      include: { batch: true }
    });

    if (!pkg) return res.status(404).json({ message: "Pedido não encontrado." });
    
    // 2. Valida se este entregador é o dono do lote/pacote
    if (!pkg.batch || pkg.batch.riderId !== riderId) {
      return res.status(403).json({ message: "Você não tem permissão para finalizar este pedido." });
    }

    // 3. Valida o código de entrega (informado pelo cliente)
    if (pkg.deliveryCode !== deliveryCode) {
      return res.status(400).json({ message: "Código de entrega incorreto!" });
    }

    // 4. Finaliza o pacote e o lote
    await prisma.$transaction(async (tx) => {
      await tx.package.update({
        where: { id: packageId },
        data: { 
          status: 'DELIVERED',
          // O Prisma já atualiza o @updatedAt automaticamente, 
          // mas você pode forçar o envio de um novo Date se quiser ser redundante:
          updatedAt: new Date() 
        }
      });

      await tx.batch.update({
        where: { id: pkg.batchId },
        data: {
          status: 'COMPLETED',
        },
      });
    });

    const io = getIo();
    if (io) {
      io.emit('customer_order_status', {
        packageId,
        status: 'DELIVERED',
      });
    }

    res.status(200).json({ 
      message: "Entrega finalizada com sucesso! Bom trabalho.",
      orderNumber: pkg.orderNumber,
      status: "DELIVERED"
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};