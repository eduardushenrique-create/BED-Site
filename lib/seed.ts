import prisma from './prisma'

async function seed() {
  if (!prisma) {
    throw new Error('DATABASE_URL nao configurado para seed.')
  }

  console.log('Starting database seed...')

  const categories = [
    { name: 'Decoracao', slug: 'decoracao', description: 'Objetos decorativos para sua casa', sortOrder: 1 },
    { name: 'Cozinha', slug: 'cozinha', description: 'Utensilios e acessorios para cozinha', sortOrder: 2 },
    { name: 'Escritorio', slug: 'escritorio', description: 'Organizadores e itens para seu escritorio', sortOrder: 3 },
    { name: 'Infantil', slug: 'infantil', description: 'Presentes e brinquedos para criancas', sortOrder: 4 },
    { name: 'Pets', slug: 'pets', description: 'Acessorios para seus pets', sortOrder: 5 },
    { name: 'Casamento', slug: 'casamento', description: 'Presentes para casais', sortOrder: 6 },
    { name: 'Aniversario', slug: 'aniversario', description: 'Presentes para aniversario', sortOrder: 7 },
  ]

  for (const category of categories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: category,
      create: category,
    })
  }

  const products = [
    {
      name: 'Porta-Retratos Geometrico',
      slug: 'porta-retratos-geometrico',
      sku: 'PRG-001',
      shortDescription: 'Porta-retratos moderno com design geometrico, perfeito para escritorio ou sala.',
      description: '<p>Porta-retratos impresso em 3D com design geometrico moderno.</p>',
      price: 89.9,
      compareAtPrice: 119.9,
      isFeatured: true,
      isPersonalizable: true,
      categorySlug: 'decoracao',
      imageUrl: 'https://images.unsplash.com/photo-1513519245088-0e12902e35a6?w=800',
    },
    {
      name: 'Suporte para Tablets',
      slug: 'suporte-tablets',
      sku: 'ST-001',
      shortDescription: 'Suporte ajustavel para tablets e celulares em multiplos angulos.',
      description: '<p>Suporte resistente para tablets e smartphones.</p>',
      price: 59.9,
      compareAtPrice: null,
      isFeatured: true,
      isPersonalizable: false,
      categorySlug: 'escritorio',
      imageUrl: 'https://images.unsplash.com/photo-1589254065878-42c9da9e2f58?w=800',
    },
    {
      name: 'Organizador de Cozinha',
      slug: 'organizador-cozinha',
      sku: 'OC-001',
      shortDescription: 'Organizador modular para temperos e utensilios pequenos.',
      description: '<p>Conjunto de organizadores modulares para cozinha.</p>',
      price: 79.9,
      compareAtPrice: null,
      isFeatured: false,
      isPersonalizable: true,
      categorySlug: 'cozinha',
      imageUrl: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800',
    },
  ]

  for (const item of products) {
    const { categorySlug, imageUrl, ...productData } = item
    const category = await prisma.category.findUnique({ where: { slug: categorySlug } })

    const product = await prisma.product.upsert({
      where: { slug: item.slug },
      update: {
        ...productData,
        status: 'published',
        isActive: true,
        categories: category ? { set: [{ id: category.id }] } : { set: [] },
        stock: 10,
      },
      create: {
        ...productData,
        status: 'published',
        isActive: true,
        categories: category ? { connect: [{ id: category.id }] } : undefined,
        stock: 10,
      },
    })

    await prisma.productImage.upsert({
      where: { id: `${product.id}_main` },
      update: { url: imageUrl, alt: product.name, isMain: true },
      create: { id: `${product.id}_main`, productId: product.id, url: imageUrl, alt: product.name, isMain: true },
    })

    if (product.isPersonalizable) {
      await prisma.personalizationField.upsert({
        where: { id: `${product.id}_text` },
        update: {
          label: 'Texto para gravacao',
          fieldType: 'text',
          placeholder: 'Ex: Familia Silva',
          isRequired: true,
          maxLength: 30,
        },
        create: {
          id: `${product.id}_text`,
          productId: product.id,
          label: 'Texto para gravacao',
          fieldType: 'text',
          placeholder: 'Ex: Familia Silva',
          isRequired: true,
          maxLength: 30,
        },
      })
    }
  }

  // SPEC-003: categorias iniciais de despesas. Upsert por slug — seguro de
  // re-rodar e não sobrescreve nome/descrição que o admin tenha customizado.
  const expenseCategories = [
    { slug: 'filamentos', name: 'Filamentos', description: 'Compra de filamento para impressão', defaultType: 'variable', costCenter: 'production', color: '#A855F7' },
    { slug: 'embalagens', name: 'Embalagens', description: 'Caixas, sacos e materiais de embalo', defaultType: 'variable', costCenter: 'production', color: '#F97316' },
    { slug: 'softwares', name: 'Softwares', description: 'Assinaturas de softwares (slicer, design, etc.)', defaultType: 'recurring', costCenter: 'admin', color: '#0EA5E9' },
    { slug: 'plataforma-hospedagem', name: 'Plataforma e hospedagem', description: 'Servidor, hospedagem do site, banco de dados', defaultType: 'recurring', costCenter: 'infra', color: '#2563EB' },
    { slug: 'dominio-infraestrutura', name: 'Domínio e infraestrutura', description: 'Domínio, e-mail corporativo, ferramentas de infra', defaultType: 'recurring', costCenter: 'infra', color: '#1E40AF' },
    { slug: 'marketing-anuncios', name: 'Marketing e anúncios', description: 'Anúncios pagos, mídia, conteúdo', defaultType: 'variable', costCenter: 'marketing', color: '#DB2777' },
    { slug: 'manutencao-impressoras', name: 'Manutenção de impressoras', description: 'Peças de reposição, calibração, reparos', defaultType: 'variable', costCenter: 'production', color: '#EA580C' },
    { slug: 'energia-eletrica', name: 'Energia elétrica', description: 'Conta de luz proporcional à produção', defaultType: 'recurring', costCenter: 'production', color: '#FACC15' },
    { slug: 'taxas-pagamento', name: 'Taxas de pagamento', description: 'Mercado Pago, gateway, taxas bancárias', defaultType: 'variable', costCenter: 'admin', color: '#10B981' },
    { slug: 'fretes-operacionais', name: 'Fretes operacionais', description: 'Frete de insumos recebidos (não inclui frete de venda)', defaultType: 'variable', costCenter: 'production', color: '#14B8A6' },
    { slug: 'ferramentas-acessorios', name: 'Ferramentas e acessórios', description: 'Chaves, espátulas, peças auxiliares', defaultType: 'one_off', costCenter: 'production', color: '#6366F1' },
    { slug: 'administrativo', name: 'Administrativo', description: 'Contador, jurídico, papelada', defaultType: 'recurring', costCenter: 'admin', color: '#64748B' },
    { slug: 'outros', name: 'Outros', description: 'Despesas que não se encaixam nas demais categorias', defaultType: 'one_off', costCenter: 'other', color: '#94A3B8' },
  ]

  for (const cat of expenseCategories) {
    await prisma.expenseCategory.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    })
  }

  console.log('Seed completed.')
}

seed()
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    if (prisma) {
      await prisma.$disconnect()
    }
  })
