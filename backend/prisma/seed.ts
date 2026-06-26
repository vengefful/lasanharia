import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Preços em centavos. Ver CLAUDE.md.
async function main() {
  // Limpa em ordem que respeita as foreign keys (idempotente).
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.deliveryZone.deleteMany();
  await prisma.storeConfig.deleteMany();
  await prisma.adminUser.deleteMany();

  // Configuração da loja
  await prisma.storeConfig.create({
    data: {
      storeName: 'Lasanhas da Dona Maria',
      whatsappNumber: '5511999999999',
      address: 'Rua das Massas, 123 — Centro',
      isOpen: true,
      preparationTime: '40 a 60 min',
      announcement: 'Bem-vindo! Pedidos das 18h às 23h, todos os dias.',
    },
  });

  // Categorias
  const lasanhas = await prisma.category.create({
    data: { name: 'Lasanhas', sortOrder: 1, active: true },
  });
  const refrigerantes = await prisma.category.create({
    data: { name: 'Refrigerantes', sortOrder: 2, active: true },
  });
  const combos = await prisma.category.create({
    data: { name: 'Combos', sortOrder: 3, active: true },
  });

  // Produtos
  await prisma.product.createMany({
    data: [
      {
        name: 'Lasanha de Frango Pequena',
        description: 'Massa caseira, frango desfiado, catupiry e queijo. Serve 1 pessoa.',
        price: 2500,
        categoryId: lasanhas.id,
        available: true,
        featured: false,
      },
      {
        name: 'Lasanha de Frango Grande',
        description: 'Massa caseira, frango desfiado, catupiry e queijo. Serve 2 a 3 pessoas.',
        price: 4500,
        categoryId: lasanhas.id,
        available: true,
        featured: true,
      },
      {
        name: 'Lasanha Bolonhesa Pequena',
        description: 'Massa caseira, molho bolonhesa, presunto e queijo. Serve 1 pessoa.',
        price: 2500,
        categoryId: lasanhas.id,
        available: true,
        featured: false,
      },
      {
        name: 'Lasanha Bolonhesa Grande',
        description: 'Massa caseira, molho bolonhesa, presunto e queijo. Serve 2 a 3 pessoas.',
        price: 4500,
        categoryId: lasanhas.id,
        available: true,
        featured: true,
      },
      {
        name: 'Coca-Cola 350ml',
        description: 'Lata 350ml gelada.',
        price: 600,
        categoryId: refrigerantes.id,
        available: true,
        featured: false,
      },
      {
        name: 'Coca-Cola 2L',
        description: 'Garrafa 2 litros gelada.',
        price: 1200,
        categoryId: refrigerantes.id,
        available: true,
        featured: false,
      },
      {
        name: 'Guaraná 1L',
        description: 'Garrafa 1 litro gelada.',
        price: 800,
        categoryId: refrigerantes.id,
        available: true,
        featured: false,
      },
      {
        name: 'Combo Lasanha Grande + Refrigerante 2L',
        description: 'Uma lasanha grande à escolha + Coca-Cola ou Guaraná 2L. Combina no campo de observações.',
        price: 5500,
        categoryId: combos.id,
        available: true,
        featured: true,
      },
    ],
  });

  // Zonas de entrega (taxa em centavos)
  await prisma.deliveryZone.createMany({
    data: [
      { neighborhood: 'Centro', fee: 500, active: true },
      { neighborhood: 'Vila Nova', fee: 700, active: true },
      { neighborhood: 'Jardim das Flores', fee: 900, active: true },
      { neighborhood: 'Bairro Alto', fee: 1200, active: true },
    ],
  });

  // ATENÇÃO: trocar essa senha antes do deploy. Está aqui só para desenvolvimento.
  // Em produção: crie o admin via uma rota/script protegido ou edite direto no banco.
  const passwordHash = await bcrypt.hash('admin123', 10);
  await prisma.adminUser.create({
    data: {
      email: 'admin@admin.com',
      passwordHash,
    },
  });

  console.log('✅ Seed concluído.');
  console.log('   Loja:        Lasanhas da Dona Maria');
  console.log('   Categorias:  3 (Lasanhas, Refrigerantes, Combos)');
  console.log('   Produtos:    8');
  console.log('   Bairros:     4');
  console.log('   Admin:       admin@admin.com / admin123  ← TROCAR ANTES DO DEPLOY');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Erro no seed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
