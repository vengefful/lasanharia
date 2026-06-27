# Deploy em produção — LXC + Cloudflare Tunnel + Nginx + PM2 + SQLite

Guia para subir a Lasanharia num container **LXC Ubuntu/Debian** rodando dentro do Proxmox, exposto via **Cloudflare Tunnel** (sem IP público, sem porta aberta no roteador, sem Certbot). Single-tenant, ~10–20 pedidos/dia. Container pequeno (1–2 vCPU, 1–2 GB RAM, 8–16 GB disco) é suficiente.

---

## ⚠️ Checklist de segurança (leia antes de começar)

- [ ] **`JWT_SECRET` forte e único**, gerado com `openssl rand -base64 32`. Nunca reaproveite a string do `.env.example`.
- [ ] **`.env` fora do Git** (já está no `.gitignore`, mas confirme com `git status` antes do primeiro push).
- [ ] **Senha do admin definida no seed de produção** (`ADMIN_PASSWORD` forte, mínimo 10 caracteres, **não use** `admin123`). O `db:seed:prod` recusa senhas curtas.
- [ ] **Só o `cloudflared` expõe o serviço.** A porta 80 do Nginx escuta em `127.0.0.1` (ou na interface interna do LXC) — nada vai pra rede pública direto. O firewall do LXC pode bloquear todo INPUT externo exceto SSH interno se você quiser endurecer mais.
- [ ] **Trocar a senha do admin após o primeiro login** se preferir gerenciar pelo Prisma Studio.

---

## Arquitetura

```
Internet ──► Cloudflare (HTTPS terminado aqui) ──► Cloudflare Tunnel
                                                        │
                                                        ▼
                                                  cloudflared (no LXC)
                                                        │
                                                        ▼
                                              Nginx :80 (no LXC)
                                              ├── /            → dist/ (SPA estática)
                                              └── /api/*       → http://127.0.0.1:3000
                                                                       │
                                                                       ▼
                                                                Backend Node (PM2)
                                                                       │
                                                                       ▼
                                                                SQLite (arquivo local)
```

DNS do domínio (`exemplo.com.br`, registro.br) apontado para Cloudflare. A Cloudflare cuida do HTTPS automaticamente — **não instale Certbot/Let's Encrypt**.

---

## 1. Provisionar o LXC

No Proxmox, crie um container Ubuntu 24.04 LTS (ou Debian 12):

- **Recursos:** 2 vCPU, 2 GB RAM, 16 GB disco — folga para crescer.
- **Rede:** bridge interna; sem precisar de IP público.
- **Unprivileged container:** sim (recomendado).
- **DNS:** o do Proxmox/roteador.

Após subir o container, entre nele (`pct enter <vmid>` no host Proxmox) e atualize tudo:

```bash
apt update && apt upgrade -y
apt install -y curl git build-essential ufw sqlite3
```

Crie um usuário não-root para rodar a aplicação:

```bash
adduser lasanharia                       # cria o usuário e a home
usermod -aG sudo lasanharia              # sudo opcional
su - lasanharia                          # entra como ele
```

A partir daqui rode tudo como `lasanharia`, **não como root** — quando precisar de sudo, peça explicitamente.

---

## 2. Instalar Node LTS, pnpm, PM2 e Nginx

```bash
# Node.js LTS — versão 22.x via NodeSource (ou nvm se preferir).
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# pnpm via Corepack (já vem com Node ≥16)
sudo corepack enable
corepack prepare pnpm@latest --activate

# PM2 (gerenciador de processo do backend)
sudo npm install -g pm2

# Nginx
sudo apt install -y nginx

# Confirmar versões
node -v
pnpm -v
pm2 -v
nginx -v
```

---

## 3. Clonar o projeto e configurar o `.env`

```bash
cd ~
git clone <repo-url> lasanharia
cd lasanharia
pnpm install
```

Crie `backend/.env` para produção. **Não copie o `.env.example` cego — preencha com valores reais:**

```bash
nano backend/.env
```

