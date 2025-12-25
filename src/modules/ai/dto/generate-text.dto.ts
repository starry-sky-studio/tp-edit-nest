import { ApiProperty } from '@nestjs/swagger';
import {
	IsString,
	IsNotEmpty,
	IsOptional,
	IsNumber,
	IsIn,
	Min,
	Max,
	IsInt,
} from 'class-validator';
import { OpenAIModel, DeepSeekModel, GeminiModel } from '../models.enum';

export class GenerateTextDto {
	@ApiProperty({
		description: '指定使用哪个模型提供方',
		example: 'openai',
		enum: ['openai', 'deepseek', 'gemini'],
	})
	@IsString()
	@IsNotEmpty({ message: '提供方不能为空' })
	@IsIn(['openai', 'deepseek', 'gemini'], {
		message: '提供方必须是 openai、deepseek 或 gemini 之一',
	})
	provider!: 'openai' | 'deepseek' | 'gemini';

	@ApiProperty({
		description: '具体模型名称',
		example: 'gpt-4o',
		enum: [
			...Object.values(OpenAIModel),
			...Object.values(DeepSeekModel),
			...Object.values(GeminiModel),
		],
	})
	@IsString()
	@IsNotEmpty({ message: '模型名称不能为空' })
	model!: string;

	@ApiProperty({
		description: '用户输入的主要内容或问题',
		example: '请介绍一下人工智能的发展历史',
	})
	@IsString()
	@IsNotEmpty({ message: '提示词不能为空' })
	prompt!: string;

	@ApiProperty({
		description: '系统级提示，定义模型身份或风格',
		example: '你是一个专业的技术顾问',
		required: false,
	})
	@IsString()
	@IsOptional()
	system?: string;

	@ApiProperty({
		description: '控制输出随机性（0-2之间，越高越发散）',
		example: 0.7,
		required: false,
		minimum: 0,
		maximum: 2,
	})
	@IsNumber(
		{ maxDecimalPlaces: 2 },
		{ message: 'temperature 必须是数字，最多两位小数' },
	)
	@IsOptional()
	@Min(0, { message: 'temperature 不能小于 0' })
	@Max(2, { message: 'temperature 不能大于 2' })
	temperature?: number;

	@ApiProperty({
		description: '限制模型最多输出多少 token（必须是正整数）',
		example: 1000,
		required: false,
		minimum: 1,
		maximum: 1000000,
	})
	@IsNumber({}, { message: 'maxTokens 必须是数字' })
	@IsOptional()
	@IsInt({ message: 'maxTokens 必须是整数' })
	@Min(1, { message: 'maxTokens 不能小于 1' })
	@Max(1000000, { message: 'maxTokens 不能大于 1000000' })
	maxTokens?: number;

	@ApiProperty({
		description: '是否使用流式响应（Server-Sent Events）',
		example: false,
		required: false,
		default: false,
	})
	@IsOptional()
	stream?: boolean;
}
