import {
	BadRequestException,
	Injectable,
	UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthProvider, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { UserService } from '../user/user.service';
import { CreateAuthDto } from './dto/create-auth.dto';
import { OAuthLoginDto, OAuthProvider } from './dto/oauth-login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@Injectable()
export class AuthService {
	private prisma = new PrismaClient();
	constructor(
		private readonly jwtService: JwtService,
		private readonly usersService: UserService,
	) {}

	/** 使用 bcrypt 进行密码哈希 */
	private async hashPassword(password: string): Promise<string> {
		const saltRounds = 10; // 盐的迭代次数，越高越安全但耗时更长
		return bcrypt.hash(password, saltRounds); // 使用 bcrypt 生成加盐哈希
	}

	/** 生成访问令牌（短过期时间：15分钟） */
	private async generateAccessToken(
		userId: number,
		email: string,
	): Promise<string> {
		return this.jwtService.signAsync(
			{
				sub: userId,
				email: email,
			},
			{
				expiresIn: '15m', // 访问令牌 15 分钟过期
			},
		);
	}

	/** 生成刷新令牌（长过期时间：7天） */
	private async generateRefreshToken(
		userId: number,
		email: string,
	): Promise<string> {
		return this.jwtService.signAsync(
			{
				sub: userId,
				email: email,
				type: 'refresh', // 标记为刷新令牌
			},
			{
				expiresIn: '7d', // 刷新令牌 7 天过期
			},
		);
	}

	private async validateUser(email: string, password: string) {
		const user = await this.usersService.findByEmailForAuth(email);
		if (!user || !user.passwordHash) {
			throw new UnauthorizedException('邮箱或密码错误');
		}
		console.log(user.passwordHash);
		const match = await bcrypt.compare(password, user.passwordHash);
		console.log(match);
		if (!match) {
			throw new UnauthorizedException('111邮箱或密码错误');
		}
		return user;
	}

	//注册
	async signup(createAuthDto: CreateAuthDto) {
		// 交给 UserService 内部统一做一次哈希，避免重复哈希导致比对失败
		const user = await this.usersService.create(createAuthDto);

		const [accessToken, refreshToken] = await Promise.all([
			this.generateAccessToken(user.id, user.email),
			this.generateRefreshToken(user.id, user.email),
		]);

		return {
			user: {
				id: user.id,
				email: user.email,
				name: user.name,
				createdAt: user.createdAt,
			},
			token: accessToken,
			refresh_token: refreshToken,
		};
	}

	//登录
	async login(createAuthDto: CreateAuthDto) {
		const user = await this.validateUser(
			createAuthDto.email,
			createAuthDto.password,
		);

		const [accessToken, refreshToken] = await Promise.all([
			this.generateAccessToken(user.id, user.email),
			this.generateRefreshToken(user.id, user.email),
		]);

		return {
			user: {
				id: user.id,
				email: user.email,
				name: user.name,
				createdAt: user.createdAt,
			},
			token: accessToken,
			refresh_token: refreshToken,
		};
	}

	/**
	 * 使用 GitHub OAuth code 完成登录：
	 * 1. 用 code 向 GitHub 换取 access_token
	 * 2. 用 access_token 调 GitHub API 获取用户信息
	 * 3. 组装 OAuthLoginDto，复用现有 oauthLogin 逻辑
	 */
	async githubLoginWithCode(code: string) {
		if (!code) {
			throw new BadRequestException('缺少 GitHub OAuth code');
		}

		// GitHub OAuth 应用的 Client ID，用来标识是哪一个 GitHub 应用发起的授权
		const clientId = process.env.GITHUB_CLIENT_ID;
		// GitHub OAuth 应用的 Client Secret，只有后端知道，用来安全地换取 access_token
		const clientSecret = process.env.GITHUB_CLIENT_SECRET;
		// GitHub 授权成功后回调到你站点的地址，必须和 GitHub 应用里配置的回调 URL 完全一致
		const redirectUri = process.env.GITHUB_REDIRECT_URI;

		if (!clientId || !clientSecret || !redirectUri) {
			throw new BadRequestException(
				'GitHub OAuth 环境变量未配置，请设置 GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET / GITHUB_REDIRECT_URI',
			);
		}

		// 1. 用 code 换取 access_token
		const tokenResponse = await fetch(
			'https://github.com/login/oauth/access_token',
			{
				method: 'POST',
				headers: {
					Accept: 'application/json',
				},
				body: new URLSearchParams({
					client_id: clientId,
					client_secret: clientSecret,
					code,
					redirect_uri: redirectUri,
				}),
			},
		);

		if (!tokenResponse.ok) {
			const text = await tokenResponse.text();
			throw new BadRequestException(
				`GitHub OAuth 交换 access_token 失败: ${text}`,
			);
		}

		const tokenJson: any = await tokenResponse.json();
		if (!tokenJson.access_token) {
			throw new BadRequestException(
				`GitHub OAuth 响应中缺少 access_token: ${JSON.stringify(tokenJson)}`,
			);
		}

		const accessToken: string = tokenJson.access_token;

		// 2. 用 access_token 获取用户信息
		const userHeaders = {
			Authorization: `Bearer ${accessToken}`,
			Accept: 'application/json',
			'User-Agent': 'tp-edit-app',
		};

		// 2.1 获取基础用户信息
		const userRes = await fetch('https://api.github.com/user', {
			headers: userHeaders,
		});

		if (!userRes.ok) {
			const text = await userRes.text();
			throw new BadRequestException(`GitHub 获取用户信息失败: ${text}`);
		}

		const userJson: any = await userRes.json();

		// 2.2 如果 email 为空，再去 /user/emails 拉一次
		let email: string | undefined = userJson.email ?? undefined;
		if (!email) {
			const emailsRes = await fetch('https://api.github.com/user/emails', {
				headers: userHeaders,
			});
			if (emailsRes.ok) {
				const emailsJson: any[] = await emailsRes.json();
				const primary =
					emailsJson.find((e) => e.primary && e.verified) ?? emailsJson[0];
				if (primary?.email) {
					email = primary.email as string;
				}
			}
		}

		const providerAccountId = String(userJson.id);
		const name: string | undefined =
			(userJson.name as string | undefined) ??
			(userJson.login as string | undefined);
		const avatarUrl: string | undefined = userJson.avatar_url ?? undefined;

		// 3. 组装 OAuthLoginDto，复用现有 oauthLogin 逻辑
		const dto: OAuthLoginDto = {
			provider: OAuthProvider.GITHUB,
			providerAccountId,
			email,
			name,
			avatarUrl,
			accessToken,
		};

		return this.oauthLogin(dto);
	}

	/**
	 * 使用 Google OAuth code 完成登录：
	 * 1. 用 code 向 Google 换取 access_token / id_token
	 * 2. 用 access_token 调 Google API 获取用户信息（email/name/avatar）
	 * 3. 组装 OAuthLoginDto，复用现有 oauthLogin 逻辑
	 */
	async googleLoginWithCode(code: string) {
		if (!code) {
			throw new BadRequestException('缺少 Google OAuth code');
		}

		const clientId = process.env.GOOGLE_CLIENT_ID;
		const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
		const redirectUri = process.env.GOOGLE_REDIRECT_URI;

		if (!clientId || !clientSecret || !redirectUri) {
			throw new BadRequestException(
				'Google OAuth 环境变量未配置，请设置 GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI',
			);
		}

		// 1. 用 code 换取 token
		const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				Accept: 'application/json',
			},
			body: new URLSearchParams({
				code,
				client_id: clientId,
				client_secret: clientSecret,
				redirect_uri: redirectUri,
				grant_type: 'authorization_code',
			}),
		});

		if (!tokenResponse.ok) {
			const text = await tokenResponse.text();
			throw new BadRequestException(
				`Google OAuth 交换 access_token 失败: ${text}`,
			);
		}

		const tokenJson: any = await tokenResponse.json();
		const accessToken: string | undefined = tokenJson.access_token;
		const idToken: string | undefined = tokenJson.id_token;

		if (!accessToken) {
			throw new BadRequestException(
				`Google OAuth 响应中缺少 access_token: ${JSON.stringify(tokenJson)}`,
			);
		}

		// 2. 用 access_token 获取用户信息
		const userHeaders = {
			Authorization: `Bearer ${accessToken}`,
			Accept: 'application/json',
		};

		let profile: any = {};

		// 2.1 调用 userinfo
		const userRes = await fetch(
			'https://www.googleapis.com/oauth2/v2/userinfo',
			{
				headers: userHeaders,
			},
		);
		if (userRes.ok) {
			profile = await userRes.json();
		}

		// 2.2 如果还缺字段，尝试从 id_token 解码补充
		if ((!profile || !profile.id) && idToken) {
			try {
				const payload = JSON.parse(
					Buffer.from(idToken.split('.')[1], 'base64').toString('utf8'),
				);
				profile = {
					...profile,
					id: payload.sub ?? profile.id,
					email: payload.email ?? profile.email,
					name: payload.name ?? profile.name,
					picture: payload.picture ?? profile.picture,
				};
			} catch {
				// ignore decode errors
			}
		}

		const providerAccountId = String(profile.id ?? '');
		if (!providerAccountId) {
			throw new BadRequestException('Google 用户信息缺少 id');
		}

		const email: string | undefined = profile.email ?? undefined;
		const name: string | undefined = profile.name ?? undefined;
		const avatarUrl: string | undefined = profile.picture ?? undefined;

		const dto: OAuthLoginDto = {
			provider: OAuthProvider.GOOGLE,
			providerAccountId,
			email,
			name,
			avatarUrl,
			accessToken,
		};

		return this.oauthLogin(dto);
	}

	/**
	 * 第三方登录（Google / GitHub）
	 * 逻辑：
	 * 1. 先查 Account(provider + providerAccountId)
	 * 2. 如果已存在，直接取对应的 User
	 * 3. 如果不存在：
	 *    - 如果有 email，优先用 email 找已有用户并绑定新的 Account
	 *    - 否则创建新用户 + Account
	 */
	async oauthLogin(dto: OAuthLoginDto) {
		const provider =
			dto.provider === OAuthProvider.GOOGLE
				? AuthProvider.google
				: dto.provider === OAuthProvider.GITHUB
					? AuthProvider.github
					: null;

		if (!provider) {
			throw new BadRequestException('不支持的第三方登录提供方');
		}

		// 1. 先看是否已有这个第三方账户
		const existingAccount = await this.prisma.account.findUnique({
			where: {
				provider_providerAccountId: {
					provider,
					providerAccountId: dto.providerAccountId,
				},
			},
			include: {
				user: true,
			},
		});

		let user = existingAccount?.user ?? null;

		// 2. 如果没有对应 Account，但有 email，则尝试用 email 找用户并绑定
		if (!user && dto.email) {
			user = await this.prisma.user.findFirst({
				where: {
					email: dto.email,
					deletedAt: null,
				},
			});
		}

		// 3. 如果还没有用户，则创建新用户
		if (!user) {
			user = await this.prisma.user.create({
				data: {
					email:
						dto.email ?? `${dto.provider}-${dto.providerAccountId}@example.com`,
					name: dto.name ?? dto.provider,
					avatarUrl: dto.avatarUrl,
					// 第三方登录用户可以没有本地密码
				},
			});
		}

		// 4. 确保 Account 存在（幂等）
		if (!existingAccount) {
			await this.prisma.account.create({
				data: {
					userId: user.id,
					provider,
					providerAccountId: dto.providerAccountId,
					accessToken: dto.accessToken,
					refreshToken: dto.refreshToken,
				},
			});
		} else {
			// 可选：更新 accessToken / refreshToken
			await this.prisma.account.update({
				where: {
					provider_providerAccountId: {
						provider,
						providerAccountId: dto.providerAccountId,
					},
				},
				data: {
					accessToken: dto.accessToken ?? existingAccount.accessToken,
					refreshToken: dto.refreshToken ?? existingAccount.refreshToken,
				},
			});
		}

		// 5. 生成 JWT
		const [accessToken, refreshToken] = await Promise.all([
			this.generateAccessToken(user.id, user.email),
			this.generateRefreshToken(user.id, user.email),
		]);

		return {
			user: {
				id: user.id,
				email: user.email,
				name: user.name,
				avatarUrl: user.avatarUrl,
				createdAt: user.createdAt,
			},
			token: accessToken,
			refresh_token: refreshToken,
			provider: dto.provider,
		};
	}

	/**
	 * 刷新访问令牌
	 * 使用刷新令牌生成新的访问令牌和刷新令牌
	 */
	async refresh(refreshTokenDto: RefreshTokenDto) {
		try {
			// 验证刷新令牌
			const payload = await this.jwtService.verifyAsync(
				refreshTokenDto.refresh_token,
			);

			// 检查是否为刷新令牌
			if (payload.type !== 'refresh') {
				throw new UnauthorizedException('无效的刷新令牌');
			}

			// 查找用户
			const user = await this.prisma.user.findUnique({
				where: {
					id: payload.sub,
					deletedAt: null,
				},
			});

			if (!user) {
				throw new UnauthorizedException('用户不存在');
			}

			// 生成新的访问令牌和刷新令牌
			const [newAccessToken, newRefreshToken] = await Promise.all([
				this.generateAccessToken(user.id, user.email),
				this.generateRefreshToken(user.id, user.email),
			]);

			return {
				token: newAccessToken,
				refresh_token: newRefreshToken,
			};
		} catch (error) {
			if (error instanceof UnauthorizedException) {
				throw error;
			}
			// JWT 验证失败（过期、无效等）
			throw new UnauthorizedException('刷新令牌无效或已过期');
		}
	}
}
