import { getTranslation } from '@/app/i18n/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'

export default async function AdminAIPage({ params }: { params: Promise<{ lng: string }> }) {
  const { lng } = await params
  const { t } = await getTranslation(lng, 'common')

  return (
    <div className="p-8">
      <div className="flex flex-col gap-1 mb-8">
        <h1 className="text-3xl font-bold tracking-tight">{t('ai_configuration') || 'AI Configuration'}</h1>
        <p className="text-muted-foreground">
          {t('ai_configuration_subtitle') || 'Configure AI providers and settings for your application'}
        </p>
      </div>

      <div className="grid gap-6 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle>{t('ai_provider_selection') || 'AI Provider Selection'}</CardTitle>
            <CardDescription>
              {t('ai_provider_selection_desc') || 'Choose your preferred AI provider and configure connection settings'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="lm-studio" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="lm-studio">LM Studio</TabsTrigger>
                <TabsTrigger value="openai">OpenAI</TabsTrigger>
                <TabsTrigger value="gemini">Gemini</TabsTrigger>
                <TabsTrigger value="anthropic">Claude</TabsTrigger>
              </TabsList>

              <TabsContent value="lm-studio" className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <Badge variant="secondary">{t('recommended') || 'Recommended'}</Badge>
                  <Badge variant="outline">{t('free') || 'Free'}</Badge>
                </div>
                
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="lm-studio-url">{t('lm_studio_url') || 'LM Studio URL'}</Label>
                    <Input 
                      id="lm-studio-url" 
                      defaultValue="http://localhost:1234/v1"
                      placeholder="http://localhost:1234/v1"
                    />
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="lm-studio-model">{t('model') || 'Model'}</Label>
                    <Select defaultValue="auto">
                      <SelectTrigger>
                        <SelectValue placeholder={t('select_model') || 'Select model'} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">{t('auto_detect') || 'Auto-detect'}</SelectItem>
                        <SelectItem value="llama-3.2-3b">Llama 3.2 3B</SelectItem>
                        <SelectItem value="llama-3.2-8b">Llama 3.2 8B</SelectItem>
                        <SelectItem value="llama-3.1-70b">Llama 3.1 70B</SelectItem>
                        <SelectItem value="qwen-2.5-7b">Qwen 2.5 7B</SelectItem>
                        <SelectItem value="custom">{t('custom_model') || 'Custom Model'}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="lm-studio-api-key">{t('api_key') || 'API Key'}</Label>
                    <Input 
                      id="lm-studio-api-key" 
                      type="password"
                      placeholder={t('optional_api_key') || 'Optional (if required)'}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="openai" className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <Badge variant="outline">{t('paid') || 'Paid'}</Badge>
                  <Badge variant="secondary">{t('popular') || 'Popular'}</Badge>
                </div>
                
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="openai-api-key">{t('api_key') || 'API Key'}</Label>
                    <Input 
                      id="openai-api-key" 
                      type="password"
                      placeholder="sk-..."
                    />
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="openai-model">{t('model') || 'Model'}</Label>
                    <Select defaultValue="gpt-4o-mini">
                      <SelectTrigger>
                        <SelectValue placeholder={t('select_model') || 'Select model'} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                        <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                        <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="openai-base-url">{t('base_url') || 'Base URL'}</Label>
                    <Input 
                      id="openai-base-url" 
                      placeholder="https://api.openai.com/v1"
                      defaultValue="https://api.openai.com/v1"
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="gemini" className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <Badge variant="outline">{t('free_tier_available') || 'Free Tier Available'}</Badge>
                </div>
                
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="gemini-api-key">{t('api_key') || 'API Key'}</Label>
                    <Input 
                      id="gemini-api-key" 
                      type="password"
                      placeholder="AIza..."
                    />
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="gemini-model">{t('model') || 'Model'}</Label>
                    <Select defaultValue="gemini-1.5-flash">
                      <SelectTrigger>
                        <SelectValue placeholder={t('select_model') || 'Select model'} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gemini-1.5-flash">Gemini 1.5 Flash</SelectItem>
                        <SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro</SelectItem>
                        <SelectItem value="gemini-1.0-pro">Gemini 1.0 Pro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="anthropic" className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <Badge variant="outline">{t('paid') || 'Paid'}</Badge>
                </div>
                
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="anthropic-api-key">{t('api_key') || 'API Key'}</Label>
                    <Input 
                      id="anthropic-api-key" 
                      type="password"
                      placeholder="sk-ant-..."
                    />
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="anthropic-model">{t('model') || 'Model'}</Label>
                    <Select defaultValue="claude-3-5-haiku-20241022">
                      <SelectTrigger>
                        <SelectValue placeholder={t('select_model') || 'Select model'} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="claude-3-5-haiku-20241022">Claude 3.5 Haiku</SelectItem>
                        <SelectItem value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</SelectItem>
                        <SelectItem value="claude-3-opus-20240229">Claude 3 Opus</SelectItem>
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
            <CardTitle>{t('ai_settings') || 'AI Settings'}</CardTitle>
            <CardDescription>
              {t('ai_settings_desc') || 'Configure AI behavior and limits'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('enable_ai_features') || 'Enable AI Features'}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('enable_ai_features_desc') || 'Allow AI-powered features in the application'}
                </p>
              </div>
              <Switch defaultChecked />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="max-tokens">{t('max_tokens') || 'Max Tokens'}</Label>
              <Input id="max-tokens" type="number" defaultValue={1000} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="temperature">{t('temperature') || 'Temperature'}</Label>
              <Input id="temperature" type="number" step="0.1" min="0" max="2" defaultValue={0.7} />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('stream_responses') || 'Stream Responses'}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('stream_responses_desc') || 'Enable real-time streaming of AI responses'}
                </p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button variant="outline">{t('test_connection') || 'Test Connection'}</Button>
          <Button>{t('save_changes') || 'Save Changes'}</Button>
        </div>
      </div>
    </div>
  )
}
