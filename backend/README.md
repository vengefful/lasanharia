# Backend Lasanharia

Express 5 + Prisma 6 (SQLite) + Zod. Rotas públicas do cliente (Fase 2). O painel admin entra na Fase 3.

## Rodar

```bash
# da raiz da workspace
pnpm install
cp .env.example .env             # ajuste se precisar
pnpm db:migrate                  # cria o schema + roda o seed
pnpm --filter backend dev        # sobe em http://localhost:3000 com hot reload
```

Outros scripts:
```bash
pnpm --filter backend build      # compila TS para dist/
pnpm --filter backend start      # roda dist/index.js (produção)
pnpm db:studio                   # Prisma Studio em http://localhost:5555
```

## Rotas

Todas as respostas são JSON. Erros no formato `{ "error": { "code": "...", "message": "..." } }`.

### `GET /api/health`
Sanity check.
```bash
curl -s http://localhost:3000/api/health
```

### `GET /api/store`
Configuração da loja (nome, WhatsApp, horário, etc).
```bash
curl -s http://localhost:3000/api/store | jq
```

### `GET /api/categories`
Categorias ativas, ordenadas por `sortOrder`.
```bash
curl -s http://localhost:3000/api/categories | jq
```

### `GET /api/products`
Produtos disponíveis (com a categoria embutida). Filtro opcional `?categoryId=<id>`.
```bash
curl -s http://localhost:3000/api/products | jq
curl -s 'http://localhost:3000/api/products?categoryId=1' | jq
```

### `GET /api/delivery-zones`
Bairros atendidos + taxa em centavos.
```bash
curl -s http://localhost:3000/api/delivery-zones | jq
```

### `POST /api/orders`
Cria um pedido. **O servidor é a fonte da verdade dos preços e totais** — qualquer `price` enviado no corpo é ignorado.

Campos:
- `customerName`, `customerPhone` — obrigatórios.
- `orderType` — `"entrega"` ou `"retirada"`.
- `address`, `addressNumber`, `neighborhood` — obrigatórios se `entrega`.
- `reference`, `notes` — opcionais.
- `paymentMethod` — `"Pix"`, `"Cartão na entrega"` ou `"Dinheiro"`.
- `changeFor` — em centavos, só para `Dinheiro`; precisa ser ≥ total.
- `items` — array `[{ productId, quantity }]`, mínimo 1.

Exemplo entrega + dinheiro:
```bash
curl -s -X POST http://localhost:3000/api/orders \
  -H 'Content-Type: application/json' \
  -d '{
    "customerName": "Fernando",
    "customerPhone": "11987654321",
    "orderType": "entrega",
    "address": "Rua das Massas",
    "addressNumber": "123",
    "neighborhood": "Centro",
    "reference": "portão azul",
    "notes": "sem cebola",
    "paymentMethod": "Dinheiro",
    "changeFor": 10000,
    "items": [
      { "productId": 2, "quantity": 1 },
      { "productId": 5, "quantity": 2 }
    ]
  }' | jq
```

Exemplo retirada + pix:
```bash
curl -s -X POST http://localhost:3000/api/orders \
  -H 'Content-Type: application/json' \
  -d '{
    "customerName": "Maria",
    "customerPhone": "11912345678",
    "orderType": "retirada",
    "paymentMethod": "Pix",
    "items": [{ "productId": 1, "quantity": 2 }]
  }' | jq
```

Resposta (201):
```json
{
  "id": 1,
  "orderNumber": 1000,
  "customerName": "Fernando",
  "subtotal": 5700,
  "deliveryFee": 500,
  "total": 6200,
  "status": "Pendente",
  "items": [
    { "productId": 2, "productName": "Lasanha de Frango Grande", "quantity": 1, "unitPrice": 4500, "totalPrice": 4500 },
    { "productId": 5, "productName": "Coca-Cola 350ml", "quantity": 2, "unitPrice": 600, "totalPrice": 1200 }
  ],
  "...": "..."
}
```

Erros comuns (status 400):
- `STORE_CLOSED` — `StoreConfig.isOpen=false`; pedido recusado antes de qualquer outra checagem.
- `VALIDATION_ERROR` — campo faltando/inválido (Zod).
- `PRODUCT_NOT_FOUND` — `productId` não existe.
- `PRODUCT_UNAVAILABLE` — produto marcado como indisponível.
- `DELIVERY_ZONE_NOT_FOUND` — bairro não cadastrado em `DeliveryZone`.
- `CHANGE_LESS_THAN_TOTAL` — `changeFor` menor que o total.

## Estrutura
```
backend/
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
└── src/
    ├── index.ts              # entrypoint (sobe o servidor)
    ├── app.ts                # createApp(): CORS, json, rotas, errorHandler
    ├── env.ts                # validação de env com Zod
    ├── prisma.ts             # singleton do PrismaClient
    ├── middleware/
    │   └── errorHandler.ts   # HttpError, notFound, errorHandler
    └── routes/
        ├── store.ts
        ├── categories.ts
        ├── products.ts
        ├── deliveryZones.ts
        └── orders.ts
```

## Notas
- Valores monetários em **centavos** (Int). Conversão para reais só na borda. Ver `CLAUDE.md` na raiz.
- `orderNumber` é sequencial começando em 1000, gerado dentro de transação com retry em colisão única.
- `OrderItem` grava `productName` e `unitPrice` no momento do pedido — histórico imutável mesmo se o produto for editado/deletado depois.
