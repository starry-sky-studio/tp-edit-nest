import {
	Injectable,
	Logger,
	OnModuleInit,
	OnModuleDestroy,
} from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(RedisService.name);
	private redisClient: Redis;

	/**
	 * 模块初始化时创建 Redis 连接
	 */
	onModuleInit() {
		const redisConfig = {
			host: process.env.REDIS_HOST || 'localhost',
			port: parseInt(process.env.REDIS_PORT || '6379', 10),
			password: process.env.REDIS_PASSWORD || undefined,
			db: parseInt(process.env.REDIS_DB || '0', 10),
			retryStrategy: (times: number) => {
				const delay = Math.min(times * 50, 2000);
				this.logger.warn(`Redis 连接重试，第 ${times} 次，延迟 ${delay}ms`);
				return delay;
			},
			maxRetriesPerRequest: 3,
			enableReadyCheck: true,
			lazyConnect: false,
		};

		this.redisClient = new Redis(redisConfig);

		// 连接成功事件
		this.redisClient.on('connect', () => {
			this.logger.log('Redis 连接成功');
		});

		// 连接就绪事件
		this.redisClient.on('ready', () => {
			this.logger.log('Redis 已就绪');
		});

		// 错误事件
		this.redisClient.on('error', (err) => {
			this.logger.error(`Redis 连接错误: ${err.message}`, err.stack);
		});

		// 重连事件
		this.redisClient.on('reconnecting', (delay: number) => {
			this.logger.warn(`Redis 正在重连，延迟 ${delay}ms`);
		});

		// 关闭事件
		this.redisClient.on('close', () => {
			this.logger.warn('Redis 连接已关闭');
		});

		// 结束事件
		this.redisClient.on('end', () => {
			this.logger.warn('Redis 连接已结束');
		});
	}

	/**
	 * 模块销毁时关闭 Redis 连接
	 */
	async onModuleDestroy() {
		if (this.redisClient) {
			await this.redisClient.quit();
			this.logger.log('Redis 连接已关闭');
		}
	}

	/**
	 * 获取 Redis 客户端实例
	 */
	getClient(): Redis {
		if (!this.redisClient) {
			throw new Error('Redis 客户端未初始化');
		}
		return this.redisClient;
	}

	/**
	 * 健康检查 - 测试 Redis 连接
	 * @returns 连接状态信息
	 */
	async healthCheck(): Promise<{
		status: 'connected' | 'disconnected' | 'error';
		message: string;
		info?: {
			host: string;
			port: number;
			db: number;
		};
	}> {
		try {
			if (!this.redisClient) {
				return {
					status: 'disconnected',
					message: 'Redis 客户端未初始化',
				};
			}

			// 使用 PING 命令测试连接
			const result = await this.redisClient.ping();

			if (result === 'PONG') {
				const options = this.redisClient.options;
				return {
					status: 'connected',
					message: 'Redis 连接正常',
					info: {
						host: options.host as string,
						port: options.port as number,
						db: options.db as number,
					},
				};
			} else {
				return {
					status: 'error',
					message: `Redis PING 返回异常: ${result}`,
				};
			}
		} catch (error) {
			this.logger.error(`Redis 健康检查失败: ${error.message}`);
			return {
				status: 'error',
				message: `Redis 连接错误: ${error.message}`,
			};
		}
	}

	/**
	 * 简单的 PING 测试
	 * @returns PONG 字符串
	 */
	async ping(): Promise<string> {
		try {
			return await this.redisClient.ping();
		} catch (error) {
			this.logger.error(`Redis PING 失败: ${error.message}`);
			throw error;
		}
	}

	// ==================== 基础操作 ====================

	/**
	 * 设置键值对
	 * @param key 键
	 * @param value 值
	 * @param ttl 过期时间（秒），可选
	 */
	async set(key: string, value: string, ttl?: number): Promise<'OK'> {
		try {
			if (ttl) {
				return await this.redisClient.setex(key, ttl, value);
			}
			return await this.redisClient.set(key, value);
		} catch (error) {
			this.logger.error(`设置键值失败 [${key}]: ${error.message}`);
			throw error;
		}
	}

	/**
	 * 设置 JSON 对象
	 * @param key 键
	 * @param value 对象值
	 * @param ttl 过期时间（秒），可选
	 */
	async setJson<T>(key: string, value: T, ttl?: number): Promise<'OK'> {
		return this.set(key, JSON.stringify(value), ttl);
	}

	/**
	 * 获取值
	 * @param key 键
	 */
	async get(key: string): Promise<string | null> {
		try {
			return await this.redisClient.get(key);
		} catch (error) {
			this.logger.error(`获取键值失败 [${key}]: ${error.message}`);
			throw error;
		}
	}

	/**
	 * 获取 JSON 对象
	 * @param key 键
	 */
	async getJson<T>(key: string): Promise<T | null> {
		const value = await this.get(key);
		if (!value) return null;
		try {
			return JSON.parse(value) as T;
		} catch (error) {
			this.logger.error(`解析 JSON 失败 [${key}]: ${error.message}`);
			throw error;
		}
	}

	/**
	 * 删除键
	 * @param key 键
	 */
	async del(key: string): Promise<number> {
		try {
			return await this.redisClient.del(key);
		} catch (error) {
			this.logger.error(`删除键失败 [${key}]: ${error.message}`);
			throw error;
		}
	}

	/**
	 * 批量删除键
	 * @param keys 键数组
	 */
	async delMany(keys: string[]): Promise<number> {
		if (keys.length === 0) return 0;
		try {
			return await this.redisClient.del(...keys);
		} catch (error) {
			this.logger.error(`批量删除键失败: ${error.message}`);
			throw error;
		}
	}

	/**
	 * 检查键是否存在
	 * @param key 键
	 */
	async exists(key: string): Promise<number> {
		try {
			return await this.redisClient.exists(key);
		} catch (error) {
			this.logger.error(`检查键存在失败 [${key}]: ${error.message}`);
			throw error;
		}
	}

	/**
	 * 设置过期时间
	 * @param key 键
	 * @param seconds 过期时间（秒）
	 */
	async expire(key: string, seconds: number): Promise<number> {
		try {
			return await this.redisClient.expire(key, seconds);
		} catch (error) {
			this.logger.error(`设置过期时间失败 [${key}]: ${error.message}`);
			throw error;
		}
	}

	/**
	 * 获取剩余过期时间
	 * @param key 键
	 */
	async ttl(key: string): Promise<number> {
		try {
			return await this.redisClient.ttl(key);
		} catch (error) {
			this.logger.error(`获取过期时间失败 [${key}]: ${error.message}`);
			throw error;
		}
	}

	/**
	 * 获取所有匹配的键
	 * @param pattern 匹配模式，如 'user:*'
	 */
	async keys(pattern: string): Promise<string[]> {
		try {
			return await this.redisClient.keys(pattern);
		} catch (error) {
			this.logger.error(`获取键列表失败 [${pattern}]: ${error.message}`);
			throw error;
		}
	}

	// ==================== 哈希操作 ====================

	/**
	 * 设置哈希字段
	 * @param key 键
	 * @param field 字段名
	 * @param value 值
	 */
	async hset(key: string, field: string, value: string): Promise<number> {
		try {
			return await this.redisClient.hset(key, field, value);
		} catch (error) {
			this.logger.error(`设置哈希字段失败 [${key}.${field}]: ${error.message}`);
			throw error;
		}
	}

	/**
	 * 获取哈希字段
	 * @param key 键
	 * @param field 字段名
	 */
	async hget(key: string, field: string): Promise<string | null> {
		try {
			return await this.redisClient.hget(key, field);
		} catch (error) {
			this.logger.error(`获取哈希字段失败 [${key}.${field}]: ${error.message}`);
			throw error;
		}
	}

	/**
	 * 获取所有哈希字段
	 * @param key 键
	 */
	async hgetall(key: string): Promise<Record<string, string>> {
		try {
			return await this.redisClient.hgetall(key);
		} catch (error) {
			this.logger.error(`获取所有哈希字段失败 [${key}]: ${error.message}`);
			throw error;
		}
	}

	/**
	 * 删除哈希字段
	 * @param key 键
	 * @param field 字段名
	 */
	async hdel(key: string, field: string): Promise<number> {
		try {
			return await this.redisClient.hdel(key, field);
		} catch (error) {
			this.logger.error(`删除哈希字段失败 [${key}.${field}]: ${error.message}`);
			throw error;
		}
	}

	// ==================== 列表操作 ====================

	/**
	 * 从左侧推入列表
	 * @param key 键
	 * @param value 值
	 */
	async lpush(key: string, value: string): Promise<number> {
		try {
			return await this.redisClient.lpush(key, value);
		} catch (error) {
			this.logger.error(`左推入列表失败 [${key}]: ${error.message}`);
			throw error;
		}
	}

	/**
	 * 从右侧推入列表
	 * @param key 键
	 * @param value 值
	 */
	async rpush(key: string, value: string): Promise<number> {
		try {
			return await this.redisClient.rpush(key, value);
		} catch (error) {
			this.logger.error(`右推入列表失败 [${key}]: ${error.message}`);
			throw error;
		}
	}

	/**
	 * 从左侧弹出列表
	 * @param key 键
	 */
	async lpop(key: string): Promise<string | null> {
		try {
			return await this.redisClient.lpop(key);
		} catch (error) {
			this.logger.error(`左弹出列表失败 [${key}]: ${error.message}`);
			throw error;
		}
	}

	/**
	 * 从右侧弹出列表
	 * @param key 键
	 */
	async rpop(key: string): Promise<string | null> {
		try {
			return await this.redisClient.rpop(key);
		} catch (error) {
			this.logger.error(`右弹出列表失败 [${key}]: ${error.message}`);
			throw error;
		}
	}

	/**
	 * 获取列表范围
	 * @param key 键
	 * @param start 起始索引
	 * @param stop 结束索引
	 */
	async lrange(key: string, start: number, stop: number): Promise<string[]> {
		try {
			return await this.redisClient.lrange(key, start, stop);
		} catch (error) {
			this.logger.error(`获取列表范围失败 [${key}]: ${error.message}`);
			throw error;
		}
	}

	// ==================== 集合操作 ====================

	/**
	 * 添加集合成员
	 * @param key 键
	 * @param members 成员数组
	 */
	async sadd(key: string, ...members: string[]): Promise<number> {
		try {
			return await this.redisClient.sadd(key, ...members);
		} catch (error) {
			this.logger.error(`添加集合成员失败 [${key}]: ${error.message}`);
			throw error;
		}
	}

	/**
	 * 获取集合所有成员
	 * @param key 键
	 */
	async smembers(key: string): Promise<string[]> {
		try {
			return await this.redisClient.smembers(key);
		} catch (error) {
			this.logger.error(`获取集合成员失败 [${key}]: ${error.message}`);
			throw error;
		}
	}

	/**
	 * 检查成员是否在集合中
	 * @param key 键
	 * @param member 成员
	 */
	async sismember(key: string, member: string): Promise<number> {
		try {
			return await this.redisClient.sismember(key, member);
		} catch (error) {
			this.logger.error(`检查集合成员失败 [${key}]: ${error.message}`);
			throw error;
		}
	}

	/**
	 * 删除集合成员
	 * @param key 键
	 * @param members 成员数组
	 */
	async srem(key: string, ...members: string[]): Promise<number> {
		try {
			return await this.redisClient.srem(key, ...members);
		} catch (error) {
			this.logger.error(`删除集合成员失败 [${key}]: ${error.message}`);
			throw error;
		}
	}
}
