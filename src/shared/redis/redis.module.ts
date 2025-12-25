import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';

/**
 * Redis 公用模块
 * 使用 @Global() 装饰器，使其成为全局模块
 * 其他模块可以直接注入 RedisService，无需在各自的模块中导入 RedisModule
 */
@Global()
@Module({
	providers: [RedisService],
	exports: [RedisService], // 导出 RedisService 供其他模块使用
})
export class RedisModule {}
