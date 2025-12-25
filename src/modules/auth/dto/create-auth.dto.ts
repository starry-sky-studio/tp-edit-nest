import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateAuthDto {
	@ApiProperty({ example: 'user@example.com', description: '邮箱，用于登录' })
	@IsEmail()
	email: string;

	@ApiProperty({ example: '123456', description: '登录密码' })
	@IsString()
	@MinLength(6, { message: '密码至少需要 6 位' })
	password: string;

	@ApiProperty({ example: '张三', required: false, description: '用户昵称' })
	@IsString()
	@IsOptional()
	name?: string;
}
