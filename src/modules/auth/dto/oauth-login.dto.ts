import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';

export enum OAuthProvider {
	GOOGLE = 'google',
	GITHUB = 'github',
}

export class OAuthLoginDto {
	@ApiProperty({
		enum: OAuthProvider,
		description: '第三方登录提供方（google / github）',
	})
	@IsEnum(OAuthProvider)
	provider: OAuthProvider;

	@ApiProperty({
		example: '1234567890',
		description: '第三方提供的用户唯一 ID，例如 Google sub 或 GitHub id',
	})
	@IsString()
	providerAccountId: string;

	@ApiProperty({
		example: 'user@example.com',
		required: false,
		description: '第三方返回的邮箱（可能为空）',
	})
	@IsEmail()
	@IsOptional()
	email?: string;

	@ApiProperty({
		example: 'GitHub User',
		required: false,
		description: '第三方返回的昵称',
	})
	@IsString()
	@IsOptional()
	name?: string;

	@ApiProperty({
		example: 'https://avatars.githubusercontent.com/u/123456?v=4',
		required: false,
		description: '第三方头像地址',
	})
	@IsString()
	@IsOptional()
	avatarUrl?: string;

	@ApiProperty({
		required: false,
		description: 'OAuth access token（可选，用于后续调用第三方 API）',
	})
	@IsString()
	@IsOptional()
	accessToken?: string;

	@ApiProperty({
		required: false,
		description: 'OAuth refresh token（可选）',
	})
	@IsString()
	@IsOptional()
	refreshToken?: string;
}
