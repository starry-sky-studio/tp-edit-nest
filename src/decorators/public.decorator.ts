import { SetMetadata } from '@nestjs/common';

/**
 * 标记路由为「公开接口」的装饰器
 *
 * - 被 `@Public()` 标记的路由将跳过全局 JWT 守卫校验
 * - 内部是往路由 handler 上打一个 `isPublic: true` 的 metadata
 * - `JwtAuthGuard` 会通过这个 metadata 判断是否直接放行
 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
