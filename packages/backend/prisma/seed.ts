import { PrismaClient, Plan, BookmarkType, HighlightColor } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create demo user
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@example.com' },
    update: {},
    create: {
      email: 'demo@example.com',
      passwordHash: '$2b$10$demohashedpassword', // placeholder
      name: 'Demo User',
      plan: Plan.PRO,
      preferences: {
        defaultView: 'grid',
        theme: 'system',
      },
    },
  });

  console.log(`Created user: ${demoUser.email}`);

  // Create default "Unsorted" collection
  const unsortedCollection = await prisma.collection.upsert({
    where: { id: 'unsorted-' + demoUser.id },
    update: {},
    create: {
      id: 'unsorted-' + demoUser.id,
      ownerId: demoUser.id,
      title: 'Unsorted',
      icon: 'inbox',
      sortOrder: 0,
    },
  });

  // Create sample collections
  const devCollection = await prisma.collection.create({
    data: {
      ownerId: demoUser.id,
      title: 'Development',
      icon: 'code',
      color: '#3B82F6',
      sortOrder: 1,
    },
  });

  const readingCollection = await prisma.collection.create({
    data: {
      ownerId: demoUser.id,
      title: 'Reading List',
      icon: 'book',
      color: '#10B981',
      sortOrder: 2,
      isPublic: true,
      shareSlug: 'demo-reading-list',
    },
  });


  console.log(`Created collections: ${unsortedCollection.title}, ${devCollection.title}, ${readingCollection.title}`);

  // Create sample tags
  const tags = await Promise.all([
    prisma.tag.create({
      data: {
        ownerId: demoUser.id,
        name: 'TypeScript',
        normalizedName: 'typescript',
        color: '#3178C6',
      },
    }),
    prisma.tag.create({
      data: {
        ownerId: demoUser.id,
        name: 'React',
        normalizedName: 'react',
        color: '#61DAFB',
      },
    }),
    prisma.tag.create({
      data: {
        ownerId: demoUser.id,
        name: 'Tutorial',
        normalizedName: 'tutorial',
        color: '#F59E0B',
      },
    }),
  ]);

  console.log(`Created ${tags.length} tags`);

  // Create sample bookmarks
  const bookmark1 = await prisma.bookmark.create({
    data: {
      ownerId: demoUser.id,
      collectionId: devCollection.id,
      url: 'https://www.typescriptlang.org/docs/',
      normalizedUrl: 'typescriptlang.org/docs',
      title: 'TypeScript Documentation',
      excerpt: 'TypeScript is a typed superset of JavaScript that compiles to plain JavaScript.',
      domain: 'typescriptlang.org',
      type: BookmarkType.ARTICLE,
      tags: {
        create: [{ tagId: tags[0]!.id }],
      },
    },
  });

  const bookmark2 = await prisma.bookmark.create({
    data: {
      ownerId: demoUser.id,
      collectionId: devCollection.id,
      url: 'https://react.dev/',
      normalizedUrl: 'react.dev',
      title: 'React Documentation',
      excerpt: 'The library for web and native user interfaces.',
      domain: 'react.dev',
      type: BookmarkType.ARTICLE,
      isFavorite: true,
      tags: {
        create: [{ tagId: tags[1]!.id }, { tagId: tags[2]!.id }],
      },
    },
  });

  console.log(`Created ${2} bookmarks`);


  // Create sample highlight
  await prisma.highlight.create({
    data: {
      bookmarkId: bookmark2.id,
      ownerId: demoUser.id,
      textSelected: 'The library for web and native user interfaces',
      color: HighlightColor.YELLOW,
      annotationMd: 'Great tagline for React!',
      positionContext: {
        startOffset: 0,
        endOffset: 47,
        containerSelector: 'h1.hero-title',
        surroundingText: 'React - The library for web and native user interfaces',
      },
    },
  });

  console.log('Created sample highlight');

  // Create a second user for sharing demo
  const secondUser = await prisma.user.upsert({
    where: { email: 'viewer@example.com' },
    update: {},
    create: {
      email: 'viewer@example.com',
      passwordHash: '$2b$10$viewerhashedpassword',
      name: 'Viewer User',
      plan: Plan.FREE,
    },
  });

  // Share reading collection with second user
  await prisma.collectionPermission.create({
    data: {
      collectionId: readingCollection.id,
      userId: secondUser.id,
      role: 'VIEWER',
    },
  });

  console.log(`Shared collection with ${secondUser.email}`);

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
