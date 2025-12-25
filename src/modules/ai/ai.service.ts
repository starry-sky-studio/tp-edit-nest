import { createDeepSeek } from '@ai-sdk/deepseek'; // 用于创建 DeepSeek 提供器实例的方法
import { createGoogleGenerativeAI } from '@ai-sdk/google'; // 用于创建 Google Gemini 提供器实例的方法
import { createOpenAI } from '@ai-sdk/openai'; // 用于创建 OpenAI 提供器实例的方法
import {
	BadRequestException, // 当请求参数不合法时抛出的异常
	Injectable, // NestJS 装饰器，标记该类可被注入
	InternalServerErrorException, // 服务器内部错误时抛出的异常
} from '@nestjs/common';
import { generateText, streamText } from 'ai'; // 来自 ai SDK 的文本生成方法
import { Observable } from 'rxjs'; // RxJS Observable，用于流式响应
import type { GenerateTextDto } from './dto/generate-text.dto'; // 请求 DTO 类型定义
import { getModelsByProvider, ModelDisplayNames } from './models.enum';

type ProviderId = 'openai' | 'deepseek' | 'gemini'; // 支持 openai、deepseek 和 gemini 三种提供方

interface ProviderEntry {
	id: ProviderId; // 提供方 ID（用来索引）
	label: string; // 展示给前端看的名称
	create: () =>
		| ReturnType<typeof createOpenAI>
		| ReturnType<typeof createDeepSeek>
		| ReturnType<typeof createGoogleGenerativeAI>; // 创建具体 SDK 实例的工厂函数
}

@Injectable() // 让 NestJS 知道这个服务可以被依赖注入
export class AiService {
	private readonly providers: Record<ProviderId, ProviderEntry>; // 存储所有可用提供方配置

	constructor() {
		this.providers = {
			openai: {
				id: 'openai', // 唯一标识
				label: 'OpenAI', // 展示名称
				create: () => {
					const apiKey = process.env.OPENAI_API_KEY; // 从环境变量读取 OpenAI Key

					if (!apiKey) {
						// 如果没配置，直接抛出 500 错误提醒
						throw new InternalServerErrorException(
							'环境变量 OPENAI_API_KEY 未配置，无法调用 OpenAI 模型',
						);
					}
					return createOpenAI({
						apiKey, // 将 key 传入 SDK
					});
				},
			},
			deepseek: {
				id: 'deepseek', // 唯一标识
				label: 'DeepSeek', // 展示名称（DeepSeek 提供免费额度，性价比高）
				create: () => {
					const apiKey = process.env.DEEPSEEK_API_KEY; // 从环境变量读取 DeepSeek Key

					if (!apiKey) {
						// 如果没配置，直接抛出 500 错误提醒
						throw new InternalServerErrorException(
							'环境变量 DEEPSEEK_API_KEY 未配置，无法调用 DeepSeek 模型。请访问 https://platform.deepseek.com/ 获取 API Key',
						);
					}
					return createDeepSeek({
						apiKey, // 将 key 传入 SDK
					});
				},
			},
			gemini: {
				id: 'gemini', // 唯一标识
				label: 'Google Gemini', // 展示名称（Google 的 Gemini 模型，提供免费额度）
				create: () => {
					const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY; // 从环境变量读取 Google API Key

					if (!apiKey) {
						// 如果没配置，直接抛出 500 错误提醒
						throw new InternalServerErrorException(
							'环境变量 GOOGLE_GENERATIVE_AI_API_KEY 未配置，无法调用 Gemini 模型。请访问 https://aistudio.google.com/app/apikey 获取 API Key',
						);
					}
					return createGoogleGenerativeAI({
						apiKey, // 将 key 传入 SDK
					});
				},
			},
		};
	}

	getAvailableProviders() {
		// 返回一个列表，供前端展示有哪些模型提供方
		return Object.values(this.providers).map((provider) => ({
			id: provider.id,
			label: provider.label,
		}));
	}

	/**
	 * 获取指定提供方的所有可用模型
	 */
	getAvailableModels(provider: ProviderId) {
		const models = getModelsByProvider(provider);
		return models.map((model) => ({
			id: model,
			label:
				ModelDisplayNames[model as keyof typeof ModelDisplayNames] || model,
		}));
	}

	/**
	 * 验证模型是否属于指定的提供方
	 */
	private validateModel(provider: ProviderId, model: string): boolean {
		const validModels = getModelsByProvider(provider);
		return validModels.includes(model);
	}