```dotenv
# Caminho do SQLite. Relativo ao schema.prisma, então fica em backend/prisma/prod.db.
DATABASE_URL="file:./prod.db"

# Gere com: openssl rand -base64 32
JWT_SECRET="cole-aqui-o-output-do-openssl-rand-base64-32"

# Usado só pelo seed de DEV; em prod o número fica em StoreConfig.whatsappNumber, editado no painel.
# Mas você pode deixar como default razoável caso alguém execute o seed de dev por engano.
STORE_WHATSAPP_NUMBER="5582999999999"

PORT=3000

# Admin de produção — usado pelo seed UMA vez no pré-lançamento.
ADMIN_EMAIL="dona.maria@exemplo.com"
ADMIN_PASSWORD="uma-senha-bem-forte-de-pelo-menos-10-chars"
```

Depois proteja o arquivo:

```bash
chmod 600 backend/.env
```

> Gere o JWT_SECRET assim:
> ```bash
> openssl rand -base64 32
> ```

---

## 4. Aplicar as migrations

Em produção use **`migrate deploy`**, que aplica migrations já versionadas sem perguntar nada e sem rodar seed automaticamente. **Nunca** rode `migrate dev` em produção — ela é interativa e pode propor reset.

```bash
cd ~/lasanharia/backend
pnpm exec prisma migrate deploy
pnpm exec prisma generate
```

Vai criar o arquivo `backend/prisma/prod.db` vazio (apenas com o schema).

---

## 5. Seed de produção — **UMA ÚNICA VEZ**, no pré-lançamento

> 🚨 **NUNCA rode `pnpm db:seed` (dev) nem `pnpm db:reset` em produção.**
> O seed de dev cria a senha `admin123` e wipe-and-create de produtos/categorias.
> O `db:reset` apaga o banco inteiro. Ambos destruirão dados reais. O **seed de produção** se recusa a rodar se já houver pedidos no banco, mas mesmo assim trate ele como um "comando de instalação" — roda **uma vez** e pronto.

Com `ADMIN_EMAIL` e `ADMIN_PASSWORD` já definidos no `backend/.env`, rode:

```bash
cd ~/lasanharia
pnpm --filter backend db:seed:prod
```

Saída esperada:

```
✓ StoreConfig criada (loja FECHADA até abrir no painel).
✓ Categoria "Lasanhas" criada.
✓ Categoria "Refrigerantes" criada.
✓ Categoria "Combos" criada.
✓ AdminUser pronto: dona.maria@exemplo.com (senha em bcrypt, cost 10).
✅ Seed de PRODUÇÃO concluído.
```

O que isso cria:
- Uma `StoreConfig` com defaults neutros (nome "Lasanhas da Dona Maria", endereço/cidade/UF/WhatsApp/PIX **em branco**) e **`isOpen=false`** — a loja só passa a aceitar pedidos depois que a Dona Maria abrir pelo painel.
- 3 categorias: **Lasanhas**, **Refrigerantes**, **Combos**.
- 1 `AdminUser` com o e-mail e senha do `.env` (bcrypt cost 10).
- **Zero produtos, zero pedidos.** Ela cadastra os produtos reais pelo painel.

---

## 6. Build do frontend

```bash
cd ~/lasanharia
pnpm --filter frontend build
```

Gera `frontend/dist/` (HTML + JS + CSS minificados, ~190 KB de JS gz). O Nginx serve esse diretório como estático.

---

## 7. Subir o backend com PM2

```bash
cd ~/lasanharia/backend
pnpm build                                # compila TS → backend/dist
pm2 start dist/index.js --name lasanharia-api --time
pm2 save                                  # persiste a lista de processos
sudo env PATH=$PATH pm2 startup systemd \
  -u lasanharia --hp /home/lasanharia     # gera o serviço systemd que sobe o PM2 no boot
```

Verificações:

```bash
pm2 status
pm2 logs lasanharia-api --lines 50
curl -s http://127.0.0.1:3000/api/health   # → {"status":"ok"}
```

---

## 8. Configurar o Nginx

Crie `/etc/nginx/sites-available/lasanharia`:

```bash
sudo nano /etc/nginx/sites-available/lasanharia
```

