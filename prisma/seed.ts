import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PRODUCTION_SEED !== 'true') {
    console.log('⚠️ Seeding skipped in production environment (set ALLOW_PRODUCTION_SEED=true to override).')
    return
  }

  console.log('🌱 Seeding FriendSpace database...')

  const hashedPassword = await bcrypt.hash('Demo1234!', 12)

  // Create demo users
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@friendspace.app' },
    update: {},
    create: {
      email: 'demo@friendspace.app',
      name: 'Demo User',
      username: 'demo',
      hashedPassword,
    },
  })

  const rahul = await prisma.user.upsert({
    where: { email: 'rahul@friendspace.app' },
    update: {},
    create: {
      email: 'rahul@friendspace.app',
      name: 'Rahul Sharma',
      username: 'rahul',
      hashedPassword,
    },
  })

  const priya = await prisma.user.upsert({
    where: { email: 'priya@friendspace.app' },
    update: {},
    create: {
      email: 'priya@friendspace.app',
      name: 'Priya Patel',
      username: 'priya',
      hashedPassword,
    },
  })

  const alex = await prisma.user.upsert({
    where: { email: 'alex@friendspace.app' },
    update: {},
    create: {
      email: 'alex@friendspace.app',
      name: 'Alex Chen',
      username: 'alex',
      hashedPassword,
    },
  })

  console.log('✅ Users created')

  // Create workspace
  const workspace = await prisma.workspace.upsert({
    where: { slug: 'my-friends' },
    update: {},
    create: {
      name: 'My Friends',
      description: 'Our private collaboration space',
      slug: 'my-friends',
      ownerId: demoUser.id,
      icon: '🏠',
    },
  })

  // Add all members
  const memberEntries = [
    { user: demoUser, role: 'OWNER' as const },
    { user: rahul, role: 'ADMIN' as const },
    { user: priya, role: 'MEMBER' as const },
    { user: alex, role: 'MEMBER' as const },
  ]

  for (const { user, role } of memberEntries) {
    await prisma.workspaceMember.upsert({
      where: {
        workspaceId_userId: { workspaceId: workspace.id, userId: user.id },
      },
      update: {},
      create: { workspaceId: workspace.id, userId: user.id, role },
    })
  }

  console.log('✅ Workspace & members created')

  // Create projects
  const collegeProject = await prisma.project.create({
    data: {
      workspaceId: workspace.id,
      creatorId: demoUser.id,
      name: 'College Project',
      description: 'Final year project submission',
      icon: '📚',
      color: '#6366f1',
    },
  })

  const tripProject = await prisma.project.create({
    data: {
      workspaceId: workspace.id,
      creatorId: rahul.id,
      name: 'Trip Planning',
      description: 'Planning our Goa trip!',
      icon: '✈️',
      color: '#10b981',
    },
  })

  // Add project members
  for (const user of [demoUser, rahul, priya, alex]) {
    await prisma.projectMember.create({
      data: { projectId: collegeProject.id, userId: user.id },
    })
  }

  console.log('✅ Projects created')

  // Create tasks
  const now = new Date()
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const twoDays = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000)

  const tasks = await Promise.all([
    prisma.task.create({
      data: {
        workspaceId: workspace.id,
        projectId: collegeProject.id,
        creatorId: demoUser.id,
        title: 'Finish UI Design',
        description: 'Complete all screens for the college project UI',
        priority: 'HIGH',
        status: 'IN_PROGRESS',
        dueDate: twoDays,
      },
    }),
    prisma.task.create({
      data: {
        workspaceId: workspace.id,
        projectId: collegeProject.id,
        creatorId: rahul.id,
        title: 'Prepare Presentation',
        priority: 'URGENT',
        status: 'TODO',
        dueDate: twoDays,
      },
    }),
    prisma.task.create({
      data: {
        workspaceId: workspace.id,
        projectId: collegeProject.id,
        creatorId: priya.id,
        title: 'Upload Documentation',
        priority: 'MEDIUM',
        status: 'TODO',
        dueDate: nextWeek,
      },
    }),
    prisma.task.create({
      data: {
        workspaceId: workspace.id,
        projectId: tripProject.id,
        creatorId: alex.id,
        title: 'Book Flight Tickets',
        priority: 'LOW',
        status: 'BACKLOG',
        dueDate: nextWeek,
      },
    }),
  ])

  // Assign tasks
  await prisma.taskAssignee.createMany({
    data: [
      { taskId: tasks[0].id, userId: demoUser.id },
      { taskId: tasks[1].id, userId: rahul.id },
      { taskId: tasks[2].id, userId: priya.id },
      { taskId: tasks[3].id, userId: alex.id },
    ],
  })

  console.log('✅ Tasks created')

  // Create general group conversation
  const generalConvo = await prisma.conversation.create({
    data: {
      workspaceId: workspace.id,
      name: 'General',
      type: 'GROUP',
      lastMessageAt: new Date(),
    },
  })

  await prisma.conversationMember.createMany({
    data: [demoUser, rahul, priya, alex].map((u) => ({
      conversationId: generalConvo.id,
      userId: u.id,
    })),
  })

  // Seed messages
  const messages = [
    { senderId: rahul.id, content: 'Hey everyone! Welcome to FriendSpace 👋' },
    { senderId: priya.id, content: 'This looks amazing! Love it 🎉' },
    { senderId: alex.id, content: "Let's get productive!" },
    { senderId: demoUser.id, content: "Yes! Let's start with the college project first." },
  ]

  for (const msg of messages) {
    await prisma.message.create({
      data: { conversationId: generalConvo.id, ...msg },
    })
  }

  console.log('✅ Conversations & messages created')

  console.log('')
  console.log('🎉 Seed complete!')
  console.log('')
  console.log('Demo login credentials (all share the same password):')
  console.log('  Email:    demo@friendspace.app')
  console.log('  Password: Demo1234!')
  console.log('')
  console.log('Other demo accounts: rahul@, priya@, alex@ @friendspace.app')
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
