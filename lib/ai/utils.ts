import { generateText, streamText } from 'ai'
import { createAIModel, getRuntimeAIConfig, AIProvider } from './config'

export interface AIResponse {
  text: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

export interface AIStreamResponse {
  textStream: ReadableStream<string>
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

export async function generateAIResponse(
  prompt: string,
  provider?: AIProvider,
): Promise<AIResponse> {
  const config = await getRuntimeAIConfig()

  if (!config.enabled) {
    throw new Error('AI features are disabled')
  }

  const selectedProvider = provider || config.defaultProvider
  const model = createAIModel(selectedProvider)

  try {
    const result = await generateText({
      model,
      prompt,
      maxRetries: 3,
    })

    return {
      text: result.text,
      usage: undefined, // TODO: Implement usage tracking when API supports it
    }
  }
  catch (error) {
    console.error('AI generation error:', error)
    throw new Error(
      `Failed to generate AI response: ${error instanceof Error ? error.message : 'Unknown error'}`,
    )
  }
}

export async function streamAIResponse(
  prompt: string,
  provider?: AIProvider,
): Promise<AIStreamResponse> {
  const config = await getRuntimeAIConfig()

  if (!config.enabled) {
    throw new Error('AI features are disabled')
  }

  const selectedProvider = provider || config.defaultProvider
  const model = createAIModel(selectedProvider)

  try {
    const result = await streamText({
      model,
      prompt,
      maxRetries: 3,
    })

    return {
      textStream: result.textStream,
      usage: undefined, // TODO: Implement usage tracking when API supports it
    }
  }
  catch (error) {
    console.error('AI streaming error:', error)
    throw new Error(
      `Failed to stream AI response: ${error instanceof Error ? error.message : 'Unknown error'}`,
    )
  }
}

export async function testAIConnection(
  provider: AIProvider,
): Promise<{ success: boolean, error?: string }> {
  try {
    const model = createAIModel(provider)

    // Test with a simple prompt
    await generateText({
      model,
      prompt: 'Hello, respond with just "OK" to test the connection.',
      maxRetries: 1,
    })

    return { success: true }
  }
  catch (error) {
    console.error('AI connection test failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

export function getAvailableModels(providerType: string): string[] {
  switch (providerType) {
    case 'lm-studio':
      return [
        'auto',
        'llama-3.2-3b',
        'llama-3.2-8b',
        'llama-3.1-70b',
        'qwen-2.5-7b',
        'custom',
      ]

    case 'openai':
      return ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo']

    case 'gemini':
      return ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-1.0-pro']

    case 'anthropic':
      return [
        'claude-3-5-haiku-20241022',
        'claude-3-5-sonnet-20241022',
        'claude-3-opus-20240229',
      ]

    case 'groq':
      return [
        'llama-3.3-70b-versatile',
        'llama-3.1-70b-versatile',
        'llama-3.2-3b-preview',
        'mixtral-8x7b-32768',
      ]

    case 'together':
      return [
        'meta-llama/Llama-3.3-70B-Instruct-Turbo',
        'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
        'mistralai/Mixtral-8x7B-Instruct-v0.1',
        'Qwen/Qwen2.5-72B-Instruct-Turbo',
      ]

    default:
      return []
  }
}
