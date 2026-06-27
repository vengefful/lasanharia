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
Cidade pequena, taxa única ou grátis. O frete vive em `StoreConfig.deliveryFee` (centavos, default 0). O bairro do cliente é texto livre, capturado só para o atendente saber onde entregar.

O sistema antigo de **zonas por bairro** (`model DeliveryZone`) foi removido por completo na migration `remove_delivery_zone`: o model, as rotas (`GET /api/delivery-zones` e `/api/admin/delivery-zones`), o seed e os tipos no frontend não existem mais. Se um dia for preciso voltar a cobrar por bairro, recriar do zero.

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
├── backend/                  Express 5 + Prisma 6 + SQLite
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── seed.ts           (DEV — loja + 8 produtos + admin@admin.com/admin123)
│   │   ├── seed.prod.ts      (PROD — enxuto, loja fechada, admin via env, sem produtos)
│   │   └── migrations/
│   ├── src/                  (entrypoint, app, rotas públicas + /admin, middleware)
│   ├── package.json
│   └── tsconfig.json
├── frontend/                 React 18 + Vite + Tailwind + RR6 + Zustand
│   ├── src/
│   │   ├── pages/            cliente (Storefront, Cart, Checkout, OrderSuccess)
│   │   ├── admin/            painel (Summary, Orders, Customers, Products, Categories, Store)
│   │   ├── components/       Header, CategoryTabs, ProductCard, CartFloatingButton
│   │   ├── lib/              format, whatsapp, maps, customerInfo
│   │   ├── store/cart.ts     Zustand + localStorage
│   │   └── api/client.ts     fetch wrapper público
│   └── package.json
├── docs/
│   └── deploy-lxc.md         guia de produção
├── README.md                 setup local no macOS
├── pnpm-workspace.yaml
├── package.json
├── .env.example
├── .gitignore
└── CLAUDE.md
```

## Arquitetura de produção (Fase 6)

Container **LXC Ubuntu/Debian** no Proxmox, single-tenant, sem IP público:

```
Internet ──► Cloudflare (HTTPS) ──► Cloudflare Tunnel
                                          │
                                          ▼
                                    cloudflared (no LXC)
                                          │
                                          ▼
                                  Nginx :80 (no LXC)
                                  ├── /           → dist/ estático (SPA com try_files)
                                  └── /api/*      → 127.0.0.1:3000
                                                          │
                                                          ▼
                                                  Backend Node (PM2)
                                                          │
                                                          ▼
                                                  SQLite (arquivo local)
```

Pontos não-óbvios:
- **HTTPS é terminado na Cloudflare**, não no Nginx — sem Certbot/Let's Encrypt, sem porta aberta no roteador.
- O DNS do domínio (`.com.br` registrado no registro.br) precisa estar gerenciado pela Cloudflare.
- O backend escuta em `127.0.0.1:3000` e o Nginx escuta em `127.0.0.1:80`; o único processo que fala com o mundo é o `cloudflared`.
- **Backup do SQLite** é `sqlite3 .backup` (não `cp` cru, pra não corromper durante escrita), cron diário, replicado para fora do LXC.
- **Seeds não se misturam**: dev (`db:seed`) e prod (`db:seed:prod`) coexistem. Em produção rodar `db:seed` ou `db:reset` apaga dados reais. O `db:seed:prod` se recusa a rodar se `Order > 0`.

## Documentação operacional

- [`README.md`](./README.md) — setup local no macOS (Mac, node, pnpm, .env, migrations, seed de dev).
- [`docs/deploy-lxc.md`](./docs/deploy-lxc.md) — deploy de produção passo a passo (LXC, cloudflared, Nginx, PM2, seed de prod, backup, restauração).
- [`backend/README.md`](./backend/README.md) — cheat-sheet das rotas com exemplos de `curl`.

## Roadmap das 6 fases
1. **Fase 1 (esta)** — Estrutura do monorepo, schema Prisma, seed. Sem rotas, sem frontend.
2. **Fase 2** — Backend: rotas públicas (`/api/store`, `/api/categories`, `/api/products`, `POST /api/orders`). Express, Zod, cálculo de totais no servidor.
3. **Fase 3** — Backend admin: `POST /api/admin/login` (JWT + bcrypt), middleware de auth, CRUD protegido de pedidos/produtos/categorias/zonas/loja.
4. **Fase 4** — Frontend cliente: cardápio, carrinho (Zustand), checkout, abre `wa.me` com a mensagem do pedido.
5. **Fase 5** — Painel admin no frontend (rotas `/admin`): login, lista de pedidos com polling, mudar status, CRUD de produtos/categorias/zonas, configurar loja.
6. **Fase 6** — Documentação de deploy: README local + `docs/deploy-lxc.md` (Nginx + PM2 em LXC Ubuntu/Debian no Proxmox), backup do SQLite.

## Comandos úteis (depois do `pnpm install`)
```bash
pnpm db:migrate         # cria/atualiza o schema no SQLite
pnpm db:seed            # seed de DEV (loja+produtos+admin@admin.com de teste)
pnpm db:studio          # abre Prisma Studio em http://localhost:5555
pnpm db:reset           # apaga o banco e roda migration + seed (dev) do zero

# Seed de PRODUÇÃO — roda UMA vez no pré-lançamento, exige envs de admin:
ADMIN_EMAIL=dona.maria@exemplo.com ADMIN_PASSWORD='senha-forte' \
  pnpm --filter backend db:seed:prod
```

## Dois seeds — diferenças que importam

| Aspecto | `prisma/seed.ts` (DEV) | `prisma/seed.prod.ts` (PROD) |
|---|---|---|
| **Quando rodar** | Sempre, no Mac, em desenvolvimento | UMA vez no pré-lançamento |
| **StoreConfig** | Dados de teste preenchidos, `isOpen: true` | Defaults neutros, **`isOpen: false`** (segurança) |
| **Categorias** | 3 (Lasanhas, Refrigerantes, Combos) | Mesmas 3 (find-or-create) |
| **Produtos** | 8 de teste | **Nenhum** — Dona Maria cadastra pelo painel |
| **AdminUser** | `admin@admin.com` / `admin123` hardcoded | `ADMIN_EMAIL` / `ADMIN_PASSWORD` do env (mín. 10 chars) |
| **Pedidos** | Não cria, mas faz `deleteMany` para rodar idempotente | Nunca toca; **aborta se `Order` > 0** |
| **Idempotência** | Wipe-and-create | Find-or-create + upsert no admin (seguro p/ rerodar antes do lançamento) |

O seed de prod tem dois guard-rails que não existem no de dev:
1. **Aborta se já houver pedidos** no banco — proteção contra rodar por engano em banco operando.
2. **Aborta sem ADMIN_EMAIL/ADMIN_PASSWORD** — nada de senha hardcoded em produção.

## Lembretes de segurança antes de produção
- **Trocar o seed**: rodar `db:seed:prod` (não `db:seed`) na primeira subida; nunca usar `admin@admin.com` / `admin123` fora do Mac.
- Gerar `JWT_SECRET` forte e único (`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`).
- Confirmar que `.env` não está versionado.
- `STORE_WHATSAPP_NUMBER` no env é só default do seed de dev; em prod a Dona Maria edita pelo painel.
