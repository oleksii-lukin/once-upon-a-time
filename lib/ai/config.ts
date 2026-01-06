import { createOpenAI } from '@ai-sdk/openai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI as createCustomOpenAI } from '@ai-sdk/openai'

export interface AIProvider {
  name: string
  type: 'lm-studio' | 'openai' | 'gemini' | 'anthropic'
  apiKey?: string
  baseURL?: string
  model: string
  maxTokens?: number
  temperature?: number
}

export interface AIConfig {
  enabled: boolean
  defaultProvider: AIProvider
  providers: AIProvider[]
  streamResponses: boolean
}

export const defaultAIConfig: AIConfig = {
  enabled: true,
  defaultProvider: {
    name: 'LM Studio',
    type: 'lm-studio',
    baseURL: 'http://localhost:1234/v1',
    model: 'auto',
    maxTokens: 1000,
    temperature: 0.7,
  },
  providers: [
    {
      name: 'LM Studio',
      type: 'lm-studio',
      baseURL: 'http://localhost:1234/v1',
      model: 'auto',
      maxTokens: 1000,
      temperature: 0.7,
    },
    {
      name: 'OpenAI',
      type: 'openai',
      model: 'gpt-4o-mini',
      maxTokens: 1000,
      temperature: 0.7,
    },
    {
      name: 'Gemini',
      type: 'gemini',
      model: 'gemini-1.5-flash',
      maxTokens: 1000,
      temperature: 0.7,
    },
    {
      name: 'Claude',
      type: 'anthropic',
      model: 'claude-3-5-haiku-20241022',
      maxTokens: 1000,
      temperature: 0.7,
    },
  ],
  streamResponses: true,
}

export function createAIModel(provider: AIProvider) {
  switch (provider.type) {
    case 'lm-studio':
      return createCustomOpenAI({
        apiKey: provider.apiKey || 'lm-studio',
        baseURL: provider.baseURL || 'http://localhost:1234/v1',
      })(provider.model)

    case 'openai':
      return createOpenAI({
        apiKey: provider.apiKey || process.env.OPENAI_API_KEY,
        baseURL: provider.baseURL,
      })(provider.model)

    case 'gemini':
      return createGoogleGenerativeAI({
        apiKey: provider.apiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      })(provider.model)

    case 'anthropic':
      return createAnthropic({
        apiKey: provider.apiKey || process.env.ANTHROPIC_API_KEY,
      })(provider.model)

    default:
      throw new Error(`Unsupported AI provider: ${provider.type}`)
  }
}

export function getAIConfig(): AIConfig {
  // In a real implementation, this would load from a database or environment variables
  // For now, return the default config
  return defaultAIConfig
}

export function updateAIConfig(config: Partial<AIConfig>): AIConfig {
  // In a real implementation, this would save to a database
  // For now, just return the merged config
  const currentConfig = getAIConfig()
  return { ...currentConfig, ...config }
}
