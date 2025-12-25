import * as dotenv from 'dotenv';
dotenv.config(); // 加载 .env，方便读取 DATABASE_URL 等变量

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
	console.log('Seeding to DB:', process.env.DATABASE_URL);
	await prisma.$connect();

	// 1) 确保存在一个示例用户（方便本地开发）
	const demoUser = await prisma.user.upsert({
		where: { email: 'demo@example.com' },
		update: {},
		create: {
			email: 'demo@example.com',
			name: 'admin',
			// 仅用于本地开发示例，实际生产环境请使用加密后的哈希
			passwordHash: '123456',
		},
	});
	console.log('Upserted demo user id:', demoUser.id);

	// 2) 为该用户创建一篇示例文章（如果不存在）
	const demoArticle = await prisma.article
		.upsert({
			where: {
				// 通过唯一约束模拟幂等，这里使用 (userId, title) 组合唯一逻辑
				// Prisma 不支持直接在 upsert 的 where 中使用复合键，
				// 所以这里先用 findFirst 检查，再决定 create。
				// 为简单起见，先查询再创建：
				id: 1, // 占位，下面会覆盖逻辑
			},
			update: {},
			create: {
				userId: demoUser.id,
				title: '我的第一篇文章',
				content:
					'# 欢迎使用文本编辑器\\n\\n这是一个示例文章内容，你可以在前端进行编辑和保存。',
			},
		})
		.catch(async () => {
			// 如果上面的 upsert 因为 where 条件不合理报错，则退回到简单的逻辑：
			const existing = await prisma.article.findFirst({
				where: {
					userId: demoUser.id,
					title: '我的第一篇文章',
					deletedAt: null,
				},
			});
			if (existing) {
				return existing;
			}
			return prisma.article.create({
				data: {
					userId: demoUser.id,
					title: '我的第一篇文章',
					content:
						'# 欢迎使用文本编辑器\\n\\n这是一个示例文章内容，你可以在前端进行编辑和保存。',
				},
			});
		});

	const [userCount, articleCount] = await Promise.all([
		prisma.user.count(),
		prisma.article.count(),
	]);
	console.log('Counts => users/articles:', userCount, articleCount);

	console.log('Demo article id:', demoArticle.id);
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
