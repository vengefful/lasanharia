/**
 * Seed de PRODUÇÃO — roda UMA vez no pré-lançamento.
 *
 * Diferente do prisma/seed.ts (dev, com loja, produtos e admin de teste), este aqui
 * prepara o banco enxuto para a Dona Maria começar do zero pelo painel:
 *   - 1 StoreConfig com defaults neutros, com a loja FECHADA até ela abrir.
 *   - 3 categorias (Lasanhas, Refrigerantes, Combos).
 *   - 1 AdminUser cujo e-mail e senha vêm de ADMIN_EMAIL / ADMIN_PASSWORD no ambiente.
 *
 * Não cria nenhum produto, nenhum pedido, nenhum cliente.
 * Aborta com erro claro se já houver Order no banco — proteção contra rodar em
 * banco que já está operando e apagar/duplicar dados reais.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function panic(message: string): never {
  console.error('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error('❌  SEED DE PRODUÇÃO ABORTADO');
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error(message);
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  process.exit(1);
}

async function main() {
  // ── 1) Proteção contra rodar em banco já em operação.
  //     Esta verificação vem PRIMEIRO — nem chega a olhar variáveis de ambiente.
  const orderCount = await prisma.order.count();
  if (orderCount > 0) {
    panic(
      `Banco já contém ${orderCount} pedido(s) — seed de produção abortado para não\n` +
      'apagar dados reais. Este seed só deve rodar UMA vez no pré-lançamento.\n\n' +
      'Se você acredita que precisa rodar mesmo assim, faça backup\n' +
      '(cp prisma/dev.db prisma/backup.db) e remova os pedidos manualmente antes.',
    );
  }

  // ── 2) Credenciais do admin obrigatórias via env.
  const email = (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? '';
  if (!email || !password) {
    panic(
      'Seed de produção exige ADMIN_EMAIL e ADMIN_PASSWORD definidos no ambiente.\n\n' +
      'Exemplo:\n' +
      '  ADMIN_EMAIL="dona.maria@exemplo.com" \\\n' +
      '  ADMIN_PASSWORD="uma-senha-bem-forte" \\\n' +
      '  pnpm --filter backend db:seed:prod\n\n' +
      'NUNCA use a senha de desenvolvimento (admin123) em produção.',
    );
  }
  if (password.length < 10) {
    panic(
      'ADMIN_PASSWORD muito curta (mínimo 10 caracteres).\n' +
      'Use uma senha forte — gerador, gerenciador, ou frase longa.',
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    panic(`ADMIN_EMAIL não parece um e-mail válido: "${email}".`);
  }

  // ── 3) StoreConfig — neutra e FECHADA até a Dona Maria abrir pelo painel.
  //     Find-or-create: se já existe (re-rodando antes do lançamento), mantém.
  const existingStore = await prisma.storeConfig.findFirst();
  if (existingStore) {
    console.log(`• StoreConfig já existe (id=${existingStore.id}) — mantendo, sem sobrescrever.`);
  } else {
    await prisma.storeConfig.create({
      data: {
        storeName: 'Lasanha da Vovó Magal',
        whatsappNumber: '',
        pixKey: '',
        address: '',
        city: '',
        state: '',
        announcement: '',
        isOpen: false, // ← loja começa FECHADA — segurança até estar tudo configurado.
        preparationTime: '40-50 min',
        deliveryFee: 0,
      },
    });
    console.log('✓ StoreConfig criada (loja FECHADA até abrir no painel).');
  }

  // ── 4) Categorias (find-or-create por nome — Category.name não é unique).
  const categories = [
    { name: 'Lasanhas', sortOrder: 1 },
    { name: 'Refrigerantes', sortOrder: 2 },
    { name: 'Combos', sortOrder: 3 },
  ];
  for (const c of categories) {
    const exists = await prisma.category.findFirst({ where: { name: c.name } });
    if (exists) {
      console.log(`• Categoria "${c.name}" já existe — mantendo.`);
    } else {
      await prisma.category.create({ data: { ...c, active: true } });
      console.log(`✓ Categoria "${c.name}" criada.`);
    }
  }

  // ── 5) AdminUser (upsert por email — email é @unique no schema).
  //     Permite "rotacionar" a senha rodando de novo no pré-lançamento se algo deu errado.
  const passwordHash = await bcrypt.hash(password, 10);
  const admin = await prisma.adminUser.upsert({
    where: { email },
    create: { email, passwordHash },
    update: { passwordHash },
  });
  console.log(`✓ AdminUser pronto: ${admin.email} (senha em bcrypt, cost 10).`);

  console.log('\n✅ Seed de PRODUÇÃO concluído.\n');
  console.log('Próximos passos para a Dona Maria no painel:');
  console.log('  1. /admin/login com o e-mail/senha definidos no ambiente.');
  console.log('  2. Aba Loja: preencher WhatsApp, endereço, cidade/UF, chave PIX, anúncio.');
  console.log('  3. Aba Produtos: cadastrar os produtos reais.');
  console.log('  4. Voltar em Loja e ligar "Aberta" — pedidos passam a entrar.\n');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('❌ Erro inesperado no seed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
