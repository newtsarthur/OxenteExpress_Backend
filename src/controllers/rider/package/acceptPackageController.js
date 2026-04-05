import { PrismaClient } from '@prisma/client';
import { getIo } from '../../../lib/socket.js';

const prisma = new PrismaClient();

export const acceptPackage = async (req, res) => {
  try {
    const { packageId } = req.body;
    const riderId = req.userId;

    // 1. Verifica se o pacote existe e se ainda está disponível (READY)
    const pkg = await prisma.package.findUnique({
      where: { id: packageId },
      include: { store: true } // Incluímos a loja para retornar os dados de coleta
    });

    if (!pkg) {
      return res.status(404).json({ message: "Pedido não encontrado." });
    }

    if (pkg.status !== 'READY') {
      return res.status(400).json({ message: "Este pedido não está mais disponível para coleta." });
    }

    // 2. Transação: Cria o Batch e vincula o Pacote
    const result = await prisma.$transaction(async (tx) => {
      const newBatch = await tx.batch.create({
        data: {
          riderId: riderId,
          status: 'STARTING',
        }
      });

      const updatedPackage = await tx.package.update({
        where: { id: packageId },
        data: { 
          status: 'PICKING_UP',
          batchId: newBatch.id 
        }
      });

      return { newBatch, updatedPackage };
    });

    const io = getIo();
    if (io) {
      io.emit('customer_order_status', {
        packageId,
        status: 'PICKING_UP',
      });
      io.emit('rider_packages_updated', {
        packageId,
        status: 'PICKING_UP',
      });
    }

    // 3. Resposta com as informações de coleta "liberadas"
    res.status(200).json({
      message: "Pedido aceito! Siga para a loja para realizar a coleta.",
      batchId: result.newBatch.id,
      orderNumber: pkg.orderNumber,
      status: "PICKING_UP",
      // Informações que o entregador precisa AGORA:
      pickupCode: pkg.pickupCode, 
      store: {
        name: pkg.store.name,
        address: pkg.store.address,
      }
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};