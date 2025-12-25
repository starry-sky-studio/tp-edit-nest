/**
 * AI 模型枚举定义
 * 包含所有支持的模型提供方及其可用模型
 */

/**
 * OpenAI 模型枚举（仅保留最新和常用模型）
 */
export enum OpenAIModel {
	GPT4o = 'gpt-4o', // 最新旗舰模型
	GPT4oMini = 'gpt-4o-mini', // 最新性价比模型
	GPT4 = 'gpt-4', // 经典模型
	GPT35Turbo = 'gpt-3.5-turbo', // 常用模型
}

/**
 * DeepSeek 模型枚举（仅保留最新和常用模型）
 */
export enum DeepSeekModel {
	DeepSeekV2Chat = 'deepseek-v2-chat', // 最新版本
	DeepSeekChat = 'deepseek-chat', // 最常用
	DeepSeekCoder = 'deepseek-coder', // 编程专用
}

/**
 * Google Gemini 模型枚举
 */
export enum GeminiModel {
	/**
	 * Gemini 3 Pro - 最智能的模型
	 * 建立在先进的推理技术基础上，是全球领先的多模态理解模型
	 * 也是我们迄今为止最强大的智能体和氛围编程模型
	 * 能够提供更丰富的视觉效果和更深入的互动体验
	 * 我们打造的最智能的模型，兼具速度和前沿智能，并具备出色的搜索和接地能力。
	 */
	Gemini3Pro = 'gemini-3-flash-preview',

	/**
	 * Gemini 2.5 Pro - 高级思考模型
	 * 我们最先进的思维模型，能够推理代码、数学和 STEM 领域中的复杂问题
	 * 还能使用长上下文分析大型数据集、代码库和文档
	 */
	Gemini25Pro = 'gemini-2.5-pro',

	/**
	 * Gemini 2.5 Flash - 快速且智能
	 * 在性价比方面表现出色的模型，可提供全面的功能
	 * 最适合大规模处理、低延迟、高数据量且需要思考的任务，以及代理应用场景
	 */
	Gemini25Flash = 'gemini-2.5-flash',
}

/**
 * 所有模型的联合类型
 */
export type AIModel = OpenAIModel | DeepSeekModel | GeminiModel;

/**
 * 根据提供方获取对应的模型枚举
 */
export function getModelsByProvider(
	provider: 'openai' | 'deepseek' | 'gemini',
): string[] {
	switch (provider) {
		case 'openai':
			return Object.values(OpenAIModel);
		case 'deepseek':
			return Object.values(DeepSeekModel);
		case 'gemini':
			return Object.values(GeminiModel);
		default:
			return [];
	}
}

/**
 * 获取所有模型的显示名称映射
 */
export const ModelDisplayNames: Record<AIModel, string> = {
	// OpenAI
	[OpenAIModel.GPT4o]: 'GPT-4o',
	[OpenAIModel.GPT4oMini]: 'GPT-4o Mini',
	[OpenAIModel.GPT4]: 'GPT-4',
	[OpenAIModel.GPT35Turbo]: 'GPT-3.5 Turbo',

	// DeepSeek
	[DeepSeekModel.DeepSeekV2Chat]: 'DeepSeek V2 Chat',
	[DeepSeekModel.DeepSeekChat]: 'DeepSeek Chat',
	[DeepSeekModel.DeepSeekCoder]: 'DeepSeek Coder',

	// Gemini
	[GeminiModel.Gemini3Pro]: 'Gemini 3 Pro',
	[GeminiModel.Gemini25Pro]: 'Gemini 2.5 Pro',
	[GeminiModel.Gemini25Flash]: 'Gemini 2.5 Flash',
};
