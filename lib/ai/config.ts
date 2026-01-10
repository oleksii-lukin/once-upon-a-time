import { createOpenAI } from '@ai-sdk/openai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI as createCustomOpenAI } from '@ai-sdk/openai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { getAISettings } from '@/lib/settings'

export interface AIProvider {
  name: string
  type: 'lm-studio' | 'openai' | 'gemini' | 'anthropic' | 'groq' | 'together'
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
    {
      name: 'Groq',
      type: 'groq',
      baseURL: 'https://api.groq.com/openai/v1',
      model: 'llama-3.3-70b-versatile',
      maxTokens: 1000,
      temperature: 0.7,
    },
    {
      name: 'Together AI',
      type: 'together',
      baseURL: 'https://api.together.xyz/v1',
      model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
      maxTokens: 1000,
      temperature: 0.7,
    },
  ],
  streamResponses: true,
}

export function createAIModel(provider: AIProvider) {
  switch (provider.type) {
    case 'lm-studio':
      return createOpenAICompatible({
        name: 'lm-studio',
        baseURL: provider.baseURL || 'http://localhost:1234/v1',
        apiKey: provider.apiKey || 'lm-studio',
      }).chatModel(provider.model)

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
    case 'groq':
      return createOpenAI({
        apiKey: provider.apiKey || process.env.GROQ_API_KEY,
        baseURL: 'https://api.groq.com/openai/v1',
      })(provider.model)

    case 'together':
      return createOpenAI({
        apiKey: provider.apiKey || process.env.TOGETHER_API_KEY,
        baseURL: 'https://api.together.xyz/v1',
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

export async function getRuntimeAIConfig(): Promise<AIConfig> {
  try {
    const settings = await getAISettings()

    if (!settings || Object.keys(settings).length === 0) {
      return defaultAIConfig
    }

    const defaultProviderType = (settings.ai_default_provider as string) || 'lm-studio'

    const providers: AIProvider[] = [
      {
        name: 'LM Studio',
        type: 'lm-studio',
        baseURL: (settings.lm_studio_url as string) || 'http://localhost:1234/v1',
        model: (settings.lm_studio_model as string) || 'auto',
        apiKey: (settings.lm_studio_api_key as string) || undefined,
      },
      {
        name: 'OpenAI',
        type: 'openai',
        baseURL: (settings.openai_base_url as string) || 'https://api.openai.com/v1',
        model: (settings.openai_model as string) || 'gpt-4o-mini',
        apiKey: (settings.openai_api_key as string) || undefined,
      },
      {
        name: 'Gemini',
        type: 'gemini',
        model: (settings.gemini_model as string) || 'gemini-1.5-flash',
        apiKey: (settings.gemini_api_key as string) || undefined,
      },
      {
        name: 'Claude',
        type: 'anthropic',
        model: (settings.anthropic_model as string) || 'claude-3-5-haiku-20241022',
        apiKey: (settings.anthropic_api_key as string) || undefined,
      },
      {
        name: 'Groq',
        type: 'groq',
        baseURL: 'https://api.groq.com/openai/v1',
        model: (settings.groq_model as string) || 'llama-3.3-70b-versatile',
        apiKey: (settings.groq_api_key as string) || undefined,
      },
      {
        name: 'Together AI',
        type: 'together',
        baseURL: 'https://api.together.xyz/v1',
        model: (settings.together_model as string) || 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
        apiKey: (settings.together_api_key as string) || undefined,
      },
    ]

    const defaultProvider = providers.find(p => p.type === defaultProviderType) || providers[0]

    return {
      enabled: (settings.ai_enabled as boolean) ?? true,
      defaultProvider,
      providers,
      streamResponses: (settings.ai_stream_responses as boolean) ?? true,
    }
  }
  catch (error) {
    console.error('Error loading AI config from settings:', error)
    return defaultAIConfig
  }
}
