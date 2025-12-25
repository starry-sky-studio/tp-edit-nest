import { Body, Controller, Param, Post } from '@nestjs/common';
import {
	ApiBadRequestResponse,
	ApiOkResponse,
	ApiOperation,
	ApiTags,
	ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { CreateAuthDto } from './dto/create-auth.dto';
import { type OAuthLoginDto, OAuthProvider } from './dto/oauth-login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
	constructor(private readonly authService: AuthService) {}

	@Post('signup')
	@ApiOperation({ summary: '用户注册' })
	@ApiOkResponse({
		description: '注册成功，返回用户信息和访问令牌',
		schema: {
			type: 'object',
			properties: {
				user: {
					type: 'object',
					properties: {
						id: { type: 'number', example: 1 },
						email: { type: 'string', example: 'user@example.com' },
						name: { type: 'string', example: '张三' },
						createdAt: {
							type: 'string',
							format: 'date-time',
							example: '2025-01-01T00:00:00.000Z',
						},
					},
				},
				token: {
					type: 'string',
					example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
					description: '短期访问令牌（Access Token）',
				},
				refresh_token: {
					type: 'string',
					example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
					description: '长期刷新令牌（Refresh Token）',
				},
			},
		},
	})
	@ApiBadRequestResponse({
		description: '请求参数不合法（如邮箱格式错误、密码过短等）',
	})
	register(@Body() createAuthDto: CreateAuthDto) {
		return this.authService.signup(createAuthDto);
	}

	@Post('login')
	@ApiOperation({ summary: '用户登录' })
	@ApiOkResponse({
		description: '登录成功，返回用户信息和访问令牌',
		schema: {
			type: 'object',
			properties: {
				user: {
					type: 'object',
					properties: {
						id: { type: 'number', example: 1 },
						email: { type: 'string', example: 'user@example.com' },
						name: { type: 'string', example: '张三' },
						createdAt: {
							type: 'string',
							format: 'date-time',
						},
					},
				},
				token: {
					type: 'string',
					example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
				},
				refresh_token: {
					type: 'string',
					example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
				},
			},
		},
	})
	@ApiBadRequestResponse({
		description: '请求参数不合法（如邮箱格式错误、密码过短等）',
	})
	@ApiUnauthorizedResponse({
		description: '邮箱或密码错误，认证失败',
	})
	login(@Body() createAuthDto: CreateAuthDto) {
		return this.authService.login(createAuthDto);
	}

	@Post('oauth/:provider')
	@ApiOperation({
		summary: '第三方登录（GitHub / Google）',
		description:
			'前端先完成 OAuth 授权，拿到第三方用户信息后，调用此接口完成绑定和登录。',
	})
	@ApiOkResponse({
		description: '第三方登录成功，返回用户信息和访问令牌',
		schema: {
			type: 'object',
			properties: {
				user: {
					type: 'object',
					properties: {
						id: { type: 'number', example: 1 },
						email: { type: 'string', example: 'user@example.com' },
						name: { type: 'string', example: 'GitHub 用户' },
						avatarUrl: {
							type: 'string',
							example: 'https://avatars.githubusercontent.com/u/1?v=4',
						},
						createdAt: {
							type: 'string',
							format: 'date-time',
						},
					},
				},
				token: {
					type: 'string',
					example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
				},
				refresh_token: {
					type: 'string',
					example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
				},
				provider: {
					type: 'string',
					example: 'github',
					description: '第三方登录提供方标识',
				},
			},
		},
	})
	@ApiBadRequestResponse({
		description: '不支持的第三方登录提供方，或参数不合法',
	})
	oauthLogin(
		@Param('provider') provider: 'google' | 'github',
		@Body() body: Omit<OAuthLoginDto, 'provider'>,
	) {
		if (provider !== 'google' && provider !== 'github') {
			throw new Error('不支持的第三方登录提供方');
		}
		const dto: OAuthLoginDto = {
			...body,
			provider:
				provider === 'google' ? OAuthProvider.GOOGLE : OAuthProvider.GITHUB,
		};
		return this.authService.oauthLogin(dto);
	}

	@Post('refresh')
	@ApiOperation({ summary: '刷新访问令牌' })
	@ApiOkResponse({
		description: '刷新成功，返回新的访问令牌和刷新令牌',
		schema: {
			type: 'object',
			properties: {
				token: {
					type: 'string',
					example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
					description: '新的访问令牌（Access Token）',
				},
				refresh_token: {
					type: 'string',
					example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
					description: '新的刷新令牌（Refresh Token）',
				},
			},
		},
	})
	@ApiBadRequestResponse({
		description: '刷新令牌格式不正确',
	})
	@ApiUnauthorizedResponse({
		description: '刷新令牌无效或已过期',
	})
	refresh(@Body() refreshTokenDto: RefreshTokenDto) {
		return this.authService.refresh(refreshTokenDto);
	}

	/**
	 * GitHub OAuth 回调：
	 * 前端拿到 GitHub 返回的 code 后，调用此接口完成登录。
	 */
	@Post('github/callback')
	@ApiOperation({
		summary: 'GitHub OAuth 回调：使用 code 完成登录',
		description:
			'前端从 GitHub 回调地址中拿到 code 后，调用此接口完成第三方登录。',
	})
	@ApiOkResponse({
		description: 'GitHub 登录成功，返回用户信息和访问令牌',
	})
	@ApiBadRequestResponse({
		description: 'code 无效，或 GitHub OAuth 配置错误',
	})
	async githubCallback(@Body() body: { code: string; state?: string }) {
		return this.authService.githubLoginWithCode(body.code);
	}

	/**
	 * Google OAuth 回调：使用 code 完成登录
	 */
	@Post('google/callback')
	@ApiOperation({
		summary: 'Google OAuth 回调：使用 code 完成登录',
		description:
			'前端从 Google 回调地址中拿到 code 后，调用此接口完成第三方登录。',
	})
	@ApiOkResponse({
		description: 'Google 登录成功，返回用户信息和访问令牌',
	})
	@ApiBadRequestResponse({
		description: 'code 无效，或 Google OAuth 配置错误',
	})
	async googleCallback(@Body() body: { code: string; state?: string }) {
		return this.authService.googleLoginWithCode(body.code);
	}
}
