# Prompts para construir a loja no Claude Code

Construa **uma fase por vez**. Em cada fase:

1. Cole o prompt no Claude Code.
2. Deixe ele terminar e **revise** o que foi gerado.
3. Rode o critério de aceitação ("Como testar").
4. Faça um commit (`git add . && git commit -m "fase N"`).
5. Só então passe pra próxima fase.

Os prompts já assumem as decisões que combinamos: **SQLite**, **pnpm workspace**, sem Postgres por enquanto, totais calculados no backend, `.env` fora do Git.

---

## Fase 1 — Estrutura do projeto + schema Prisma + seed

```
Você vai construir, em etapas, um sistema web de pedidos para uma pequena loja de lasanhas e refrigerantes (pedido finaliza via link wa.me do WhatsApp, sem API oficial). Esta é a FASE 1 de 6. Não implemente rotas, frontend nem painel admin agora — só o que está descrito abaixo.

STACK (decisões já tomadas, não troque):
- Monorepo com pnpm workspace na raiz: pastas /frontend, /backend, /docs
- Backend: Node.js + Express + TypeScript
- ORM: Prisma com SQLite (arquivo local). NÃO use Postgres — SQLite é proposital para este projeto de loja única.
- Validação: Zod. Auth admin futura: JWT + bcrypt.
- Frontend (fases futuras): React + Vite + TypeScript + Tailwind + React Router + Zustand.

NESTA FASE, faça:
1. Crie a estrutura de pastas e o pnpm-workspace.yaml na raiz.
2. Inicialize o /backend com TypeScript, Prisma e SQLite.
3. Crie o schema.prisma com os models: StoreConfig, Category, Product, Order, OrderItem, DeliveryZone, AdminUser, com os campos abaixo:
   - StoreConfig: id, storeName, whatsappNumber, address, isOpen (boolean), preparationTime, announcement, createdAt, updatedAt
   - Category: id, name, sortOrder, active
   - Product: id, name, description, price, categoryId (relação), imageUrl, available, featured, createdAt, updatedAt
   - Order: id, orderNumber (único), customerName, customerPhone, orderType, address, addressNumber, neighborhood, reference, notes, paymentMethod, changeFor, subtotal, deliveryFee, total, status, createdAt, updatedAt
   - OrderItem: id, orderId (relação), productId, productName, quantity, unitPrice, totalPrice
   - DeliveryZone: id, neighborhood, fee, active
   - AdminUser: id, email (único), passwordHash, createdAt
   - status do Order como string (Pendente, Confirmado, Em preparo, Saiu para entrega, Entregue, Cancelado); valor monetário em centavos (inteiro) OU decimal — escolha um e documente.
4. Crie um seed (prisma/seed.ts) com:
   - Loja "Lasanhas da Dona Maria"
   - Categorias: Lasanhas, Refrigerantes, Combos
   - Produtos: Lasanha de Frango Pequena/Grande, Lasanha Bolonhesa Pequena/Grande, Coca-Cola 350ml, Coca-Cola 2L, Guaraná 1L, Combo Lasanha Grande + Refrigerante 2L
   - Alguns bairros com taxas de entrega
   - Admin padrão admin@admin.com / admin123 (senha com bcrypt). Deixe um comentário no seed avisando para trocar antes do deploy.
5. Crie .gitignore (incluindo .env, node_modules, dist, *.db) e .env.example com DATABASE_URL, JWT_SECRET, STORE_WHATSAPP_NUMBER, PORT.
6. Crie um arquivo CLAUDE.md na raiz resumindo: objetivo do projeto, stack, decisões (SQLite proposital, totais calculados no backend, finalização via wa.me), e o roadmap das 6 fases. As próximas fases vão se apoiar nesse arquivo.

PARE AQUI. Ao final, me mostre a árvore de arquivos, o schema.prisma e o seed, e os comandos exatos para rodar a migration e o seed.
```

**Como testar:** rodar a migration e o seed sem erro, e abrir o `prisma studio` pra ver loja, categorias, produtos e admin populados.

---

## Fase 2 — Backend: rotas públicas do cliente + criação de pedido

