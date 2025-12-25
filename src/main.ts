import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as dotenv from 'dotenv';
import { AppModule } from './app.module';

dotenv.config(); // 启动时加载根目录 .env，确保 process.env.xxx 可用

async function bootstrap() {
	const app = await NestFactory.create(AppModule);

	// 允许所有来源的跨域请求（含凭证）
	app.enableCors({
		origin: true,
		credentials: true,
	});

	// 设置全局 API 前缀
	app.setGlobalPrefix('api');

	// 启用全局验证管道
	app.useGlobalPipes(
		new ValidationPipe({
			whitelist: true, // 自动移除未定义的属性
			forbidNonWhitelisted: true, // 禁止未定义的属性
			transform: true, // 自动转换类型
			transformOptions: {
				enableImplicitConversion: true, // 启用隐式类型转换
			},
		}),
	);

	const config = new DocumentBuilder()
		.setTitle('Cats example')
		.setDescription('The cats API description')
		.setVersion('1.0')
		.addTag('cats')
		.build();
	const documentFactory = () => SwaggerModule.createDocument(app, config);
	SwaggerModule.setup('api', app, documentFactory);

	await app.listen(3005);
}
bootstrap();