```nginx
server {
    listen      127.0.0.1:80;          # só localhost — quem vai expor é o cloudflared
    listen      [::1]:80;
    server_name _;

    # Logs
    access_log  /var/log/nginx/lasanharia.access.log;
    error_log   /var/log/nginx/lasanharia.error.log;

    # Frontend estático (SPA do React Router)
    root        /home/lasanharia/lasanharia/frontend/dist;
    index       index.html;

    # Cache agressivo pros assets versionados (Vite gera hash no nome).
    location /assets/ {
        access_log off;
        expires    1y;
        add_header Cache-Control "public, immutable";
        try_files  $uri =404;
    }

    # Toda rota desconhecida cai no index.html — o React Router resolve no client.
    location / {
        try_files  $uri $uri/ /index.html;
        expires    -1;                  # HTML sempre fresco
    }

    # Proxy reverso para o backend Express
    location /api/ {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto https;   # Cloudflare termina TLS
        proxy_read_timeout 30s;
    }

    # Body pequeno (pedidos JSON são minúsculos). Protege contra abuse.
    client_max_body_size 1m;
}
```

Habilita, valida e recarrega:

```bash
sudo ln -s /etc/nginx/sites-available/lasanharia /etc/nginx/sites-enabled/lasanharia
sudo rm -f /etc/nginx/sites-enabled/default       # remove o default
sudo nginx -t                                     # valida sintaxe
sudo systemctl reload nginx
```

Teste local dentro do LXC:

```bash
curl -s http://127.0.0.1/api/health               # via Nginx → backend
curl -sI http://127.0.0.1/ | head -3              # 200 OK servindo index.html
```

---

## 9. Cloudflare Tunnel — expor sem abrir porta

Pré-requisito: **o DNS do domínio (`exemplo.com.br`) precisa estar na Cloudflare.** Como ele veio do registro.br, no painel do registro.br você troca os Name Servers para os fornecidos pela Cloudflare ao adicionar o domínio. Espere a propagação (algumas horas).

### 9.1. Instalar o `cloudflared`

```bash
# Repositório oficial
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg \
  | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main" \
  | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt update
sudo apt install -y cloudflared
cloudflared --version
```

### 9.2. Autenticar (abre URL para login no navegador)

```bash
cloudflared tunnel login
```

Vai abrir um link — copie e cole no navegador, escolha a zona `exemplo.com.br`. Isso baixa `~/.cloudflared/cert.pem`.

### 9.3. Criar o túnel

```bash
cloudflared tunnel create lasanharia
# → "Created tunnel lasanharia with id 12345678-aaaa-bbbb-cccc-deadbeefdead"
```

O comando gera `~/.cloudflared/<TUNNEL_ID>.json` com as credenciais.

### 9.4. Configurar o roteamento

Crie `~/.cloudflared/config.yml`:

```yaml
tunnel: 12345678-aaaa-bbbb-cccc-deadbeefdead
credentials-file: /home/lasanharia/.cloudflared/12345678-aaaa-bbbb-cccc-deadbeefdead.json

ingress:
  # Tudo do hostname público vai pro Nginx local
  - hostname: lasanharia.exemplo.com.br
    service: http://127.0.0.1:80
  # Regra catch-all obrigatória no final
  - service: http_status:404
```

Aponte o DNS público pro túnel (Cloudflare cria um CNAME automaticamente):

```bash
cloudflared tunnel route dns lasanharia lasanharia.exemplo.com.br
```

### 9.5. Subir como serviço systemd (boot automático)

```bash
sudo cloudflared service install
# usa o config.yml do usuário que rodou (ou pegue de /etc/cloudflared/config.yml se você mover)
sudo systemctl enable --now cloudflared
sudo systemctl status cloudflared
```

Teste do navegador externo: `https://lasanharia.exemplo.com.br/` → carrega o cardápio. HTTPS válido (certificado da Cloudflare). Sem nenhuma porta aberta no roteador. ✅

---

## 10. Primeiro acesso da Dona Maria (passo a passo pra ela)

