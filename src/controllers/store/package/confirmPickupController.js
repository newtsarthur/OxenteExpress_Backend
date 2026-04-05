import { PrismaClient } from '@prisma/client';
import { getIo } from '../../../lib/socket.js';

const prisma = new PrismaClient();

export const confirmPickup = async (req, res) => {
  try {
    const { packageId, pickupCode } = req.body;
    const storeId = req.userId; // ID da loja logada

    // 1. Busca o pacote e valida se pertence à loja
    const pkg = await prisma.package.findUnique({
      where: { id: packageId }
    });

    if (!pkg) return res.status(404).json({ message: "Pedido não encontrado." });
    if (pkg.storeId !== storeId) return res.status(403).json({ message: "Acesso negado." });

    // 2. Valida o código de coleta
    if (pkg.pickupCode !== pickupCode) {
      return res.status(400).json({ message: "Código de coleta inválido!" });
    }

    // 3. Transação para atualizar pacote e lote
    await prisma.$transaction(async (tx) => {
      await tx.package.update({
        where: { id: packageId },
        data: { status: 'IN_TRANSIT' }
      });

      if (pkg.batchId) {
        await tx.batch.update({
          where: { id: pkg.batchId },
          data: { status: 'IN_PROGRESS' }
        });
      }
    });

    const io = getIo();
    if (io) {
      io.emit('customer_order_status', {
        packageId,
        status: 'IN_TRANSIT',
      });
      io.emit('rider_packages_updated', {
        packageId,
        status: 'IN_TRANSIT',
      });
    }

    res.status(200).json({ 
      message: "Coleta confirmada! O pedido agora está em trânsito.",
      orderNumber: pkg.orderNumber,
      newStatus: "IN_TRANSIT"
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};