# Oxente Express — Backend

<p align="center">
  Plataforma de delivery inteligente — conectando lojas, entregadores e clientes em Pernambuco.
</p>

## Visão Geral

O Oxente Express é o motor central que conecta pequenos negócios, entregadores e clientes finais. Este repositório gerencia regras de negócio, autenticação, geolocalização, pedidos e suporte com IA — tudo orquestrado via API REST e atualizado em polling para compatibilidade total com Vercel (serverless).

## Tech Stack

<!-- Backend -->
| Camada | Tecnologia |
|---|---|
| Runtime | Node.js 22 |
| Framework HTTP | Express 5 |
| ORM | Prisma 6.5 |
| Banco de Dados | MongoDB Atlas |
| Storage de Imagens | Supabase Storage |
| Autenticação | JWT (jsonwebtoken) + bcrypt |
| Upload de Arquivos | Multer |
| Otimização de Imagens | Sharp |
| CORS | cors (middleware) |
| HTTP Client | axios (geocoding Nominatim, etc.) |
| Testes | Jest + Supertest |
| Dev | Nodemon (hot reload) |
| Deploy | Vercel (serverless) |

<!-- IA & Real-time -->
| Módulo | Detalhes |
|---|---|
| Suporte IA | OpenRouter API — rotação de modelos gratuitos (`qwen/qwen3.6-plus:free`, `openrouter/free`, `minimax/minimax-m2.5:free`, `stepfun/step-3.5-flash:free`) |
| Atualizações em tempo real | HTTP Polling (5s Store/Rider, 8s Customer) — compatível com Vercel serverless |
| Notificações sonoras | Web Audio API no frontend (beep ao detectar novos pedidos) |

## Configuração Local

```bash
# 1. Instale as dependências
npm install

# 2. Configure o .env (copie de .env.example)
cp .env.example .env

# 3. Gere o cliente Prisma
npx prisma generate

# 4. Aplique migrações (se necessário)
npx prisma migrate dev

# 5. Inicie o servidor
npm run dev
```

### Variáveis de Ambiente

| Variável | Descrição | Obrigatória |
|---|---|---|
| `DATABASE_URL` | String de conexão ao MongoDB | Sim |
| `JWT_SECRET` | Chave secreta para assinar tokens JWT | Sim |
| `SUPABASE_URL` | URL do projeto Supabase | Sim |
| `SUPABASE_KEY` | Chave de acesso ao Supabase (service role) | Sim |
| `FRONTEND_URL` | URL do frontend (CORS) | Sim |
| `OPENROUTER_API_KEY` | Chave da API OpenRouter para suporte IA | Não¹ |

> ¹ Necessária apenas se quiser o suporte com IA ativo. Sem ela, a rota retorna 502.

## Estrutura de Rotas

### Públicas

| Método | Path | Descrição |
|---|---|---|
| `POST` | `/cadastro` | Registro de usuário (multipart: nome, email, senha, tipo, imagem) |
| `POST` | `/login` | Login com email e senha |
| `GET` | `/vehicle/fipe/search` | Busca de veículos FIPE |
| `GET` | `/vehicle/fipe/brands` | Marcas FIPE |
| `GET` | `/vehicle/fipe/years` | Anos FIPE por marca/modelo |
| `GET` | `/vehicle/fipe/details` | Detalhes FIPE do veículo |

### Autenticadas (Bearer Token)

| Método | Path | Papel | Descrição |
|---|---|---|---|
| `PUT` | `/update` | Todos | Atualizar perfil do usuário |
| `DELETE` | `/delete-user/:id` | Auth | Deletar conta |
| `POST` | `/stores` | Customer | Buscar lojas próximas (raio configurável, default: 15km) |
| `GET` | `/products` | Auth | Listar todos os produtos |
| `GET` | `/store/:storeId/products` | Customer | Catálogo de uma loja específica |
| `POST` | `/product/create` | Store | Criar produto com imagem |
| `PUT` | `/product/:id` | Store | Atualizar produto |
| `DELETE` | `/product/:id` | Store | Deletar produto |
| `POST` | `/package/order` | Customer | Criar pedido (carrinho) |
| `POST` | `/package/calculate-shipping` | Customer | Calcular taxa de envio |
| `GET` | `/package/customer` | Customer | Meus pedidos |
| `PATCH` | `/package/status` | Store | Atualizar status do pedido |
| `GET` | `/store/orders` | Store | Pedidos ativos da loja |
| `GET` | `/store/history` | Store | Histórico de entregas da loja |
| `POST` | `/store/confirm-pickup` | Store | Confirmar coleta com código |
| `GET` | `/vehicle` | Rider | Veículo do entregador |
| `POST` | `/:id/cadastro_veiculo` | Rider | Cadastrar veículo |
| `PUT` | `/vehicle/update` | Rider | Atualizar veículo |
| `GET` | `/rider/packages` | Rider | Pacotes disponíveis (por localização) |
| `GET` | `/rider/current-delivery` | Rider | Entrega em andamento |
| `POST` | `/rider/accept-package` | Rider | Aceitar pacote |
| `POST` | `/rider/finish-delivery` | Rider | Finalizar entrega (código de entrega) |
| `GET` | `/rider/history` | Rider | Histórico de entregas |
| `POST` | `/support/ai` | Auth | Perguntar ao Oxente AI (suporte IA) |

## Fluxos Principais

### Geolocalização e Busca de Lojas

1. Coordenadas do perfil do usuário (salvas no cadastro)
2. Fallback: geolocalização do navegador via Geolocation API
3. Backend calcula distância com fórmula de Haversine e filtra por raio (default: **15km**)

### Pipeline de Pedidos

```
PENDING → PREPARING → READY → PICKING_UP → IN_TRANSIT → DELIVERED
```

1. **Cliente** cria pedido → status `PENDING`
2. **Loja** inicia preparo → `PREPARING` → marca como pronto → `READY`
3. **Entregador** aceita pacote → `PICKING_UP`
4. **Loja** confirma coleta com código → `IN_TRANSIT`
5. **Entregador** entrega com código do cliente → `DELIVERED`

### Suporte com IA (Oxente AI)

- Endpoint `POST /support/ai` — requer token JWT
- Rate limit: **5 perguntas a cada 30 minutos** por usuário
- Rotação automática entre modelos gratuitos OpenRouter
- Personalidade: informal, pernambucana, conhecedora das regras do app

## Deploy na Vercel

1. Configure todas as variáveis de ambiente no painel da Vercel
2. Push na `main` = deploy automático
3. O arquivo `vercel.json` já está configurado para serverless

> **Nota:** Vercel não suporta conexões persistentes (WebSocket/SSE). O frontend usa polling (setInterval) para atualizações em tempo real — funciona em qualquer ambiente.

## Licença

[MIT](LICENSE)
