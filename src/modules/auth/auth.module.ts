import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { UserModule } from '../user/user.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
	imports: [
		UserModule,
		JwtModule.registerAsync({
			useFactory: () => ({
				secret: process.env.JWT_SECRET || 'dev-secret-change-me', // JWT 密钥，优先用环境变量
				signOptions: {
					expiresIn: '7d', // 令牌过期时间，这里设为 7 天
				},
			}),
		}),
	],
	controllers: [AuthController],
	providers: [AuthService],
	exports: [JwtModule],
})
export class AuthModule {}
