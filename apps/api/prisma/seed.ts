import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');
  
  // Create demo tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo-club' },
    update: {},
    create: {
      name: 'Demo Club',
      slug: 'demo-club',
    },
  });
  console.log('✅ Created tenant:', tenant.name);
  
  // Create demo venue
  const venue = await prisma.venue.upsert({
    where: { id: 'demo-venue-id' },
    update: {},
    create: {
      id: 'demo-venue-id',
      tenantId: tenant.id,
      name: 'Club Demo',
      address: 'Av. Providencia 1234, Santiago',
      capacity: 500,
    },
  });
  console.log('✅ Created venue:', venue.name);
  
  // Create admin user
  const passwordHash = await bcrypt.hash('admin123', 12);
  
  const adminUser = await prisma.user.upsert({
    where: { 
      tenantId_email: {
        tenantId: tenant.id,
        email: 'admin@demo.com',
      },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'admin@demo.com',
      passwordHash,
      firstName: 'Admin',
      lastName: 'Demo',
      role: 'OWNER',
      pin: '1234',
    },
  });
  console.log('✅ Created admin user:', adminUser.email);
  
  // Assign admin to venue
  await prisma.userVenue.upsert({
    where: {
      userId_venueId: {
        userId: adminUser.id,
        venueId: venue.id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      venueId: venue.id,
    },
  });
  
  // Create sample categories
  const categories = [
    { name: 'Cervezas', color: '#f59e0b', icon: '🍺', sortOrder: 1 },
    { name: 'Tragos', color: '#8b5cf6', icon: '🍸', sortOrder: 2 },
    { name: 'Vinos', color: '#dc2626', icon: '🍷', sortOrder: 3 },
    { name: 'Sin Alcohol', color: '#22c55e', icon: '🥤', sortOrder: 4 },
    { name: 'Snacks', color: '#f97316', icon: '🍿', sortOrder: 5 },
  ];
  
  for (const cat of categories) {
    await prisma.category.upsert({
      where: { 
        id: `cat-${cat.name.toLowerCase().replace(/\s/g, '-')}`,
      },
      update: cat,
      create: {
        id: `cat-${cat.name.toLowerCase().replace(/\s/g, '-')}`,
        tenantId: tenant.id,
        ...cat,
      },
    });
  }
  console.log('✅ Created', categories.length, 'categories');
  
  // Create sample products
  const products = [
    // Cervezas
    { categoryId: 'cat-cervezas', name: 'Corona', price: 3500, isAlcoholic: true },
    { categoryId: 'cat-cervezas', name: 'Heineken', price: 4000, isAlcoholic: true },
    { categoryId: 'cat-cervezas', name: 'Kunstmann', price: 4500, isAlcoholic: true },
    { categoryId: 'cat-cervezas', name: 'Stella Artois', price: 4000, isAlcoholic: true },
    // Tragos
    { categoryId: 'cat-tragos', name: 'Pisco Sour', price: 5500, isAlcoholic: true },
    { categoryId: 'cat-tragos', name: 'Mojito', price: 6000, isAlcoholic: true },
    { categoryId: 'cat-tragos', name: 'Gin Tonic', price: 6500, isAlcoholic: true },
    { categoryId: 'cat-tragos', name: 'Margarita', price: 6000, isAlcoholic: true },
    { categoryId: 'cat-tragos', name: 'Vodka Tonic', price: 5500, isAlcoholic: true },
    // Vinos
    { categoryId: 'cat-vinos', name: 'Copa Vino Tinto', price: 4500, isAlcoholic: true },
    { categoryId: 'cat-vinos', name: 'Copa Vino Blanco', price: 4500, isAlcoholic: true },
    { categoryId: 'cat-vinos', name: 'Botella Casa', price: 18000, isAlcoholic: true },
    // Sin Alcohol
    { categoryId: 'cat-sin-alcohol', name: 'Coca-Cola', price: 2000, isAlcoholic: false },
    { categoryId: 'cat-sin-alcohol', name: 'Agua Mineral', price: 1500, isAlcoholic: false },
    { categoryId: 'cat-sin-alcohol', name: 'Red Bull', price: 4000, isAlcoholic: false },
    { categoryId: 'cat-sin-alcohol', name: 'Jugo Natural', price: 3000, isAlcoholic: false },
    // Snacks
    { categoryId: 'cat-snacks', name: 'Papas Fritas', price: 3500, isAlcoholic: false },
    { categoryId: 'cat-snacks', name: 'Nachos', price: 5000, isAlcoholic: false },
  ];
  
  for (let i = 0; i < products.length; i++) {
    const prod = products[i];
    await prisma.product.upsert({
      where: { 
        id: `prod-${i + 1}`,
      },
      update: prod,
      create: {
        id: `prod-${i + 1}`,
        tenantId: tenant.id,
        ...prod,
        shortName: prod.name.substring(0, 10),
        sortOrder: i + 1,
      },
    });
  }
  console.log('✅ Created', products.length, 'products');
  
  // Create warehouse for venue
  const warehouse = await prisma.warehouse.upsert({
    where: { id: 'warehouse-main' },
    update: {},
    create: {
      id: 'warehouse-main',
      venueId: venue.id,
      name: 'Barra Principal',
      type: 'BAR',
    },
  });
  console.log('✅ Created warehouse:', warehouse.name);
  
  // Create cash register
  const cashRegister = await prisma.cashRegister.upsert({
    where: { id: 'cash-register-1' },
    update: {},
    create: {
      id: 'cash-register-1',
      venueId: venue.id,
      warehouseId: warehouse.id,
      name: 'Caja 1',
      type: 'BAR',
    },
  });
  console.log('✅ Created cash register:', cashRegister.name);
  
  // Create ticket provider for external integrations
  await prisma.ticketProvider.upsert({
    where: { code: 'passline' },
    update: {},
    create: {
      code: 'passline',
      name: 'Passline',
      type: 'API',
    },
  });
  
  await prisma.ticketProvider.upsert({
    where: { code: 'ticketplus' },
    update: {},
    create: {
      code: 'ticketplus',
      name: 'TicketPlus',
      type: 'API',
    },
  });
  
  await prisma.ticketProvider.upsert({
    where: { code: 'manual' },
    update: {},
    create: {
      code: 'manual',
      name: 'Ingreso Manual',
      type: 'MANUAL',
    },
  });
  console.log('✅ Created ticket providers');
  
  console.log('\n✨ Seed completed successfully!\n');
  console.log('📧 Demo login credentials:');
  console.log('   Email: admin@demo.com');
  console.log('   Password: admin123');
  console.log('   PIN: 1234\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
