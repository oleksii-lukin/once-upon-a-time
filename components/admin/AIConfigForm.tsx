'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { fetchAvailableModels, saveAISettings, testAIConfig } from '@/app/actions/settings'
import { toast } from 'sonner'
import type { AIProvider } from '@/lib/ai/config'
import { ExternalLinkIcon, RefreshCcwIcon } from 'lucide-react'

interface AIConfigFormProps {
  aiSettings: Record<string, unknown>
}

export function AIConfigForm({ aiSettings }: AIConfigFormProps) {
  const { t } = useTranslation()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [isFetchingModels, setIsFetchingModels] = useState(false)
  const [fetchedModels, setFetchedModels] = useState<Record<string, string[]>>({})

  // Form states
  const [aiEnabled, setAiEnabled] = useState<boolean>((aiSettings.ai_enabled as boolean) || true)
  const [defaultProvider, setDefaultProvider] = useState((aiSettings.ai_default_provider as string) || 'lm-studio')
  const [streamResponses, setStreamResponses] = useState<boolean>((aiSettings.ai_stream_responses as boolean) || true)
  const [maxTokens, setMaxTokens] = useState((aiSettings.ai_max_tokens as number) || 1000)
  const [temperature, setTemperature] = useState((aiSettings.ai_temperature as number) || 0.7)

  // LM Studio settings
  const [lmStudioUrl, setLmStudioUrl] = useState((aiSettings.lm_studio_url as string) || 'http://localhost:1234/v1')
  const [lmStudioModel, setLmStudioModel] = useState((aiSettings.lm_studio_model as string) || 'auto')
  const [lmStudioApiKey, setLmStudioApiKey] = useState((aiSettings.lm_studio_api_key as string) || '')

  // OpenAI settings
  const [openaiApiKey, setOpenaiApiKey] = useState((aiSettings.openai_api_key as string) || '')
  const [openaiModel, setOpenaiModel] = useState((aiSettings.openai_model as string) || 'gpt-4o-mini')
  const [openaiBaseUrl, setOpenaiBaseUrl] = useState((aiSettings.openai_base_url as string) || 'https://api.openai.com/v1')

  // Gemini settings
  const [geminiApiKey, setGeminiApiKey] = useState((aiSettings.gemini_api_key as string) || '')
  const [geminiModel, setGeminiModel] = useState((aiSettings.gemini_model as string) || 'gemini-1.5-flash')

  // Anthropic settings
  const [anthropicApiKey, setAnthropicApiKey] = useState((aiSettings.anthropic_api_key as string) || '')
  const [anthropicModel, setAnthropicModel] = useState((aiSettings.anthropic_model as string) || 'claude-3-5-haiku-20241022')

  // Groq settings
  const [groqApiKey, setGroqApiKey] = useState((aiSettings.groq_api_key as string) || '')
  const [groqModel, setGroqModel] = useState((aiSettings.groq_model as string) || 'llama-3.3-70b-versatile')

  // Together AI settings
  const [togetherApiKey, setTogetherApiKey] = useState((aiSettings.together_api_key as string) || '')
  const [togetherModel, setTogetherModel] = useState((aiSettings.together_model as string) || 'meta-llama/Llama-3.3-70B-Instruct-Turbo')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const result = await saveAISettings({
        ai_enabled: aiEnabled,
        ai_default_provider: defaultProvider,
        ai_stream_responses: streamResponses,
        ai_max_tokens: maxTokens,
        ai_temperature: temperature,
        lm_studio_url: lmStudioUrl,
        lm_studio_model: lmStudioModel,
        lm_studio_api_key: lmStudioApiKey || null,
        openai_api_key: openaiApiKey || null,
        openai_model: openaiModel,
        openai_base_url: openaiBaseUrl,
        gemini_api_key: geminiApiKey || null,
        gemini_model: geminiModel,
        anthropic_api_key: anthropicApiKey || null,
        anthropic_model: anthropicModel,
        groq_api_key: groqApiKey || null,
        groq_model: groqModel,
        together_api_key: togetherApiKey || null,
        together_model: togetherModel,
      })

      if (result.success) {
        toast.success(t('ai_config.ai_settings_saved'))
      }
      else {
        toast.error(result.error || t('ai_config.ai_settings_error'))
      }
    }
    catch (error) {
      console.error('Failed to save AI settings:', error)
      toast.error(t('ai_config.ai_settings_error'))
    }
    finally {
      setIsSubmitting(false)
    }
  }

  const handleFetchModels = async (providerType: string, url: string, apiKey?: string) => {
    setIsFetchingModels(true)
    try {
      const result = await fetchAvailableModels(url, apiKey)
      if (result.success && result.models) {
        setFetchedModels(prev => ({
          ...prev,
          [providerType]: result.models!,
        }))
        toast.success(t('ai_config.connection_test_successful'))
      }
      else {
        toast.error(result.error || t('ai_config.connection_test_failed'))
      }
    }
    catch (error) {
      console.error('Failed to fetch models:', error)
      toast.error(t('ai_config.connection_test_failed'))
    }
    finally {
      setIsFetchingModels(false)
    }
  }

  const handleTestConnection = async () => {
    setIsTesting(true)
    try {
      let provider: AIProvider

      switch (defaultProvider) {
        case 'lm-studio':
          provider = {
            name: 'LM Studio',
            type: 'lm-studio',
            baseURL: lmStudioUrl,
            model: lmStudioModel,
            apiKey: lmStudioApiKey || undefined,
          }
          break
        case 'openai':
          provider = {
            name: 'OpenAI',
            type: 'openai',
            baseURL: openaiBaseUrl,
            model: openaiModel,
            apiKey: openaiApiKey || undefined,
          }
          break
        case 'gemini':
          provider = {
            name: 'Gemini',
            type: 'gemini',
            model: geminiModel,
            apiKey: geminiApiKey || undefined,
          }
          break
        case 'anthropic':
          provider = {
            name: 'Claude',
            type: 'anthropic',
            model: anthropicModel,
            apiKey: anthropicApiKey || undefined,
          }
          break
        case 'groq':
          provider = {
            name: 'Groq',
            type: 'groq',
            model: groqModel,
            apiKey: groqApiKey || undefined,
          }
          break
        case 'together':
          provider = {
            name: 'Together AI',
            type: 'together',
            model: togetherModel,
            apiKey: togetherApiKey || undefined,
          }
          break
        default:
          throw new Error('Unsupported provider')
      }

      const result = await testAIConfig(provider)

      if (result.success) {
        toast.success(t('ai_config.connection_test_successful'))
      }
      else {
        toast.error(result.error || t('ai_config.connection_test_failed'))
      }
    }
    catch (error) {
      console.error('Connection test failed:', error)
      toast.error(t('ai_config.connection_test_failed'))
    }
    finally {
      setIsTesting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('ai_provider_selection')}</CardTitle>
          <CardDescription>
            {t('ai_provider_selection_desc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={defaultProvider} onValueChange={setDefaultProvider} className="w-full">
            <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6 h-auto">
              <TabsTrigger value="lm-studio">{t('ai_config.lm_studio')}</TabsTrigger>
              <TabsTrigger value="openai">{t('ai_config.openai')}</TabsTrigger>
              <TabsTrigger value="gemini">{t('ai_config.gemini')}</TabsTrigger>
              <TabsTrigger value="anthropic">{t('ai_config.claude')}</TabsTrigger>
              <TabsTrigger value="groq">{t('ai_config.groq')}</TabsTrigger>
              <TabsTrigger value="together">{t('ai_config.together')}</TabsTrigger>
            </TabsList>

            <TabsContent value="lm-studio" className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Badge variant="secondary">{t('recommended')}</Badge>
                <Badge variant="outline">{t('free')}</Badge>
              </div>

              <div className="grid gap-4">
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="lm-studio-url">{t('lm_studio_url')}</Label>
                    <Button variant="link" size="sm" asChild className="h-auto p-0">
                      <a href="https://lmstudio.ai/docs" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs">
                        {t('documentation')}
                        {' '}
                        <ExternalLinkIcon className="h-3 w-3" />
                      </a>
                    </Button>
                  </div>
                  <Input
                    id="lm-studio-url"
                    value={lmStudioUrl}
                    onChange={e => setLmStudioUrl(e.target.value)}
                    placeholder="http://localhost:1234/v1"
                  />
                </div>

                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="lm-studio-model">{t('model')}</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 gap-1"
                      onClick={() => handleFetchModels('lm-studio', lmStudioUrl, lmStudioApiKey)}
                      disabled={isFetchingModels}
                    >
                      <RefreshCcwIcon className={`h-3 w-3 ${isFetchingModels ? 'animate-spin' : ''}`} />
                      <span className="text-xs">{t('refresh_models')}</span>
                    </Button>
                  </div>
                  <Select value={lmStudioModel} onValueChange={setLmStudioModel}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('select_model')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">{t('auto_detect')}</SelectItem>
                      {fetchedModels['lm-studio']?.map(model => (
                        <SelectItem key={model} value={model}>{model}</SelectItem>
                      ))}
                      {!fetchedModels['lm-studio'] && (
                        <>
                          <SelectItem value="llama-3.2-3b">{t('ai_config.llama_32_3b')}</SelectItem>
                          <SelectItem value="llama-3.2-8b">{t('ai_config.llama_32_8b')}</SelectItem>
                          <SelectItem value="llama-3.1-70b">{t('ai_config.llama_31_70b')}</SelectItem>
                          <SelectItem value="qwen-2.5-7b">{t('ai_config.qwen_25_7b')}</SelectItem>
                          {lmStudioModel && !['auto', 'llama-3.2-3b', 'llama-3.2-8b', 'llama-3.1-70b', 'qwen-2.5-7b', 'custom'].includes(lmStudioModel) && (
                            <SelectItem value={lmStudioModel}>{lmStudioModel}</SelectItem>
                          )}
                        </>
                      )}
                      {fetchedModels['lm-studio'] && lmStudioModel && !fetchedModels['lm-studio'].concat(['auto', 'custom']).includes(lmStudioModel) && (
                        <SelectItem value={lmStudioModel}>{lmStudioModel}</SelectItem>
                      )}
                      <SelectItem value="custom">{t('custom_model')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="lm-studio-api-key">{t('api_key')}</Label>
                  <Input
                    id="lm-studio-api-key"
                    type="password"
                    value={lmStudioApiKey}
                    onChange={e => setLmStudioApiKey(e.target.value)}
                    placeholder={t('optional_api_key')}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="openai" className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Badge variant="outline">{t('paid')}</Badge>
                <Badge variant="secondary">{t('popular')}</Badge>
              </div>

              <div className="grid gap-4">
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="openai-api-key">{t('api_key')}</Label>
                    <Button variant="link" size="sm" asChild className="h-auto p-0">
                      <a href="https://platform.openai.com/docs" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs">
                        {t('documentation')}
                        {' '}
                        <ExternalLinkIcon className="h-3 w-3" />
                      </a>
                    </Button>
                  </div>
                  <Input
                    id="openai-api-key"
                    type="password"
                    value={openaiApiKey}
                    onChange={e => setOpenaiApiKey(e.target.value)}
                    placeholder="sk-..."
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="openai-model">{t('model')}</Label>
                  <Select value={openaiModel} onValueChange={setOpenaiModel}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('select_model')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gpt-4o-mini">{t('ai_config.gpt_4o_mini')}</SelectItem>
                      <SelectItem value="gpt-4o">{t('ai_config.gpt_4o')}</SelectItem>
                      <SelectItem value="gpt-3.5-turbo">{t('ai_config.gpt_35_turbo')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="openai-base-url">{t('base_url')}</Label>
                  <Input
                    id="openai-base-url"
                    value={openaiBaseUrl}
                    onChange={e => setOpenaiBaseUrl(e.target.value)}
                    placeholder="https://api.openai.com/v1"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="gemini" className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Badge variant="outline">{t('free_tier_available')}</Badge>
              </div>

              <div className="grid gap-4">
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="gemini-api-key">{t('api_key')}</Label>
                    <Button variant="link" size="sm" asChild className="h-auto p-0">
                      <a href="https://ai.google.dev/docs" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs">
                        {t('documentation')}
                        {' '}
                        <ExternalLinkIcon className="h-3 w-3" />
                      </a>
                    </Button>
                  </div>
                  <Input
                    id="gemini-api-key"
                    type="password"
                    value={geminiApiKey}
                    onChange={e => setGeminiApiKey(e.target.value)}
                    placeholder="AIza..."
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="gemini-model">{t('model')}</Label>
                  <Select value={geminiModel} onValueChange={setGeminiModel}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('select_model')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gemini-1.5-flash">{t('ai_config.gemini_15_flash')}</SelectItem>
                      <SelectItem value="gemini-1.5-pro">{t('ai_config.gemini_15_pro')}</SelectItem>
                      <SelectItem value="gemini-1.0-pro">{t('ai_config.gemini_10_pro')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="anthropic" className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Badge variant="outline">{t('paid')}</Badge>
              </div>

              <div className="grid gap-4">
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="anthropic-api-key">{t('api_key')}</Label>
                    <Button variant="link" size="sm" asChild className="h-auto p-0">
                      <a href="https://docs.anthropic.com/en/docs/welcome" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs">
                        {t('documentation')}
                        {' '}
                        <ExternalLinkIcon className="h-3 w-3" />
                      </a>
                    </Button>
                  </div>
                  <Input
                    id="anthropic-api-key"
                    type="password"
                    value={anthropicApiKey}
                    onChange={e => setAnthropicApiKey(e.target.value)}
                    placeholder="sk-ant-..."
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="anthropic-model">{t('model')}</Label>
                  <Select value={anthropicModel} onValueChange={setAnthropicModel}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('select_model')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="claude-3-5-haiku-20241022">{t('ai_config.claude_35_haiku')}</SelectItem>
                      <SelectItem value="claude-3-5-sonnet-20241022">{t('ai_config.claude_35_sonnet')}</SelectItem>
                      <SelectItem value="claude-3-opus-20240229">{t('ai_config.claude_3_opus')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="groq" className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Badge variant="outline">{t('free_tier_available')}</Badge>
                <Badge variant="secondary">{t('very_fast')}</Badge>
              </div>

              <div className="grid gap-4">
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="groq-api-key">{t('api_key')}</Label>
                    <Button variant="link" size="sm" asChild className="h-auto p-0">
                      <a href="https://console.groq.com/docs/quickstart" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs">
                        {t('documentation')}
                        {' '}
                        <ExternalLinkIcon className="h-3 w-3" />
                      </a>
                    </Button>
                  </div>
                  <Input
                    id="groq-api-key"
                    type="password"
                    value={groqApiKey}
                    onChange={e => setGroqApiKey(e.target.value)}
                    placeholder="gsk_..."
                  />
                </div>

                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="groq-model">{t('model')}</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 gap-1"
                      onClick={() => handleFetchModels('groq', 'https://api.groq.com/openai/v1', groqApiKey)}
                      disabled={isFetchingModels}
                    >
                      <RefreshCcwIcon className={`h-3 w-3 ${isFetchingModels ? 'animate-spin' : ''}`} />
                      <span className="text-xs">{t('refresh_models')}</span>
                    </Button>
                  </div>
                  <Select value={groqModel} onValueChange={setGroqModel}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('select_model')} />
                    </SelectTrigger>
                    <SelectContent>
                      {fetchedModels.groq?.map(model => (
                        <SelectItem key={model} value={model}>{model}</SelectItem>
                      ))}
                      {!fetchedModels.groq && (
                        <>
                          <SelectItem value="llama-3.3-70b-versatile">{t('ai_config.llama_33_70b')}</SelectItem>
                          <SelectItem value="llama-3.1-70b-versatile">{t('ai_config.llama_31_70b')}</SelectItem>
                          <SelectItem value="llama-3.2-3b-preview">{t('ai_config.llama_32_3b')}</SelectItem>
                          <SelectItem value="mixtral-8x7b-32768">{t('ai_config.mixtral_8x7b')}</SelectItem>
                          {groqModel && !['llama-3.3-70b-versatile', 'llama-3.1-70b-versatile', 'llama-3.2-3b-preview', 'mixtral-8x7b-32768'].includes(groqModel) && (
                            <SelectItem value={groqModel}>{groqModel}</SelectItem>
                          )}
                        </>
                      )}
                      {fetchedModels.groq && groqModel && !fetchedModels.groq.includes(groqModel) && (
                        <SelectItem value={groqModel}>{groqModel}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="together" className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Badge variant="outline">{t('free_credits_available')}</Badge>
                <Badge variant="secondary">{t('open_source')}</Badge>
              </div>

              <div className="grid gap-4">
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="together-api-key">{t('api_key')}</Label>
                    <Button variant="link" size="sm" asChild className="h-auto p-0">
                      <a href="https://docs.together.ai/docs/quickstart" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs">
                        {t('documentation')}
                        {' '}
                        <ExternalLinkIcon className="h-3 w-3" />
                      </a>
                    </Button>
                  </div>
                  <Input
                    id="together-api-key"
                    type="password"
                    value={togetherApiKey}
                    onChange={e => setTogetherApiKey(e.target.value)}
                    placeholder="..."
                  />
                </div>

                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="together-model">{t('model')}</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 gap-1"
                      onClick={() => handleFetchModels('together', 'https://api.together.xyz/v1', togetherApiKey)}
                      disabled={isFetchingModels}
                    >
                      <RefreshCcwIcon className={`h-3 w-3 ${isFetchingModels ? 'animate-spin' : ''}`} />
                      <span className="text-xs">{t('refresh_models')}</span>
                    </Button>
                  </div>
                  <Select value={togetherModel} onValueChange={setTogetherModel}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('select_model')} />
                    </SelectTrigger>
                    <SelectContent>
                      {fetchedModels.together?.map(model => (
                        <SelectItem key={model} value={model}>{model}</SelectItem>
                      ))}
                      {!fetchedModels.together && (
                        <>
                          <SelectItem value="meta-llama/Llama-3.3-70B-Instruct-Turbo">{t('ai_config.llama_33_70b')}</SelectItem>
                          <SelectItem value="meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo">{t('ai_config.llama_31_70b')}</SelectItem>
                          <SelectItem value="mistralai/Mixtral-8x7B-Instruct-v0.1">{t('ai_config.mixtral_8x7b')}</SelectItem>
                          <SelectItem value="Qwen/Qwen2.5-72B-Instruct-Turbo">{t('ai_config.qwen_25_72b')}</SelectItem>
                          {togetherModel && !['meta-llama/Llama-3.3-70B-Instruct-Turbo', 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo', 'mistralai/Mixtral-8x7B-Instruct-v0.1', 'Qwen/Qwen2.5-72B-Instruct-Turbo'].includes(togetherModel) && (
                            <SelectItem value={togetherModel}>{togetherModel}</SelectItem>
                          )}
                        </>
                      )}
                      {fetchedModels.together && togetherModel && !fetchedModels.together.includes(togetherModel) && (
                        <SelectItem value={togetherModel}>{togetherModel}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('ai_settings')}</CardTitle>
          <CardDescription>
            {t('ai_settings_desc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{t('enable_ai_features')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('enable_ai_features_desc')}
              </p>
            </div>
            <Switch
              checked={aiEnabled}
              onCheckedChange={checked => setAiEnabled(checked)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="max-tokens">{t('max_tokens')}</Label>
            <Input
              id="max-tokens"
              type="number"
              value={maxTokens}
              onChange={e => setMaxTokens(Number(e.target.value))}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="temperature">{t('temperature')}</Label>
            <Input
              id="temperature"
              type="number"
              step="0.1"
              min="0"
              max="2"
              value={temperature}
              onChange={e => setTemperature(Number(e.target.value))}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{t('stream_responses')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('stream_responses_desc')}
              </p>
            </div>
            <Switch
              checked={streamResponses}
              onCheckedChange={checked => setStreamResponses(checked)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline" onClick={handleTestConnection} disabled={isTesting}>
          {isTesting ? t('ai_config.testing') : (t('test_connection'))}
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? t('saving') : (t('save_changes'))}
        </Button>
      </div>
    </form>
  )
}
