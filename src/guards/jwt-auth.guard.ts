import {
	CanActivate,
	ExecutionContext,
	Injectable,
	UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * 全局 JWT 鉴权守卫
 *
 * 功能说明：
 * - 在每次请求进入 controller 之前执行
 * - 如果路由/控制器上有 `@Public()`，则直接放行
 * - 否则从 `Authorization: Bearer <token>` 中提取 JWT 并验证
 * - 验证成功后将 payload 挂在 `request.user`，供 `@CurrentUser()` 使用
 * - 验证失败或缺少 token 时抛出 `UnauthorizedException(401)`
 */
interface JwtPayload {
	sub: number;
	email: string;
	iat?: number;
	exp?: number;
	[key: string]: unknown;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
	constructor(
		private readonly jwtService: JwtService,
		private readonly reflector: Reflector,
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		// 1. 先判断是否标记为公开接口（@Public），如果是则跳过鉴权
		const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
			context.getHandler(),
			context.getClass(),
		]);
		if (isPublic) {
			return true;
		}

		const request = context.switchToHttp().getRequest<Request>();
		const token = this.extractToken(request);

		// 2. 没有携带 token，直接返回 401
		if (!token) {
			throw new UnauthorizedException('缺少访问令牌');
		}

		try {
			// 3. 验证并解析 JWT，符合规范则视为已登录用户
			const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
			// 将用户信息挂到 request 上，后续在 controller 中通过 @CurrentUser() 读取
			(request as any).user = payload;
			return true;
		} catch {
			// 4. token 无效或过期
			throw new UnauthorizedException('无效或过期的访问令牌');
		}
	}

	/**
	 * 从请求头中解析 Bearer Token
	 * 约定格式：Authorization: Bearer <JWT>
	 */
	private extractToken(request: Request): string | undefined {
		const [type, token] = request.headers.authorization?.split(' ') ?? [];
		if (type !== 'Bearer') {
			return undefined;
		}
		return token;
	}
}
