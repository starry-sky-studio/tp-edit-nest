import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
	@ApiProperty({ example: 'user@example.com', description: '用户邮箱' })
	@IsEmail()
	email: string;

	@ApiProperty({ example: '张三', required: false, description: '用户昵称' })
	@IsString()
	@IsOptional()
	name?: string;

	@ApiProperty({
		example: '123456',
		required: false,
		description: '登录密码（可选，仅本地登录用户需要）',
	})
	@IsString()
	@IsOptional()
	@MinLength(6, { message: '密码至少需要 6 位' })
	password?: string;
}
