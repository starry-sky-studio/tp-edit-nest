import {
	ConflictException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UserService {
	private prisma = new PrismaClient();

	//saltRounds = 10 表示 bcrypt 在给密码加密时，会做 2¹⁰（1024）次内部运算，次数越多，破解越难、但 CPU 越累、速度越慢。
	private async hashPassword(password: string): Promise<string> {
		const saltRounds = 10;
		return bcrypt.hash(password, saltRounds);
	}

	/**
	 * 供认证使用：按邮箱查询用户（排除软删除），返回 passwordHash 等字段。
	 */
	async findByEmailForAuth(email: string) {
		return this.prisma.user.findFirst({
			where: { email, deletedAt: null },
		});
	}

	async create(createUserDto: CreateUserDto) {
		const existing = await this.prisma.user.findUnique({
			where: { email: createUserDto.email },
		});
		if (existing && !existing.deletedAt) {
			throw new ConflictException('该邮箱已存在');
		}

		const user = await this.prisma.user.create({
			data: {
				email: createUserDto.email,
				name: createUserDto.name,
				passwordHash: createUserDto.password
					? await this.hashPassword(createUserDto.password)
					: null,
			},
		});

		return {
			id: user.id,
			email: user.email,
			name: user.name,
			createdAt: user.createdAt,
		};
	}

	async findAll() {
		const users = await this.prisma.user.findMany({
			where: { deletedAt: null },
			orderBy: { id: 'asc' },
		});
		return users.map((u) => ({
			id: u.id,
			email: u.email,
			name: u.name,
			createdAt: u.createdAt,
		}));
	}

	async findOne(id: number) {
		const user = await this.prisma.user.findUnique({
			where: { id },
		});
		if (!user || user.deletedAt) {
			throw new NotFoundException('用户不存在');
		}
		return {
			id: user.id,
			email: user.email,
			name: user.name,
			createdAt: user.createdAt,
		};
	}

	async update(id: number, updateUserDto: UpdateUserDto) {
		const user = await this.prisma.user.findUnique({ where: { id } });
		if (!user || user.deletedAt) {
			throw new NotFoundException('用户不存在');
		}

		if (updateUserDto.email && updateUserDto.email !== user.email) {
			const existing = await this.prisma.user.findUnique({
				where: { email: updateUserDto.email },
			});
			if (existing && !existing.deletedAt) {
				throw new ConflictException('该邮箱已存在');
			}
		}

		const updated = await this.prisma.user.update({
			where: { id },
			data: {
				email: updateUserDto.email,
				name: updateUserDto.name,
				passwordHash: updateUserDto.password
					? await this.hashPassword(updateUserDto.password)
					: user.passwordHash,
			},
		});

		return {
			id: updated.id,
			email: updated.email,
			name: updated.name,
			createdAt: updated.createdAt,
		};
	}

	async remove(id: number) {
		const user = await this.prisma.user.findUnique({ where: { id } });
		if (!user || user.deletedAt) {
			throw new NotFoundException('用户不存在');
		}
		await this.prisma.user.update({
			where: { id },
			data: { deletedAt: new Date() },
		});
		return { success: true, softDeleted: true };
	}
}