```
FASE 2 de 6. Leia o CLAUDE.md antes de começar. Implemente apenas as rotas PÚBLICAS do cliente. Não faça o painel admin nem o frontend ainda.

Implemente no /backend:
- Servidor Express com CORS configurado e middleware central de tratamento de erros.
- Validação de toda entrada com Zod.
- Rotas:
  - GET /api/store        → retorna StoreConfig
  - GET /api/categories   → categorias ativas, ordenadas por sortOrder
  - GET /api/products     → produtos (com categoria); permita filtrar por categoria
  - GET /api/delivery-zones → zonas ativas
  - POST /api/orders      → cria um pedido

REGRA IMPORTANTE para POST /api/orders:
- O cliente envia apenas: itens (productId + quantidade), orderType (entrega/retirada), dados do cliente, bairro, pagamento, observações, troco.
- NÃO confie em preços nem em totais vindos do cliente. O servidor deve:
  1. Buscar o preço atual de cada produto no banco.
  2. Recusar item de produto indisponível.
  3. Calcular subtotal a partir dos preços do banco.
  4. Definir deliveryFee: 0 se retirada; senão, a taxa da DeliveryZone do bairro (se bairro não existir, retorne erro claro).
  5. Calcular total = subtotal + deliveryFee.
  6. Gerar orderNumber sequencial (ex.: começar em 1000). Race condition aqui é desprezível, mas evite duplicar.
  7. Persistir Order + OrderItem (gravando productName e unitPrice no momento do pedido).
  8. Retornar o pedido criado com orderNumber, itens e totais.

Inclua scripts no package.json: dev (backend com hot reload), build, start. Deixe um README curto no /backend com exemplos de curl para cada rota.

PARE AQUI. Me mostre os exemplos de curl funcionando, principalmente o POST /api/orders devolvendo o pedido com total calculado pelo servidor.
```

**Como testar:** criar um pedido via `curl`, conferir que o total volta calculado pelo servidor (e que mudar o preço no corpo do request não muda o total).

---

## Fase 3 — Backend: login admin + rotas protegidas

```
FASE 3 de 6. Leia o CLAUDE.md. Implemente a parte administrativa do backend. Não mexa no frontend ainda.

Implemente no /backend:
- POST /api/admin/login: recebe email e senha, compara com bcrypt, retorna um JWT assinado com JWT_SECRET.
- Middleware de autenticação que protege todas as rotas /api/admin/* (exceto login), validando o JWT no header Authorization: Bearer.
- Rotas protegidas:
  - GET   /api/admin/orders               → lista pedidos (mais recentes primeiro)
  - PATCH /api/admin/orders/:id/status    → muda status (validar contra a lista de status permitidos)
  - GET/POST/PUT/DELETE /api/admin/products
  - GET/POST/PUT /api/admin/categories
  - GET/POST/PUT /api/admin/delivery-zones
  - GET/PUT /api/admin/store
- Toda entrada validada com Zod. Erros de auth retornam 401 com mensagem clara.

PARE AQUI. Me mostre: login retornando token, uma rota protegida recusando sem token (401), e a mesma rota funcionando com token.
```

**Como testar:** `login` devolve token; rota protegida sem token dá 401; com token funciona.

---

## Fase 4 — Frontend do cliente (loja + carrinho + WhatsApp)

```
FASE 4 de 6. Leia o CLAUDE.md. Construa o frontend do CLIENTE no /frontend. Não faça o painel admin ainda.

Stack: React + Vite + TypeScript + Tailwind + React Router + Zustand. Mobile first, visual limpo, cores quentes de comida caseira, botões grandes. Não copie layout, marca ou textos de nenhum site existente — use só o conceito de cardápio digital simples.

Consuma o backend da Fase 2 (configure a base URL da API por variável de ambiente do Vite).

Telas/elementos:
- Cabeçalho da loja: nome, banner, status aberto/fechado, tempo de preparo, formas de pagamento, aviso (announcement).
- Categorias horizontais (Lasanhas, Refrigerantes, Combos).
- Lista de produtos: nome, descrição, preço, imagem opcional, botão adicionar, aviso de indisponível.
- Carrinho no Zustand. Botão flutuante no rodapé com qtd de itens e total parcial → abre página/modal do carrinho.
- Carrinho: itens, alterar quantidade, remover, subtotal, taxa de entrega (calculada pelo bairro/tipo), total.
- Checkout: nome, telefone, entrega ou retirada, (endereço, número, bairro, referência se entrega), observações, forma de pagamento (Pix, Cartão na entrega, Dinheiro), campo "troco para quanto" se dinheiro.
- Botão final "Finalizar pedido pelo WhatsApp" que:
  1. Faz POST /api/orders (o backend é a fonte da verdade dos totais).
  2. Com a resposta, monta a mensagem no formato abaixo.
  3. Abre https://wa.me/<STORE_WHATSAPP_NUMBER>?text=<mensagem codificada com encodeURIComponent>.

Formato da mensagem:
🍝 NOVO PEDIDO #<orderNumber>
Cliente: <nome>
Telefone: <telefone>
Tipo: <Entrega/Retirada>
Endereço/Bairro/Referência (se entrega)
Itens: • <qtd>x <produto> - R$ <preço>
Subtotal / Taxa de entrega / Total
Pagamento: <forma> (com troco se dinheiro)
Observações: <texto>

PARE AQUI. Me mostre o fluxo completo rodando contra o backend local: adicionar ao carrinho → checkout → pedido salvo → WhatsApp abrindo com a mensagem pronta.
```

