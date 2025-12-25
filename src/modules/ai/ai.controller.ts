import {
	BadRequestException,
	Body,
	Controller,
	Get,
	Post,
	Query,
	Res,
} from '@nestjs/common';
import {
	ApiBody,
	ApiOperation,
	ApiQuery,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { AiService } from './ai.service';
import { GenerateTextDto } from './dto/generate-text.dto';

@ApiTags('AI')
@Controller('ai')
export class AiController {
	constructor(private readonly aiService: AiService) {}

	@Get('providers')
	@ApiOperation({ summary: '获取可用的大模型提供方' })
	@ApiResponse({
		status: 200,
		description: '返回可用的大模型提供方列表',
		schema: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					id: {
						type: 'string',
						example: 'openai',
						description: '提供方 ID',
					},
					label: {
						type: 'string',
						example: 'OpenAI',
						description: '提供方名称',
					},
				},
			},
		},
	})
	getProviders() {
		return this.aiService.getAvailableProviders();
	}

	@Get('models')
	@ApiOperation({ summary: '获取指定提供方的所有可用模型' })
	@ApiQuery({
		name: 'provider',
		required: true,
		enum: ['openai', 'deepseek', 'gemini'],
		description: '模型提供方',
		example: 'gemini',
	})
	@ApiResponse({
		status: 200,
		description: '返回指定提供方的所有可用模型列表',
		schema: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					id: {
						type: 'string',
						example: 'gemini-1.5-pro',
						description: '模型 ID',
					},
					label: {
						type: 'string',
						example: 'Gemini 1.5 Pro',
						description: '模型显示名称',
					},
				},
			},
		},
	})
	@ApiResponse({
		status: 400,
		description: '提供方参数错误',
		schema: {
			type: 'object',
			properties: {
				statusCode: { type: 'number', example: 400 },
				message: {
					type: 'string',
					example: '不支持的模型提供方: invalid',
				},
				error: { type: 'string', example: 'Bad Request' },
			},
		},
	})
	getModels(@Query('provider') provider: 'openai' | 'deepseek' | 'gemini') {
		if (!provider || !['openai', 'deepseek', 'gemini'].includes(provider)) {
			throw new BadRequestException('不支持的模型提供方');
		}
		return this.aiService.getAvailableModels(provider);
	}

	@Post('generate')
	@ApiOperation({ summary: '调用指定大模型生成文本' })
	@ApiBody({
		type: GenerateTextDto,
		description: '生成文本的请求参数',
		examples: {
			openai: {
				summary: '使用 OpenAI 生成文本',
				value: {
					provider: 'openai',
					model: 'gpt-4o',
					prompt: '请介绍一下人工智能的发展历史',
					system: '你是一个专业的技术顾问',
					temperature: 0.7,
					maxTokens: 1000,
				},
			},
			deepseek: {
				summary: '使用 DeepSeek 生成文本',
				value: {
					provider: 'deepseek',
					model: 'deepseek-chat',
					prompt: '请用简洁的语言解释量子计算',
					temperature: 0.8,
					maxTokens: 500,
				},
			},
			gemini: {
				summary: '使用 Google Gemini 生成文本',
				value: {
					provider: 'gemini',
					model: 'gemini-3-pro',
					prompt: '写一首关于春天的诗',
					temperature: 0.9,
					maxTokens: 200,
				},
			},
		},
	})
	@ApiResponse({
		status: 200,
		description: '成功生成文本',
		schema: {
			type: 'object',
			properties: {
				provider: {
					type: 'string',
					example: 'openai',
					description: '使用的模型提供方',
				},
				model: {
					type: 'string',
					example: 'gpt-4o',
					description: '使用的模型名称',
				},
				text: {
					type: 'string',
					example: '人工智能（AI）的发展历史可以追溯到...',
					description: '模型生成的文本内容',
				},
				finishReason: {
					type: 'string',
					example: 'stop',
					description: '模型停止生成的原因',
				},
				usage: {
					type: 'object',
					description: 'Token 使用情况',
					properties: {
						promptTokens: {
							type: 'number',
							example: 50,
						},
						completionTokens: {
							type: 'number',
							example: 200,
						},
						totalTokens: {
							type: 'number',
							example: 250,
						},
					},
				},
			},
		},
	})
	@ApiResponse({
		status: 400,
		description: '请求参数错误',
		schema: {
			type: 'object',
			properties: {
				statusCode: { type: 'number', example: 400 },
				message: { type: 'string', example: '不支持的模型提供方: invalid' },
				error: { type: 'string', example: 'Bad Request' },
			},
		},
	})
	@ApiResponse({
		status: 500,
		description: '服务器内部错误或 API Key 未配置',
		schema: {
			type: 'object',
			properties: {
				statusCode: { type: 'number', example: 500 },
				message: {
					type: 'string',
					example: '环境变量 OPENAI_API_KEY 未配置，无法调用 OpenAI 模型',
				},
				error: { type: 'string', example: 'Internal Server Error' },
			},
		},
	})
	async generate(
		@Body() body: GenerateTextDto,
		@Res() res: Response,
	): Promise<any> {
		// 如果 stream 为 true，返回流式响应（SSE）
		if (body.stream) {
			// 设置 SSE 响应头（必须在开始发送数据之前设置）
			res.setHeader('Content-Type', 'text/event-stream');
			res.setHeader('Cache-Control', 'no-cache');
			res.setHeader('Connection', 'keep-alive');
			res.setHeader('X-Accel-Buffering', 'no'); // 禁用 Nginx 缓冲
			res.setHeader('Access-Control-Allow-Origin', '*'); // CORS 支持

			// 立即发送响应头，确保连接建立
			res.flushHeaders();

			// 立即发送一个初始消息，保持连接活跃
			res.write(': keep-alive\n\n');

			// 获取 Observable 并订阅
			const observable = this.aiService.generateTextStream(body);

			// 订阅 Observable，将数据写入响应
			const subscription = observable.subscribe({
				next: (event) => {
					try {
						// 检查响应状态
						if (res.destroyed || res.closed || res.writableEnded) {
							console.log('响应已关闭，取消订阅');
							subscription.unsubscribe();
							return;
						}

						// 写入数据，格式：data: {data}\n\n
						res.write(`data: ${event.data}\n\n`);
					} catch (error) {
						console.error('写入响应数据错误:', error);
						subscription.unsubscribe();
						if (!res.destroyed && !res.closed) {
							res.end();
						}
					}
				},
				error: (error) => {
					console.error('流式响应错误:', error);
					try {
						if (!res.destroyed && !res.closed && !res.writableEnded) {
							if (!res.headersSent) {
								res.status(500).json({
									error: '流式生成失败',
									message:
										error instanceof Error ? error.message : String(error),
								});
							} else {
								const errorData = JSON.stringify({
									error: error instanceof Error ? error.message : String(error),
								});
								res.write(`data: ${errorData}\n\n`);
								res.end();
							}
						}
					} catch (err) {
						console.error('结束响应错误:', err);
					}
				},
				complete: () => {
					try {
						if (!res.destroyed && !res.closed && !res.writableEnded) {
							res.end();
						}
					} catch (error) {
						console.error('完成响应错误:', error);
					}
				},
			});

			// 处理客户端断开连接
			res.on('close', () => {
				console.log('客户端断开连接，取消订阅');
				if (!subscription.closed) {
					subscription.unsubscribe();
				}
			});

			res.on('error', (error) => {
				console.error('响应流错误:', error);
				if (!subscription.closed) {
					subscription.unsubscribe();
				}
			});

			// 使用 @Res() 时，不能返回任何值
			return;
		}

		// 非流式响应，手动返回 JSON
		const result = await this.aiService.generateText(body);
		res.json(result);
		return;
	}
}
