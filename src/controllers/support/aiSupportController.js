import { createClient } from '@supabase/supabase-js';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Modelos gratuitos — rotação em caso de falha
const MODELS = [
  'qwen/qwen3.6-plus:free',
  'openrouter/free', // Routed automatically to a free model
  'minimax/minimax-m2.5:free',
  'stepfun/step-3.5-flash:free',
];

const API_KEY = process.env.OPENROUTER_API_KEY;

// Rate limit em memória: userId -> { timestamps: number[] }
const RATE_LIMIT = new Map();
const MAX_REQUESTS = 5;
const WINDOW_MS = 30 * 60 * 1000; // 30 minutos

const SYSTEM_PROMPT = `Você é o **Oxente AI**, assistente de suporte do aplicativo Oxente Express — um app de delivery de Pernambuco.

Informações sobre o app:
- O Oxente Express conecta lojas, clientes e entregadores.
- O raio de busca por lojas é de 15km.
- Clientes podem navegar lojas próximas, adicionar produtos ao carrinho e fazer pedidos.
- Lojas gerenciam produtos e pedidos (pendente, preparando, pronto).
- Entregadores aceitam pacotes disponíveis e fazem entregas.
- O status do pedido passa por: PENDING → PREPARING → READY → PICKING_UP → IN_TRANSIT → DELIVERED.

Personalidade:
- Chame-se "Oxente AI".
- Seja prestativo, informal e use expressões pernambucanas leves (ex: "oxente", "vixe", "massa", "bom demais", "fiote").
- Mantenha respostas curtas e úteis.
- Fale em português brasileiro.`;

function getTimestamps(userId) {
  const entry = RATE_LIMIT.get(userId);
  if (!entry || Date.now() - entry.lastCleanup > WINDOW_MS) {
    if (entry) {
      RATE_LIMIT.delete(userId);
    }
    return [];
  }
  return entry.timestamps;
}

function record(userId) {
  const entry = RATE_LIMIT.get(userId);
  if (!entry) {
    RATE_LIMIT.set(userId, { timestamps: [Date.now()], lastCleanup: Date.now() });
    return;
  }
  entry.timestamps.push(Date.now());
}

export const askAI = async (req, res) => {
  try {
    const userId = req.userId;
    const { message, history } = req.body;

    if (!message?.trim()) {
      return res.status(400).json({ error: 'Informe uma mensagem.' });
    }

    // Rate limit
    const timestamps = getTimestamps(userId);
    if (timestamps.length >= MAX_REQUESTS) {
      return res.status(429).json({
        error: 'Vixe! O assistente está descansando um pouco. Tente novamente em alguns minutos.',
        limited: true,
      });
    }

    record(userId);
    const used = timestamps.length + 1;
    const remaining = MAX_REQUESTS - used;

    // Montar mensagens
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...(history || []).map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: message.trim() },
    ];

    // Tentar modelos em ordem até um responder
    let response;
    let lastError;
    for (const model of MODELS) {
      try {
        response = await fetch(OPENROUTER_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://oxente-express.vercel.app',
            'X-Title': 'Oxente Express',
          },
          body: JSON.stringify({
            model,
            messages,
            max_tokens: 500,
            temperature: 0.7,
          }),
          signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) {
          const errBody = await response.text().catch(() => '');
          lastError = `Model ${model} returned ${response.status}: ${errBody}`;
          continue;
        }

        const data = await response.json();
        const reply = data.choices?.[0]?.message?.content;
        if (reply) {
          return res.json({
            reply,
            remaining: Math.max(0, remaining),
            model,
          });
        }

        lastError = `Model ${model} returned empty response`;
      } catch (err) {
        lastError = err.message;
      }
    }

    // Nenhum modelo respondeu
    res.status(502).json({
      error: 'Oxente! Os assistentes estão indisponíveis agora. Tente novamente em instantes.',
      details: lastError,
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
