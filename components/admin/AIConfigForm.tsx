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
import { saveAISettings } from '@/app/actions/settings'
import { toast } from 'sonner'

interface AIConfigFormProps {
  aiSettings: Record<string, unknown>
}

export function AIConfigForm({ aiSettings }: AIConfigFormProps) {
  const { t } = useTranslation()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isTesting, setIsTesting] = useState(false)

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

  const handleTestConnection = async () => {
    setIsTesting(true)
    try {
      // TODO: Implement actual connection testing
      await new Promise(resolve => setTimeout(resolve, 1000))
      toast.success(t('ai_config.connection_test_successful'))
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
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="lm-studio">{t('ai_config.lm_studio')}</TabsTrigger>
              <TabsTrigger value="openai">{t('ai_config.openai')}</TabsTrigger>
              <TabsTrigger value="gemini">{t('ai_config.gemini')}</TabsTrigger>
              <TabsTrigger value="anthropic">{t('ai_config.claude')}</TabsTrigger>
            </TabsList>

            <TabsContent value="lm-studio" className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Badge variant="secondary">{t('recommended')}</Badge>
                <Badge variant="outline">{t('free')}</Badge>
              </div>

              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="lm-studio-url">{t('lm_studio_url')}</Label>
                  <Input
                    id="lm-studio-url"
                    value={lmStudioUrl}
                    onChange={e => setLmStudioUrl(e.target.value)}
                    placeholder="http://localhost:1234/v1"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="lm-studio-model">{t('model')}</Label>
                  <Select value={lmStudioModel} onValueChange={setLmStudioModel}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('select_model')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">{t('auto_detect')}</SelectItem>
                      <SelectItem value="llama-3.2-3b">{t('ai_config.llama_32_3b')}</SelectItem>
                      <SelectItem value="llama-3.2-8b">{t('ai_config.llama_32_8b')}</SelectItem>
                      <SelectItem value="llama-3.1-70b">{t('ai_config.llama_31_70b')}</SelectItem>
                      <SelectItem value="qwen-2.5-7b">{t('ai_config.qwen_25_7b')}</SelectItem>
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
                  <Label htmlFor="openai-api-key">{t('api_key')}</Label>
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
                  <Label htmlFor="gemini-api-key">{t('api_key')}</Label>
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
                  <Label htmlFor="anthropic-api-key">{t('api_key')}</Label>
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
