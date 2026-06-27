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
- `CHANGE_LESS_THAN_TOTAL` — `changeFor` menor que o total.

## Rotas admin (Fase 3)

Login é a única rota pública sob `/api/admin`. Todas as outras exigem header
`Authorization: Bearer <token>`. Sem token → `401 AUTH_MISSING`. Token
inválido/expirado → `401 AUTH_INVALID` / `401 AUTH_EXPIRED`.

### `POST /api/admin/login`
```bash
curl -s -X POST http://localhost:3000/api/admin/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@admin.com","password":"admin123"}' | jq
# → { "token": "...", "expiresIn": "12h", "admin": { "id": 1, "email": "..." } }
```

Use o token assim:
```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/admin/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@admin.com","password":"admin123"}' | jq -r .token)
```

### Pedidos
```bash
# Lista (mais recentes primeiro). Filtros: ?status=Pendente&take=50
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/admin/orders | jq

# Mudar status (valida contra a lista permitida)
curl -s -X PATCH -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"status":"Confirmado"}' \
  http://localhost:3000/api/admin/orders/1/status | jq
```
Status permitidos: `Pendente`, `Confirmado`, `Em preparo`, `Saiu para entrega`, `Entregue`, `Cancelado`.

### Produtos
```bash
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/admin/products | jq

curl -s -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Pudim","description":"de leite","price":900,"categoryId":1}' \
  http://localhost:3000/api/admin/products | jq

curl -s -X PUT -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"available":false}' \
  http://localhost:3000/api/admin/products/9 | jq

curl -s -X DELETE -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/admin/products/9 -o /dev/null -w '%{http_code}\n'
```

### Categorias
```bash
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/admin/categories | jq
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Sobremesas","sortOrder":4}' http://localhost:3000/api/admin/categories | jq
curl -s -X PUT  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"active":false}' http://localhost:3000/api/admin/categories/4 | jq
```

### Configuração da loja
Inclui o **frete único** (`deliveryFee`, em centavos; 0 = grátis). Não existe mais tabela de zonas por bairro — bairro é texto livre no pedido.
```bash
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/admin/store | jq
curl -s -X PUT -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"isOpen":false,"announcement":"Fechados para limpeza, voltamos 19h"}' \
  http://localhost:3000/api/admin/store | jq
curl -s -X PUT -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"deliveryFee":700}' http://localhost:3000/api/admin/store | jq
```

## Estrutura
```
backend/
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
└── src/
    ├── index.ts                  # entrypoint (sobe o servidor)
    ├── app.ts                    # createApp(): CORS, json, rotas, errorHandler
    ├── env.ts                    # validação de env (DATABASE_URL, JWT_SECRET, PORT)
    ├── prisma.ts                 # singleton do PrismaClient
    ├── middleware/
    │   ├── errorHandler.ts       # HttpError, notFound, errorHandler
    │   └── requireAuth.ts        # valida Bearer JWT, anexa req.admin
    └── routes/
        ├── store.ts              # GET /api/store
        ├── categories.ts         # GET /api/categories
        ├── products.ts           # GET /api/products
        ├── orders.ts             # POST /api/orders
        └── admin/
            ├── index.ts          # monta /api/admin (login solto, resto protegido)
            ├── login.ts          # POST /api/admin/login
            ├── orders.ts         # GET, PATCH /:id/status
            ├── products.ts       # GET, POST, PUT, DELETE
            ├── categories.ts     # GET, POST, PUT
            └── store.ts          # GET, PUT (inclui deliveryFee)
```

## Notas
- Valores monetários em **centavos** (Int). Conversão para reais só na borda. Ver `CLAUDE.md` na raiz.
- `orderNumber` é sequencial começando em 1000, gerado dentro de transação com retry em colisão única.
- `OrderItem` grava `productName` e `unitPrice` no momento do pedido — histórico imutável mesmo se o produto for editado/deletado depois.
