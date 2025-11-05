import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding to DB:', process.env.DATABASE_URL);
  await prisma.$connect();

  // 1) 确保存在管理员角色（admin）
  const adminRole = await prisma.role.upsert({
    where: { name: 'admin' },
    update: {},
    create: {
      name: 'admin',
      description: '超级管理员，拥有全部权限',
    },
  });

  // 2) 确保存在管理员账号（admin@example.com，密码为 123456）
  // 注意：这里直接存入明文 "123456" 到 passwordHash 字段，仅用于示例/本地开发
  // 生产环境请改为存储真正的哈希（如 bcrypt/argon2）。
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      name: 'admin',
      passwordHash: '123456',
    },
  });
  console.log('Upserted admin user id:', adminUser.id);

  // 3) 绑定用户与管理员角色（幂等）
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: adminUser.id,
        roleId: adminRole.id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      roleId: adminRole.id,
    },
  });

  const counts = await Promise.all([
    prisma.user.count(),
    prisma.role.count(),
    prisma.userRole.count(),
  ]);
  console.log('Counts => users/roles/userRoles:', counts);

  const checkAdmin = await prisma.user.findUnique({
    where: { email: 'admin@example.com' },
  });
  console.log('Check admin exists:', !!checkAdmin);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
