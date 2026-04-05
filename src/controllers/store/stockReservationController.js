import { PrismaClient } from '@prisma/client';
import { getIo } from '../../lib/socket.js';

const prisma = new PrismaClient();

// Cache de reservas temporárias com timestamp (em produção, usar Redis ou similar)
const stockReservations = new Map();

// Tempo de expiração das reservas (30 minutos)
const RESERVATION_TIMEOUT = 30 * 60 * 1000;

export const handleStockReservation = async (socket, data) => {
  try {
    const { productId, quantity, action } = data;
    const userId = socket.userId;

    console.log(`[stockReservation] ${action} ${quantity} units of product ${productId} for user ${userId}`);

    // Busca o produto atual
    const product = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product) {
      socket.emit('stock_reservation_error', {
        productId,
        error: 'Produto não encontrado'
      });
      return;
    }

    // Calcula reserva atual do usuário para este produto
    const reservationKey = `${userId}-${productId}`;
    const currentReservation = stockReservations.get(reservationKey);
    const now = Date.now();

    let currentReservedQuantity = 0;
    if (currentReservation && (now - currentReservation.timestamp) < RESERVATION_TIMEOUT) {
      currentReservedQuantity = currentReservation.quantity;
    } else if (currentReservation) {
      // Reserva expirada, remove
      stockReservations.delete(reservationKey);
    }

    let newReservedQuantity = currentReservedQuantity;

    if (action === 'reserve') {
      // Verifica se há estoque suficiente
      const availableStock = product.quantity - currentReservedQuantity;
      if (availableStock < quantity) {
        socket.emit('stock_reservation_error', {
          productId,
          error: 'Estoque insuficiente',
          available: availableStock
        });
        return;
      }

      newReservedQuantity = currentReservedQuantity + quantity;

    } else if (action === 'restore') {
      newReservedQuantity = Math.max(0, currentReservedQuantity - quantity);
    }

    // Atualiza cache de reservas
    if (newReservedQuantity > 0) {
      stockReservations.set(reservationKey, {
        quantity: newReservedQuantity,
        timestamp: now
      });
    } else {
      stockReservations.delete(reservationKey);
    }

    // Emite atualização para todos os clientes conectados
    const io = getIo();
    if (io) {
      io.emit('product_updated', {
        action: 'update',
        product: {
          ...product,
          quantity: product.quantity - newReservedQuantity // Mostra estoque disponível
        }
      });
    }

    // Confirma a reserva para o usuário
    socket.emit('stock_reservation_success', {
      productId,
      action,
      quantity,
      reserved: newReservedQuantity,
      available: product.quantity - newReservedQuantity
    });

  } catch (error) {
    console.error('[stockReservation] Error:', error);
    socket.emit('stock_reservation_error', {
      productId: data.productId,
      error: 'Erro interno do servidor'
    });
  }
};

// Função para confirmar compra e reduzir estoque permanentemente
export const confirmStockPurchase = async (userId, cartItems) => {
  try {
    for (const item of cartItems) {
      const reservationKey = `${userId}-${item.product.id}`;

      // Remove a reserva temporária
      stockReservations.delete(reservationKey);

      // Reduz o estoque permanentemente
      await prisma.product.update({
        where: { id: item.product.id },
        data: {
          quantity: {
            decrement: item.quantity
          }
        }
      });
    }

    // Busca produtos atualizados e emite atualização
    const productIds = cartItems.map(item => item.product.id);
    const updatedProducts = await prisma.product.findMany({
      where: {
        id: { in: productIds }
      }
    });

    const io = getIo();
    if (io) {
      updatedProducts.forEach(product => {
        io.emit('product_updated', {
          action: 'update',
          product
        });
      });
    }

  } catch (error) {
    console.error('[confirmStockPurchase] Error:', error);
    throw error;
  }
};

// Função para limpar reservas expiradas
export const cleanupExpiredReservations = () => {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, reservation] of stockReservations.entries()) {
    if ((now - reservation.timestamp) >= RESERVATION_TIMEOUT) {
      stockReservations.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`[cleanup] Removed ${cleaned} expired stock reservations`);
  }
};