Mande este resumo pra ela:

1. Abra `https://lasanharia.exemplo.com.br/admin` no celular ou computador.
2. Faça login com o e-mail e senha que combinamos (`ADMIN_EMAIL` / `ADMIN_PASSWORD`).
3. Vá na aba **Loja** e preencha:
   - **Nome da loja** (já vem como "Lasanhas da Dona Maria", troque se quiser)
   - **Endereço** completo e número
   - **Cidade** e **Estado (UF)** — vão entrar no "Ver rota" do painel
   - **WhatsApp** (só dígitos, com 55 na frente: `5582xxxxxxxxx`)
   - **Tempo de preparo** (ex.: "40 a 60 min")
   - **Aviso** (opcional) — aparece no topo do cardápio
   - **Frete único** (0 = grátis)
   - **Chave PIX** — entra na mensagem de "Avisar cliente" quando pedido for Pix
4. Salve.
5. Vá em **Categorias** — confirme que existem **Lasanhas, Refrigerantes, Combos**. Pode renomear ou criar mais.
6. Vá em **Produtos** e cadastre cada produto real: nome, descrição, preço, categoria, foto (URL).
7. **Só agora**, volte em **Loja** e ligue o toggle **"Aberta"**. A partir desse momento os clientes podem fazer pedidos.

Daí em diante o uso é só:
- **Resumo:** acompanhar faturamento, ticket médio, top produtos.
- **Pedidos:** chega novo pedido (auto-refresh a cada 10s); mudar status; "Avisar cliente" pelo WhatsApp; "Ver rota" abre Google Maps.
- **Clientes:** lista de quem já comprou + botão WhatsApp individual (sem disparo em massa).

---

## 11. Atualizar depois (deploy de nova versão)

Quando vier um update do código:

```bash
cd ~/lasanharia
git pull
pnpm install

# Sempre antes de mexer no banco: backup (ver §12 abaixo)
~/lasanharia/scripts/backup-db.sh                 # se você criar esse script

# Migrations novas (se houver)
pnpm --filter backend exec prisma migrate deploy
pnpm --filter backend exec prisma generate

# Rebuild
pnpm --filter backend build
pnpm --filter frontend build

# Reinicia o backend (zero-downtime razoável; conexões em voo se completam)
pm2 restart lasanharia-api

# Nginx não precisa recarregar — ele serve o novo dist/ na próxima request.
# Se você mudou o nginx.conf, então:
sudo nginx -t && sudo systemctl reload nginx
```

---

## 12. Backup do SQLite

**NUNCA copie o `prod.db` com `cp` enquanto o backend está rodando** — você pode pegar o arquivo no meio de uma escrita e ter um backup corrompido. Use `sqlite3 .backup`, que faz uma cópia online consistente.

### Script de backup

Crie `~/lasanharia/scripts/backup-db.sh`:

```bash
mkdir -p ~/lasanharia/scripts ~/backups
nano ~/lasanharia/scripts/backup-db.sh
```

```bash
#!/usr/bin/env bash
set -euo pipefail

SRC="/home/lasanharia/lasanharia/backend/prisma/prod.db"
DEST_DIR="/home/lasanharia/backups"
STAMP="$(date +%Y-%m-%d_%H%M%S)"
DEST="${DEST_DIR}/lasanharia-${STAMP}.db"

mkdir -p "$DEST_DIR"

# Backup consistente (online) — sqlite3 cuida do lock e da WAL.
sqlite3 "$SRC" ".backup '$DEST'"

# Compacta para economizar espaço
gzip -9 "$DEST"

# Mantém só os últimos 14 backups
ls -1t "${DEST_DIR}"/lasanharia-*.db.gz 2>/dev/null | tail -n +15 | xargs -r rm -f

echo "Backup: ${DEST}.gz"
```

```bash
chmod +x ~/lasanharia/scripts/backup-db.sh
~/lasanharia/scripts/backup-db.sh           # teste manual
ls -lh ~/backups
```

### Cron diário (madrugada)

```bash
crontab -e
```

Adicione:

