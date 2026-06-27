# Lasanharia — sistema de pedidos para loja única

## Objetivo
Cardápio digital + carrinho + finalização de pedido via link `wa.me` do WhatsApp (sem API oficial) para uma pequena loja de lasanhas e refrigerantes. Inclui um painel administrativo para gerenciar produtos, categorias, taxas de entrega, configurações da loja e acompanhar pedidos.

Não é multi-loja, não é multi-tenant. Uma loja, um cardápio.

## Stack
- **Monorepo**: pnpm workspace na raiz (`/backend`, `/frontend`, `/docs`)
- **Backend**: Node.js + Express + TypeScript
- **ORM**: Prisma com SQLite (arquivo local em `backend/prisma/dev.db`)
- **Validação**: Zod em toda entrada HTTP
- **Auth admin**: JWT (assinado com `JWT_SECRET`) + bcrypt para hash de senha
- **Frontend**: React + Vite + TypeScript + Tailwind + React Router + Zustand (mobile first)

## Decisões arquiteturais (não mudar sem motivo forte)

### SQLite proposital
Uma loja única, baixo volume, deploy em LXC ou VPS pequeno. SQLite dá: zero config, backup trivial (`cp dev.db backup.db`), performance sobrando. **Não migrar para Postgres** a menos que apareça multi-loja real.

### Valores monetários em centavos (inteiro)
Todos os campos de dinheiro (`price`, `unitPrice`, `totalPrice`, `subtotal`, `deliveryFee`, `total`, `changeFor`, `fee`) são `Int` em centavos. `2500` → R$ 25,00. Evita ponto flutuante e arredondamento traiçoeiro. Conversão `/100` acontece só na exibição (frontend) e na mensagem do WhatsApp.

### Totais calculados no backend, sempre
O cliente envia apenas `productId` + `quantity`. Preço, subtotal, taxa de entrega e total são calculados pelo servidor a partir do banco. O preço enviado pelo cliente é ignorado. Em `POST /api/orders`, o servidor:
1. Busca o preço atual de cada produto.
2. Recusa item indisponível.
3. Calcula `subtotal = Σ unitPrice × quantity`.
4. `deliveryFee` = 0 se retirada; senão usa **`StoreConfig.deliveryFee`** (frete único, 0 = grátis).
5. `total = subtotal + deliveryFee`.
6. Persiste `OrderItem` com `productName` e `unitPrice` **congelados** — histórico imutável.

### Frete único na loja (não por bairro)
Cidade pequena, taxa única ou grátis. O frete vive em `StoreConfig.deliveryFee` (centavos, default 0). O bairro do cliente é texto livre, capturado só para o atendente saber onde entregar; não há tabela ativa de zonas no fluxo de pedido.

O model `DeliveryZone` e suas rotas admin continuam no projeto como **legado** (não usados pelo cliente). Podem servir no futuro se a loja crescer; por ora estão dormindo.

### Número do WhatsApp — fonte da verdade única
O número que recebe o pedido fica em **`StoreConfig.whatsappNumber`** no banco. O frontend lê via `GET /api/store` e usa em `buildWhatsAppUrl(store.whatsappNumber, ...)`. Não há env var no frontend para isso.

`STORE_WHATSAPP_NUMBER` no `.env` é **apenas o default inicial do seed** (`backend/prisma/seed.ts`). Para mudar em produção, editar via painel admin (Fase 5) ou direto no Prisma Studio — não recriar `.env` nem rodar seed.

### Finalização via wa.me, não WhatsApp Business API
O frontend monta uma mensagem textual com os dados do pedido e abre `https://wa.me/<STORE_WHATSAPP_NUMBER>?text=<encodeURIComponent(mensagem)>`. O atendente lê na conversa e confirma manualmente. Sem custos de API, sem aprovação Meta, sem template — basta um WhatsApp comum.

### Status do pedido como string livre no banco
A validação contra a lista permitida (`Pendente`, `Confirmado`, `Em preparo`, `Saiu para entrega`, `Entregue`, `Cancelado`) acontece no backend via Zod, não em enum do Prisma. Evita migration sempre que a lista mudar.

### `orderNumber` sequencial começando em 1000
Mais agradável visualmente que ID 1, 2, 3. Race condition é desprezível (uma loja, baixo throughput), mas mesmo assim será gerado dentro de transação na Fase 2.

## Estrutura
```
/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   ├── src/                 (Fase 2 em diante)
│   ├── package.json
│   └── tsconfig.json
├── frontend/                (Fase 4 em diante)
├── docs/                    (Fase 6)
├── pnpm-workspace.yaml
├── package.json
├── .env.example
├── .gitignore
└── CLAUDE.md
```

## Roadmap das 6 fases
1. **Fase 1 (esta)** — Estrutura do monorepo, schema Prisma, seed. Sem rotas, sem frontend.
2. **Fase 2** — Backend: rotas públicas (`/api/store`, `/api/categories`, `/api/products`, `/api/delivery-zones`, `POST /api/orders`). Express, Zod, cálculo de totais no servidor.
3. **Fase 3** — Backend admin: `POST /api/admin/login` (JWT + bcrypt), middleware de auth, CRUD protegido de pedidos/produtos/categorias/zonas/loja.
4. **Fase 4** — Frontend cliente: cardápio, carrinho (Zustand), checkout, abre `wa.me` com a mensagem do pedido.
5. **Fase 5** — Painel admin no frontend (rotas `/admin`): login, lista de pedidos com polling, mudar status, CRUD de produtos/categorias/zonas, configurar loja.
6. **Fase 6** — Documentação de deploy: README local + `docs/deploy-lxc.md` (Nginx + PM2 em LXC Ubuntu/Debian no Proxmox), backup do SQLite.

## Comandos úteis (depois do `pnpm install`)
```bash
pnpm db:migrate         # cria/atualiza o schema no SQLite
pnpm db:seed            # popula com dados iniciais (loja, categorias, produtos, admin)
pnpm db:studio          # abre Prisma Studio em http://localhost:5555
pnpm db:reset           # apaga o banco e roda migration + seed do zero
```

## Lembretes de segurança antes de produção
- Trocar a senha do admin padrão (`admin@admin.com` / `admin123`) — está no seed só para desenvolvimento.
- Gerar `JWT_SECRET` forte e único (`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`).
- Confirmar que `.env` não está versionado.
- Definir `STORE_WHATSAPP_NUMBER` real (formato `5511999999999`).
