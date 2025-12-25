import {
	BadRequestException,
	Injectable,
	NotFoundException,
} from '@nestjs/common'; // Nest 依赖注入装饰器
import { MinioService } from '../../shared/minio/minio.service'; // MinIO 封装服务
import { nanoid } from 'nanoid'; // 用于生成唯一文件名

type UploadedFile = {
	buffer: Buffer; // 文件二进制数据
	size: number; // 文件大小，单位字节
	mimetype: string; // 文件类型（Content-Type）
	originalname: string; // 上传时的原始文件名
};

@Injectable() // 声明这是一个可被注入的服务
export class FilesService {
	constructor(private readonly minio: MinioService) {} // 注入 MinioService，用于实际存储操作

	/**
	 * 上传文件到对象存储
	 * @param file 上传的文件
	 * @param options 额外参数，如目录前缀、指定桶
	 */
	async upload(
		file: UploadedFile | undefined,
		options?: { prefix?: string; bucket?: string; expirySeconds?: number },
	) {
		if (!file) {
			throw new BadRequestException(
				'未接收到上传文件，请确认表单字段名称为 file',
			);
		}

		const bucket = options?.bucket || this.minio.getBucket(); // 决定使用哪个桶存储文件
		const ext = (file.originalname.split('.').pop() || '').toLowerCase(); // 取出文件后缀，兼容无后缀情况
		const key = `${options?.prefix ? options.prefix + '/' : ''}${nanoid()}.${ext || 'bin'}`; // 生成唯一文件路径：前缀 + 随机名 + 后缀

		const res = await this.minio.putObject({
			bucket, // 指定存储桶
			key, // 指定对象键（路径）
			data: file.buffer, // 上传的实际数据
			size: file.size, // 文件大小
			contentType: file.mimetype, // 文件类型
		});
		const url = await this.minio.getPresignedUrl({
			bucket, // 使用同一个桶
			key, // 同一个文件路径
			expirySeconds: options?.expirySeconds, // 未传值且桶公开时返回永久地址
		});
		return { ...res, url }; // 返回上传结果，并附带访问 URL
	}

	/**
	 * 删除存储中的文件
	 */
	async removeObject(key: string, bucket?: string) {
		if (!key) {
			throw new BadRequestException('缺少要删除的文件 Key');
		}

		const decodedKey = decodeURIComponent(key);
		const targetBucket = bucket || this.minio.getBucket();

		const bucketExists = await this.minio.bucketExists(targetBucket);
		if (!bucketExists) {
			throw new NotFoundException(`存储桶 ${targetBucket} 不存在`);
		}

		const objectExists = await this.minio.objectExists({
			bucket: targetBucket,
			key: decodedKey,
		});
		if (!objectExists) {
			throw new NotFoundException(`文件 ${decodedKey} 不存在`);
		}

		await this.minio.removeObject({ bucket: targetBucket, key: decodedKey }); // 调用 MinIO 删除对象
		return { key: decodedKey, bucket: targetBucket, removed: true }; // 返回删除结果
	}
}
