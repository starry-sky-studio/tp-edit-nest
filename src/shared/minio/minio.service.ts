import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Client as MinioClient } from 'minio';

/**
 * MinIO 上传结果：包含桶名、对象键、ETag 等信息
 */
export interface PutObjectResult {
	bucket: string;
	key: string;
	etag: string;
	size?: number;
	url?: string;
}

/**
 * MinIO 客户端封装，负责：
 * 1. 初始化连接、自动创建桶
 * 2. 提供上传、获取临时访问 URL、删除等能力
 */
@Injectable()
export class MinioService implements OnModuleInit {
	private readonly logger = new Logger(MinioService.name);
	private client!: MinioClient;
	private defaultBucket!: string;
	private isPublicBucket = true;
	private endPoint!: string;
	private port!: number;
	private useSSL!: boolean;

	/**
	 * 模块初始化时创建 MinIO 客户端
	 */
	onModuleInit() {
		const endPoint = process.env.MINIO_ENDPOINT || 'localhost';
		const port = parseInt(process.env.MINIO_PORT || '9000', 10);
		const useSSL = (process.env.MINIO_USE_SSL || 'false') === 'true';
		const accessKey =
			process.env.MINIO_ROOT_USER ||
			process.env.MINIO_ACCESS_KEY ||
			'minioadmin';
		const secretKey =
			process.env.MINIO_ROOT_PASSWORD ||
			process.env.MINIO_SECRET_KEY ||
			'minioadmin';
		const defaultBucket = process.env.MINIO_BUCKET || 'uploads';

		this.client = new MinioClient({
			endPoint,
			port,
			useSSL,
			accessKey,
			secretKey,
		});
		this.endPoint = endPoint;
		this.port = port;
		this.useSSL = useSSL;
		this.defaultBucket = defaultBucket;

		// 应用启动时，确保默认桶存在
		this.ensureBucket(this.defaultBucket).catch((err) => {
			this.logger.error(`ensureBucket failed: ${err.message}`, err.stack);
		});
	}

	/**
	 * 确保桶存在，不存在则自动创建
	 */
	private async ensureBucket(bucket: string) {
		const exists = await this.client.bucketExists(bucket).catch(() => false);
		if (!exists) {
			await this.client.makeBucket(bucket, '');
			this.logger.log(`Created bucket: ${bucket}`);
		}

		if (this.isPublicBucket) {
			await this.setBucketPublicRead(bucket);
		}
	}

	/**
	 * 将桶设置为公共只读策略
	 */
	private async setBucketPublicRead(bucket: string) {
		const policy = {
			Version: '2012-10-17',
			Statement: [
				{
					Effect: 'Allow',
					Principal: { AWS: ['*'] },
					Action: ['s3:GetObject'],
					Resource: [`arn:aws:s3:::${bucket}/*`],
				},
			],
		};

		try {
			await this.client.setBucketPolicy(bucket, JSON.stringify(policy));
			this.logger.log(`Bucket ${bucket} 已设置为公共读取`);
		} catch (error) {
			this.logger.error(`设置公共访问策略失败: ${(error as Error).message}`);
		}
	}

	/**
	 * 获取默认桶名称
	 */
	getBucket(): string {
		return this.defaultBucket;
	}

	/**
	 * 判断桶是否存在
	 */
	async bucketExists(bucket?: string): Promise<boolean> {
		const targetBucket = bucket || this.defaultBucket;
		try {
			return await this.client.bucketExists(targetBucket);
		} catch (error) {
			this.logger.error(
				`检测桶 ${targetBucket} 是否存在失败: ${(error as Error).message}`,
			);
			throw error;
		}
	}

	/**
	 * 判断对象是否存在
	 */
	async objectExists(params: {
		bucket?: string;
		key: string;
	}): Promise<boolean> {
		const bucket = params.bucket || this.defaultBucket;
		try {
			await this.client.statObject(bucket, params.key);
			return true;
		} catch (error: any) {
			if (error?.code === 'NotFound' || error?.statusCode === 404) {
				return false;
			}
			this.logger.error(
				`检测对象 ${bucket}/${params.key} 是否存在失败: ${(error as Error).message}`,
			);
			throw error;
		}
	}

	/**
	 * 上传文件到 MinIO
	 */
	async putObject(params: {
		bucket?: string; // 指定上传目标桶，未传则使用默认桶
		key: string; // 对象在桶中的完整路径（含文件名）
		data: Buffer | NodeJS.ReadableStream | string; // 要上传的文件数据，可以是 Buffer/流/字符串
		size?: number; // 数据长度（仅当 data 为流时需要）
		contentType?: string; // 文件类型，用于设置 Content-Type
		metaData?: Record<string, string>; // 附加元数据，将随对象一同保存
	}): Promise<PutObjectResult> {
		const bucket = params.bucket || this.defaultBucket; // 如果没有指定桶，就使用默认桶
		await this.ensureBucket(bucket); // 确保目标桶存在，不存在会先创建
		const result = await this.client.putObject(
			bucket, // 目标桶名称
			params.key, // 对象的唯一键值
			params.data as any, // 上传的数据，MinIO SDK 接口允许多种类型
			params.size, // 数据大小（当数据是流时用于告知长度）
			{
				'Content-Type': params.contentType || 'application/octet-stream', // 设置文件的 MIME 类型，默认二进制流
				...params.metaData, // 合并自定义元数据
			},
		);
		const etag = typeof result === 'string' ? result : result.etag; // MinIO 可能返回 ETag 字符串或对象，这里统一为字符串
		return { bucket, key: params.key, etag, size: params.size }; // 返回上传结果，便于上层记录
	}

	/**
	 * 获取文件的临时访问地址（预签名 URL）
	 */
	async getPresignedUrl(params: {
		bucket?: string;
		key: string;
		expirySeconds?: number;
		reqParams?: Record<string, string>;
	}): Promise<string> {
		const bucket = params.bucket || this.defaultBucket;
		if (params.expirySeconds === undefined && this.isPublicBucket) {
			const protocol = this.useSSL ? 'https' : 'http';
			const portSegment =
				(!this.useSSL && this.port === 80) || (this.useSSL && this.port === 443)
					? ''
					: `:${this.port}`;
			const encodedKey = params.key
				.split('/')
				.map((segment) => encodeURIComponent(segment))
				.join('/');
			return `${protocol}://${this.endPoint}${portSegment}/${bucket}/${encodedKey}`;
		}

		const expiry = params.expirySeconds ?? 60 * 60; // 默认 1 小时
		return await this.client.presignedGetObject(
			bucket,
			params.key,
			expiry,
			params.reqParams,
		);
	}

	/**
	 * 删除指定对象
	 */
	async removeObject(params: { bucket?: string; key: string }): Promise<void> {
		const bucket = params.bucket || this.defaultBucket;
		await this.client.removeObject(bucket, params.key);
	}
}
