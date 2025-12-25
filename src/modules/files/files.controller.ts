import {
	Controller,
	Post,
	Delete,
	UploadedFile,
	UseInterceptors,
	Query,
	Body,
} from '@nestjs/common';
import { FilesService } from './files.service';
import { FileInterceptor } from '@nestjs/platform-express';
import {
	ApiBody,
	ApiConsumes,
	ApiOperation,
	ApiQuery,
	ApiTags,
} from '@nestjs/swagger';
import type { Express } from 'express';

@ApiTags('文件')
@Controller('files')
export class FilesController {
	constructor(private readonly filesService: FilesService) {}

	@Post('upload')
	@ApiOperation({ summary: '上传文件' })
	@ApiConsumes('multipart/form-data')
	@ApiBody({
		schema: {
			type: 'object',
			properties: {
				file: { type: 'string', format: 'binary' },
				prefix: { type: 'string', example: 'images' },
				bucket: { type: 'string', example: 'uploads' },
			},
			required: ['file'],
		},
	})
	@UseInterceptors(FileInterceptor('file'))
	async upload(
		@UploadedFile() file: Express.Multer.File,
		@Body('prefix') prefix?: string,
		@Body('bucket') bucket?: string,
	) {
		return await this.filesService.upload(file, { prefix, bucket });
	}

	@Delete()
	@ApiOperation({ summary: '删除文件' })
	@ApiQuery({
		name: 'key',
		required: true,
		example: 'images/foo.png',
		description: '完整文件路径（支持已编码或未编码形式）',
	})
	@ApiQuery({
		name: 'bucket',
		required: false,
		example: 'uploads',
		description: '可选指定存储桶，不传则使用默认桶',
	})
	async remove(@Query('key') key: string, @Query('bucket') bucket?: string) {
		return await this.filesService.removeObject(key, bucket);
	}
}
