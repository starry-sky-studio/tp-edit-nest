import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { FilesModule } from './modules/files/files.module';
import { RedisModule } from './shared/redis/redis.module';
import { MinioModule } from './shared/minio/minio.module';

@Module({
  imports: [AuthModule, FilesModule, RedisModule, MinioModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