	/**
	 * 验证和规范化请求参数
	 */
	private validateAndNormalizeParams(payload: GenerateTextDto): {
		providerId: ProviderId;
		model: string;
		prompt: string;
		system?: string;
		temperature?: number;
		maxTokens?: number;
	} {
		// 验证提供方
		const providerId = payload.provider as ProviderId;
		const providerEntry = this.providers[providerId];
		if (!providerEntry) {
			throw new BadRequestException(`不支持的模型提供方: ${payload.provider}`);
		}

		// 验证模型名称
		if (!payload.model || !payload.model.trim()) {
			throw new BadRequestException('模型名称不能为空');
		}

		// 验证模型是否属于指定的提供方
		if (!this.validateModel(providerId, payload.model)) {
			const availableModels = getModelsByProvider(providerId);
			throw new BadRequestException(
				`模型 "${payload.model}" 不属于提供方 "${providerId}"。` +
					`可用模型: ${availableModels.join(', ')}`,
			);
		}

		// 验证 prompt 和 system 至少有一个
		if (
			(!payload.prompt || !payload.prompt.trim()) &&
			(!payload.system || !payload.system.trim())
		) {
			throw new BadRequestException('prompt 和 system 至少需要提供一个');
		}

		// 规范化 maxTokens：确保是整数
		let maxTokens: number | undefined;
		if (payload.maxTokens !== undefined && payload.maxTokens !== null) {
			// 转换为整数，防止传入浮点数
			const tokenValue = Number(payload.maxTokens);
			if (isNaN(tokenValue) || !isFinite(tokenValue)) {
				throw new BadRequestException('maxTokens 必须是有效的数字');
			}
			maxTokens = Math.floor(Math.abs(tokenValue)); // 取绝对值并向下取整
			if (maxTokens < 1) {
				throw new BadRequestException('maxTokens 必须大于 0');
			}
			if (maxTokens > 1000000) {
				throw new BadRequestException('maxTokens 不能超过 1000000');
			}
		}

		// 规范化 temperature：确保在有效范围内
		let temperature: number | undefined;
		if (payload.temperature !== undefined && payload.temperature !== null) {
			const tempValue = Number(payload.temperature);
			if (isNaN(tempValue) || !isFinite(tempValue)) {
				throw new BadRequestException('temperature 必须是有效的数字');
			}
			temperature = Math.max(0, Math.min(2, tempValue)); // 限制在 0-2 之间
		}

		return {
			providerId,
			model: payload.model.trim(),
			prompt: payload.prompt?.trim() || '',
			system: payload.system?.trim(),
			temperature,
			maxTokens,
		};
	}

	async generateText(payload: GenerateTextDto): Promise<{
		provider: ProviderId;
		model: string;
		text: string;
		finishReason: string | undefined;
		usage: any;
	}> {
		// 验证和规范化参数
		const { providerId, model, prompt, system, temperature, maxTokens } =
			this.validateAndNormalizeParams(payload);

		const providerEntry = this.providers[providerId];
		const provider = providerEntry.create();

		try {
			// 构建请求参数，只包含有值的参数
			const requestParams: any = {
				model: provider(model),
				prompt,
			};

			if (system) {
				requestParams.system = system;
			}

			if (temperature !== undefined) {
				requestParams.temperature = temperature;
			}

			if (maxTokens !== undefined) {
				requestParams.maxOutputTokens = maxTokens; // 确保是整数
			}

			const result = await generateText(requestParams);

			return {
				provider: providerId,
				model,
				text: result.text,
				finishReason: result.finishReason,
				usage: result.usage,
			};
		} catch (error: any) {
			// 捕获 API 调用错误，提供更友好的错误提示
			console.error('AI API 调用错误:', error);

			// 处理参数错误（400）
			if (
				error?.parameter ||
				error?.message?.includes('Invalid argument') ||
				error?.message?.includes('must be')
			) {
				throw new BadRequestException(
					`参数错误: ${error?.message || error?.toString() || '未知参数错误'}`,
				);
			}

			// 处理余额不足错误（402）
			if (
				error?.status === 402 ||
				error?.statusCode === 402 ||
				error?.message?.includes('Insufficient Balance') ||
				error?.message?.includes('余额不足')
			) {
				throw new BadRequestException(
					`账户余额不足。请访问 https://platform.deepseek.com/ 检查账户余额并充值。` +
						`\n提示：新注册账户可能需要先完成账户验证或激活免费额度。`,
				);
			}

			// 处理配额超限/速率限制错误（429）
			if (
				error?.status === 429 ||
				error?.statusCode === 429 ||
				error?.data?.error?.status === 'RESOURCE_EXHAUSTED' ||
				error?.message?.includes('quota') ||
				error?.message?.includes('rate limit') ||
				error?.message?.includes('Rate limit') ||
				error?.message?.includes('exceeded your current quota')
			) {
				const errorMessage =
					error?.data?.error?.message || error?.message || '';
				const retryDelayMatch = errorMessage.match(
					/Please retry in ([\d.]+)s/i,
				);
				const retryDelay = retryDelayMatch
					? Math.ceil(parseFloat(retryDelayMatch[1]))
					: null;

				let message = `API 配额已用完或达到速率限制。`;

				if (providerId === 'gemini') {
					message += `\n\nGoogle Gemini 免费层配额已用完。`;
					if (errorMessage.includes('gemini-3-pro')) {
						message += `\n注意：gemini-3-pro 是预览模型，免费层配额有限。`;
					}
					message += `\n\n解决方案：`;
					message += `\n1. 等待配额重置（通常每天重置）`;
					message += `\n2. 查看配额使用情况：https://ai.dev/usage?tab=rate-limit`;
					message += `\n3. 了解配额限制：https://ai.google.dev/gemini-api/docs/rate-limits`;
					if (retryDelay) {
						message += `\n4. 建议等待 ${retryDelay} 秒后重试`;
					}
				} else if (providerId === 'deepseek') {
					message += `\n\n请访问 https://platform.deepseek.com/ 检查账户配额和速率限制。`;
					if (retryDelay) {
						message += `\n建议等待 ${retryDelay} 秒后重试`;
					}
				} else {
					message += `\n\n请检查账户配额和速率限制设置。`;
					if (retryDelay) {
						message += `\n建议等待 ${retryDelay} 秒后重试`;
					}
				}

				throw new BadRequestException(message);
			}

			// 处理权限错误（403）- 特别是 API key 泄露的情况
			if (
				error?.status === 403 ||
				error?.statusCode === 403 ||
				error?.data?.error?.status === 'PERMISSION_DENIED' ||
				error?.message?.includes('leaked') ||
				error?.message?.includes('reported as leaked')
			) {
				const envVarName =
					providerId === 'deepseek'
						? 'DEEPSEEK_API_KEY'
						: providerId === 'gemini'
							? 'GOOGLE_GENERATIVE_AI_API_KEY'
							: 'OPENAI_API_KEY';

				const errorMessage =
					error?.data?.error?.message || error?.message || '';
				if (errorMessage.includes('leaked')) {
					throw new BadRequestException(
						`API Key 已被标记为泄露。请立即更换新的 API Key。\n` +
							`环境变量: ${envVarName}\n` +
							`Google Gemini: 请访问 https://aistudio.google.com/app/apikey 生成新的 API Key`,
					);
				}
				throw new BadRequestException(
					`API Key 权限被拒绝（403）。请检查环境变量 ${envVarName} 是否有足够的权限。`,
				);
			}

			// 处理认证错误（401）
			if (
				error?.status === 401 ||
				error?.statusCode === 401 ||
				error?.message?.includes('Unauthorized') ||
				error?.message?.includes('Invalid') ||
				error?.message?.includes('API key')
			) {
				const envVarName =
					providerId === 'deepseek'
						? 'DEEPSEEK_API_KEY'
						: providerId === 'gemini'
							? 'GOOGLE_GENERATIVE_AI_API_KEY'
							: 'OPENAI_API_KEY';
				throw new BadRequestException(
					`API Key 认证失败。请检查环境变量 ${envVarName} 是否正确配置。`,
				);
			}

			// 处理其他错误
			throw new InternalServerErrorException(
				`调用 ${providerEntry.label} 模型失败: ${error?.message || error?.toString() || '未知错误'}`,
			);
		}
	}

