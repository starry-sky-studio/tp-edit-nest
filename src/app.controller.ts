import { Controller, Get } from '@nestjs/common';
import {
	ApiOkResponse,
	ApiOperation,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import { AppService } from './app.service';
import { RedisService } from './shared/redis/redis.service';

@ApiTags('应用接口')
@Controller()
export class AppController {
	constructor(
		private readonly appService: AppService,
		private readonly redisService: RedisService,
	) {}

	@Get()
	@ApiOperation({ summary: '获取欢迎信息', description: '返回应用的欢迎信息' })
	@ApiOkResponse({
		description: '成功返回欢迎信息',
		schema: {
			type: 'string',
			example: 'Hello World!',
		},
	})
	getHello(): string {
		return this.appService.getHello();
	}

	@Get('health')
	@ApiOperation({
		summary: '应用健康检查',
		description: '用于 Docker 健康检查和监控系统检查应用状态',
	})
	@ApiOkResponse({
		description: '应用运行正常',
		schema: {
			type: 'object',
			properties: {
				status: {
					type: 'string',
					example: 'ok',
					description: '应用状态',
				},
				timestamp: {
					type: 'string',
					example: '2024-01-01T00:00:00.000Z',
					description: '检查时间戳',
				},
				uptime: {
					type: 'number',
					example: 3600,
					description: '应用运行时间（秒）',
				},
			},
		},
	})
	health() {
		return {
			status: 'ok',
			timestamp: new Date().toISOString(),
			uptime: process.uptime(),
		};
	}

	@Get('redis/health')
	@ApiOperation({
		summary: 'Redis 健康检查',
		description: '检查 Redis 数据库连接状态，返回详细的连接信息',
	})
	@ApiOkResponse({
		description: 'Redis 连接正常',
		schema: {
			type: 'object',
			properties: {
				status: {
					type: 'string',
					enum: ['connected', 'disconnected', 'error'],
					example: 'connected',
					description: '连接状态',
				},
				message: {
					type: 'string',
					example: 'Redis 连接正常',
					description: '状态消息',
				},
				info: {
					type: 'object',
					properties: {
						host: {
							type: 'string',
							example: 'localhost',
							description: 'Redis 主机地址',
						},
						port: {
							type: 'number',
							example: 6379,
							description: 'Redis 端口',
						},
						db: {
							type: 'number',
							example: 0,
							description: 'Redis 数据库编号',
						},
					},
					description: '连接信息',
				},
			},
		},
	})
	@ApiResponse({
		status: 200,
		description: 'Redis 连接异常',
		schema: {
			type: 'object',
			properties: {
				status: {
					type: 'string',
					enum: ['disconnected', 'error'],
					example: 'error',
				},
				message: {
					type: 'string',
					example: 'Redis 连接错误: Connection refused',
				},
			},
		},
	})
	async testRedis() {
		return await this.redisService.healthCheck();
	}

	@Get('redis/ping')
	@ApiOperation({
		summary: 'Redis PING 测试',
		description: '使用 Redis PING 命令测试连接，返回 PONG 表示连接正常',
	})
	@ApiOkResponse({
		description: 'Redis 连接正常',
		schema: {
			type: 'object',
			properties: {
				success: {
					type: 'boolean',
					example: true,
					description: '是否成功',
				},
				message: {
					type: 'string',
					example: 'Redis 连接正常',
					description: '响应消息',
				},
				result: {
					type: 'string',
					example: 'PONG',
					description: 'PING 命令返回结果',
				},
			},
		},
	})
	@ApiResponse({
		status: 200,
		description: 'Redis 连接失败',
		schema: {
			type: 'object',
			properties: {
				success: {
					type: 'boolean',
					example: false,
				},
				message: {
					type: 'string',
					example: 'Redis 连接失败',
				},
				error: {
					type: 'string',
					example: 'Connection refused',
				},
			},
		},
	})
	async pingRedis() {
		try {
			const result = await this.redisService.ping();
			return {
				success: true,
				message: 'Redis 连接正常',
				result,
			};
		} catch (error) {
			return {
				success: false,
				message: 'Redis 连接失败',
				error: error.message,
			};
		}
	}
}
