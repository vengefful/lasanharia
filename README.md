# Lasanharia

Sistema web de pedidos para a **Lasanhas da Dona Maria** — cardápio digital, carrinho, checkout que finaliza via `wa.me` do WhatsApp, e painel admin para a loja gerenciar tudo.

Monorepo pnpm: `backend/` (Express + Prisma + SQLite) e `frontend/` (React + Vite + Tailwind + React Router + Zustand). Visão geral, decisões e contexto vivem em [`CLAUDE.md`](./CLAUDE.md). Deploy em produção: [`docs/deploy-lxc.md`](./docs/deploy-lxc.md).

## Rodar local (macOS)

### Pré-requisitos
- **Node.js** LTS (`nvm install --lts` ou `brew install node`)
- **pnpm** 9+ (`npm install -g pnpm` ou `corepack enable && corepack prepare pnpm@latest --activate`)
- **SQLite CLI** opcional (`brew install sqlite`) — útil pra inspecionar o banco

### Passo a passo

```bash
# 1. Clonar
git clone <repo-url> lasanharia
cd lasanharia

# 2. Instalar dependências de toda a workspace
pnpm install
```

**3. Criar os `.env`** a partir do exemplo. **Dois arquivos** — o backend e o Prisma lêem do `backend/.env`; o `.env` da raiz é só conveniência:

```bash
cp .env.example .env
cp .env.example backend/.env
```

Conteúdo do `backend/.env` para desenvolvimento local:

| Variável | Para que serve | Valor sugerido em dev |
|---|---|---|
| `DATABASE_URL` | Caminho do arquivo SQLite (relativo ao `schema.prisma`) | `"file:./dev.db"` |
| `JWT_SECRET` | Assina o token do painel admin | qualquer string ≥ 16 chars (ex.: `"dev-secret-change-in-prod"`) |
| `STORE_WHATSAPP_NUMBER` | **Só** o seed de dev usa como default | `"5511999999999"` ou o número que preferir |
| `PORT` | Porta do Express | `3000` |
| `ADMIN_EMAIL` | **Só** para o seed de **produção** (`db:seed:prod`). Deixe vazio em dev. | (vazio) |
| `ADMIN_PASSWORD` | Idem | (vazio) |

```bash
# 4. Aplicar migrations no SQLite + rodar o seed de DEV (loja + 8 produtos + admin de teste)
pnpm db:migrate                 # cria backend/prisma/dev.db
pnpm db:seed                    # popula dados de desenvolvimento

# 5. Subir backend e frontend em terminais separados:
pnpm --filter backend dev       # http://localhost:3000  (Express + tsx watch)
pnpm --filter frontend dev      # http://localhost:5173  (Vite, com proxy /api → 3000)
```

Abra:
- **Cardápio do cliente:** http://localhost:5173/
- **Painel admin:** http://localhost:5173/admin
- **Prisma Studio** (inspecionar dados): `pnpm db:studio` → http://localhost:5555

### Aviso destacado — admin de desenvolvimento

> ⚠️ O seed de dev (`pnpm db:seed`) cria um admin com credenciais **fixas**:
>
>   - **e-mail:** `admin@admin.com`
>   - **senha:** `admin123`
>
> Isso é só para você logar no painel no Mac em segundos.
> **Nunca rode `db:seed` em produção** — em produção use `db:seed:prod`, que exige `ADMIN_EMAIL` e `ADMIN_PASSWORD` no ambiente e se recusa a rodar se já houver pedidos. Detalhes em [`docs/deploy-lxc.md`](./docs/deploy-lxc.md).

## Comandos úteis

```bash
pnpm db:migrate                 # aplicar migrations pendentes em dev
pnpm db:seed                    # repopular dados de dev (faz wipe-and-create)
pnpm db:studio                  # abrir Prisma Studio
pnpm db:reset                   # apagar dev.db e recomeçar do zero (dev only)

pnpm --filter backend  dev      # backend com hot reload
pnpm --filter frontend dev      # frontend com hot reload
pnpm --filter backend  build    # compila TS para backend/dist/
pnpm --filter frontend build    # bundle de produção em frontend/dist/
pnpm --filter backend  start    # roda backend/dist (produção)
```

## Estrutura

```
lasanharia/
├── backend/                  # Express 5 + Prisma 6 + SQLite
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── seed.ts           # seed de DEV (8 produtos, admin@admin.com/admin123)
│   │   ├── seed.prod.ts      # seed de PRODUÇÃO (loja fechada, sem produtos, admin via env)
│   │   └── migrations/
│   ├── src/
│   │   ├── index.ts          # entrypoint
│   │   ├── app.ts            # createApp(): CORS, json, rotas, errorHandler
│   │   ├── env.ts            # validação Zod do .env
│   │   ├── prisma.ts         # singleton do PrismaClient
│   │   ├── middleware/       # errorHandler, requireAuth (JWT)
│   │   └── routes/
│   │       ├── store.ts | categories.ts | products.ts | orders.ts   # públicas
│   │       └── admin/        # login + orders + products + categories + store + stats + customers
│   └── README.md             # cheat-sheet de curl das rotas
│
├── frontend/                 # React 18 + Vite + Tailwind + RR6 + Zustand
│   └── src/
│       ├── pages/            # Storefront, Cart, Checkout, OrderSuccess
│       ├── admin/            # SummaryPage, OrdersPage, CustomersPage, ProductsPage, CategoriesPage, StorePage
│       ├── components/       # Header, CategoryTabs, ProductCard, CartFloatingButton
│       ├── lib/              # format, whatsapp, maps, customerInfo
│       ├── store/cart.ts     # Zustand + localStorage
│       └── api/client.ts     # fetch wrapper público
│
├── docs/
│   └── deploy-lxc.md         # guia de produção (LXC + Cloudflare Tunnel + Nginx + PM2)
│
├── pnpm-workspace.yaml
├── package.json              # scripts da workspace
├── .env.example
├── .gitignore
├── CLAUDE.md                 # objetivo, stack, decisões, roadmap, arquitetura
└── README.md                 # você está aqui
```

## Próximos passos

- Subir em produção: siga [`docs/deploy-lxc.md`](./docs/deploy-lxc.md).
- Entender as decisões arquiteturais (centavos como inteiro, SQLite proposital, totais sempre no backend, finalização via `wa.me`): [`CLAUDE.md`](./CLAUDE.md).
- Detalhes das rotas e exemplos de `curl`: [`backend/README.md`](./backend/README.md).