	/**
	 * 流式生成文本（使用 SSE）
	 * 使用 RxJS Observable，符合 NestJS 最佳实践
	 * @param payload 生成参数
	 * @returns Observable<{ data: string }> 用于 SSE 流式响应
	 */
	generateTextStream(payload: GenerateTextDto): Observable<{ data: string }> {
		// 验证和规范化参数
		const { providerId, model, prompt, system, temperature, maxTokens } =
			this.validateAndNormalizeParams(payload);

		const providerEntry = this.providers[providerId];
		const provider = providerEntry.create();

		// 返回 Observable，符合 NestJS 最佳实践
		return new Observable((subscriber) => {
			// 使用立即执行的异步函数来启动流式生成
			(async () => {
				try {
					// 构建请求参数
					const requestParams: any = {
						model: provider(model),
						prompt,
					};

					if (system) {
						requestParams.system = system;
					}

					if (temperature !== undefined) {
						requestParams.temperature = temperature;
					}

					if (maxTokens !== undefined) {
						requestParams.maxTokens = maxTokens;
					}

					// 使用 streamText 生成流式响应
					const result = await streamText(requestParams);

					// 遍历 textStream，发送每个数据块
					for await (const chunk of result.textStream) {
						// 检查订阅是否已取消
						if (subscriber.closed) {
							console.log('订阅已取消，停止发送数据');
							break;
						}

						// 发送数据（Controller 层会格式化为 SSE 格式）
						subscriber.next({
							data: JSON.stringify({ content: chunk }),
						});
					}

					// 发送结束标记
					if (!subscriber.closed) {
						subscriber.next({ data: '[DONE]' });
						subscriber.complete();
					}
				} catch (error: any) {
					// 错误处理
					if (!subscriber.closed) {
						const errorMessage = error?.message || '流式生成失败';
						console.error('流式生成错误:', errorMessage);
						subscriber.next({
							data: JSON.stringify({ error: errorMessage }),
						});
						subscriber.error(error);
					}
				}
			})().catch((error) => {
				// 捕获异步函数本身的错误
				if (!subscriber.closed) {
					console.error('Observable 异步函数错误:', error);
					subscriber.error(error);
				}
			});
		});
	}
}
