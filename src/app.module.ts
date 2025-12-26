import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { JwtAuthGuard } from './guards';
import { AiModule } from './modules/ai/ai.module';
import { AuthModule } from './modules/auth/auth.module';
import { FilesModule } from './modules/files/files.module';
import { UserModule } from './modules/user/user.module';
import { MinioModule } from './shared/minio/minio.module';
import { RedisModule } from './shared/redis/redis.module';

@Module({
	imports: [
		AuthModule,
		FilesModule,
		RedisModule,
		MinioModule,
		AiModule,
		UserModule,
	],
	controllers: [AppController],
	providers: [
		AppService,
		{
			provide: APP_GUARD,
			useClass: JwtAuthGuard,
		},
	],
})
export class AppModule {}
