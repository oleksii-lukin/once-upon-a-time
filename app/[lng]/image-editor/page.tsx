import { getTranslation } from '@/app/i18n/server'
import { isLocalImageEditorAvailable } from '@/lib/image-editor-env'
import LocalDeckEditor from '@/components/local-admin/LocalDeckEditor'
import { AlertTriangle, Settings, FileImage } from 'lucide-react'

export default async function ImageEditorPage({ params }: { params: Promise<{ lng: string }> }) {
  const { lng } = await params
  const { t } = await getTranslation(lng, 'common')

  // Check if local image editor is available
  const isAvailable = isLocalImageEditorAvailable()

  // If not available, show environment warning
  if (!isAvailable) {
    return (
      <div className="p-8">
        <div className="flex flex-col gap-1 mb-8">
          <h1 className="text-3xl font-bold tracking-tight">{t('local_image_editor')}</h1>
          <p className="text-muted-foreground">
            {t('local_image_editor_subtitle')}
          </p>
        </div>

        <div className="max-w-2xl mx-auto">
          <div className="border border-amber-200 bg-amber-50 rounded-lg p-6">
            <div className="flex items-start gap-4">
              <AlertTriangle className="h-6 w-6 text-amber-600 mt-1 shrink-0" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-amber-800 mb-2">
                  {t('environment_warning_title')}
                </h3>
                <div className="text-amber-700 space-y-3">
                  <p>{t('local_image_editor_unavailable')}</p>

                  <div className="bg-amber-100 rounded-md p-4">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      {t('required_configuration')}
                    </h4>
                    <ul className="space-y-1 text-sm">
                      <li>
                        •
                        {t('set_development_mode')}
                        :
                        <code className="bg-amber-200 px-1 rounded">{t('node_env_development')}</code>
                      </li>
                      <li>
                        •
                        {t('enable_local_editor')}
                        :
                        <code className="bg-amber-200 px-1 rounded">{t('enable_local_image_editor_true')}</code>
                      </li>
                      <li>
                        •
                        {t('add_to_env_local')}
                        :
                        <code className="bg-amber-200 px-1 rounded">{t('env_local_file')}</code>
                      </li>
                    </ul>
                  </div>

                  <div className="bg-amber-100 rounded-md p-4">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <FileImage className="h-4 w-4" />
                      {t('security_notice')}
                    </h4>
                    <p className="text-sm">
                      {t('local_editor_security_notice')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // If available, show the local deck editor
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="flex h-14 items-center px-6">
          <div className="flex items-center gap-3">
            <FileImage className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-lg font-semibold">{t('local_image_editor')}</h1>
              <p className="text-xs text-muted-foreground">{t('local_file_system_mode')}</p>
            </div>
          </div>

          {/* Environment indicator */}
          <div className="ml-auto flex items-center gap-2">
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">
              {t('development_mode')}
            </span>
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200">
              {t('local_files')}
            </span>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full p-6">
          <LocalDeckEditor lng={lng} />
        </div>
      </div>
    </div>
  )
}
