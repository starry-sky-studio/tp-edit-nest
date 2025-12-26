import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * `@CurrentUser()` 参数装饰器
 *
 * - 从当前请求对象中读取在全局 JWT 守卫里挂载的 `request.user`
 * - 一般由 `JwtAuthGuard` 在验证 token 成功后设置
 * - 用法示例：
 *   `someMethod(@CurrentUser() user: JwtPayload) { ... }`
 */
export const CurrentUser = createParamDecorator(
	(_data: unknown, context: ExecutionContext) => {
		const request = context.switchToHttp().getRequest();
		// 这里返回的对象就是在守卫中解析出来的 JWT payload
		return request.user;
	},
);