```
# Backup do banco da Lasanharia todo dia às 03:15
15 3 * * * /home/lasanharia/lasanharia/scripts/backup-db.sh >> /home/lasanharia/backups/backup.log 2>&1
```

### Levar o backup para fora do LXC

Os backups estão em `/home/lasanharia/backups/` **dentro** do container. Se o LXC ou o host morrer, perdeu tudo. Saídas comuns:

- **rsync para outro host** (ex.: NAS, outro Proxmox, máquina de casa) — adicione ao cron:
  ```cron
  30 3 * * * rsync -az /home/lasanharia/backups/ usuario@outrohost:/caminho/backups/lasanharia/
  ```
- **rclone para S3/B2/Drive/Storj** — `rclone copy ~/backups/ remoto:lasanharia-backups/`.
- **scp manual periódico** se for tudo improvisado.

O importante: os backups precisam viver em **pelo menos dois lugares físicos diferentes**.

---

## 13. Restaurar o banco

Cenário: o banco corrompeu, ou alguém apagou pedidos por engano, ou você está montando um ambiente de teste a partir do backup.

```bash
# 1. Parar o backend (para nada escrever no banco)
pm2 stop lasanharia-api

# 2. Mover o banco atual pra um lado (defesa em profundidade)
cd ~/lasanharia/backend/prisma
mv prod.db prod.db.before-restore-$(date +%s)
rm -f prod.db-wal prod.db-shm prod.db-journal   # arquivos auxiliares do SQLite

# 3. Descompactar e copiar o backup escolhido
gunzip -kc ~/backups/lasanharia-2026-06-27_031500.db.gz > prod.db
chmod 600 prod.db

# 4. Verificar integridade
sqlite3 prod.db 'PRAGMA integrity_check;'        # → "ok"
sqlite3 prod.db 'SELECT COUNT(*) FROM "Order";'  # confirma que os pedidos vieram

# 5. Religar
pm2 start lasanharia-api
pm2 logs lasanharia-api --lines 30
curl -s http://127.0.0.1/api/health
```

Tudo de pé. Se algo der errado, o `prod.db.before-restore-*` ainda está lá para você reverter.

---

## Manutenção rotineira (resumo)

| Tarefa | Comando | Cadência |
|---|---|---|
| Ver logs do backend | `pm2 logs lasanharia-api` | sob demanda |
| Status dos processos | `pm2 status` | sob demanda |
| Ver status do túnel | `systemctl status cloudflared` | sob demanda |
| Reiniciar backend | `pm2 restart lasanharia-api` | após deploy |
| Reload Nginx | `sudo systemctl reload nginx` | só se mudar conf |
| Backup manual | `~/lasanharia/scripts/backup-db.sh` | sob demanda; cron faz diário |
| Atualizar SO | `sudo apt update && sudo apt upgrade -y` | mensal |
| Tamanho do banco | `ls -lh ~/lasanharia/backend/prisma/prod.db` | sob demanda |
| Espaço em disco | `df -h` | mensal |

---

## Solução de problemas rápidos

- **`502 Bad Gateway`** ao abrir o site → backend caiu. `pm2 status` / `pm2 logs lasanharia-api`. Se travou, `pm2 restart lasanharia-api`.
- **Site não abre, mas `curl http://127.0.0.1/` no LXC funciona** → problema do `cloudflared`. `systemctl status cloudflared` e `journalctl -u cloudflared -n 100`.
- **Login admin diz "INVALID_CREDENTIALS"** → o `ADMIN_EMAIL`/`ADMIN_PASSWORD` do `.env` foram alterados depois do seed. Resete a senha do admin direto no banco com Prisma Studio (`pnpm db:studio`) ou via SQL: gere um hash bcrypt e dê `UPDATE AdminUser SET passwordHash='...' WHERE email='...'`.
- **`STORE_CLOSED` retornado pra todos os pedidos** → a loja está marcada como fechada. Vá no painel → Loja → ligue "Aberta".
- **Cardápio vazio** → a Dona Maria ainda não cadastrou produtos (ou marcou todos como indisponíveis). Vá em **Produtos** no painel.