**Como testar:** fluxo completo no navegador (localhost:5173) contra o backend, terminando com o `wa.me` abrindo a mensagem certa.

---

## Fase 5 — Painel administrativo (frontend)

```
FASE 5 de 6. Leia o CLAUDE.md. Construa o painel admin dentro do /frontend (rotas /admin), consumindo as rotas /api/admin da Fase 3. Visual simples e funcional, sem exagero.

Inclua:
- Tela de login (guarda o JWT; envia no header das chamadas admin).
- Lista de pedidos com polling a cada 10 segundos para buscar novos pedidos.
- Mudar status do pedido (Pendente, Confirmado, Em preparo, Saiu para entrega, Entregue, Cancelado).
- CRUD de produtos, incluindo marcar disponível/indisponível.
- Criar/editar categorias e combos.
- Editar taxa de entrega por bairro.
- Configurar dados da loja: nome, WhatsApp, endereço, aberto/fechado, tempo de preparo, mensagem de aviso.
- Proteja as rotas /admin no frontend (redireciona pro login se não houver token).

PARE AQUI. Me mostre: login no painel, um pedido novo aparecendo via polling, mudança de status, e edição de um produto.
```

**Como testar:** logar no painel, ver um pedido novo entrar sozinho (polling), mudar status, editar um produto.

---

## Fase 6 — Documentação de deploy

```
FASE 6 de 6. Leia o CLAUDE.md. Escreva a documentação de deploy. Não é pra mudar funcionalidade, só documentar e ajustar scripts/.env se faltar algo.

1. README.md na raiz — rodar LOCAL no macOS:
   - Instalar Node LTS e pnpm
   - Instalar dependências (pnpm install na raiz)
   - Configurar .env a partir do .env.example
   - Rodar migrations e seed
   - Iniciar backend e frontend
   - URLs: frontend 5173, backend 3000

2. /docs/deploy-lxc.md — LXC Ubuntu/Debian no Proxmox:
   - Instalar Node LTS, pnpm, PM2, Nginx
   - Clonar o projeto, pnpm install, configurar .env
   - Rodar migrations e seed (se necessário)
   - Build do frontend
   - Servir o frontend estático pelo Nginx
   - Proxy reverso de /api para o backend
   - Rodar o backend com PM2 (e comando para reiniciar)
   - Backup do SQLite (cp do arquivo .db) e restauração
   - Inclua um exemplo de bloco server do Nginx

3. Avisos de segurança em destaque no topo do deploy-lxc.md:
   - Trocar a senha do admin@admin.com antes de expor publicamente
   - Confirmar que .env NÃO está versionado
   - Gerar um JWT_SECRET forte e único

PARE AQUI. Me mostre o README e o /docs/deploy-lxc.md.
```

**Como testar:** seguir o README do zero numa pasta limpa e o projeto subir; ler o `deploy-lxc.md` conferindo se nada essencial ficou de fora.

---

### Lembretes entre fases
- Commit ao fim de cada fase (fica fácil voltar se uma fase sair errada).
- Se o Claude Code começar a "atravessar" pra próxima fase, é só dizer: *"pare, isso é da fase seguinte"*.
- Antes do primeiro `git push`: confirme que `.env` está no `.gitignore` e troque `admin123`.
