'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { getTranslation } from '@/app/i18n/client'

interface Props {
  children: React.ReactNode
  fallback?: React.ComponentType<{ error: Error, reset: () => void, lng: string }>
  lng?: string
}

interface State {
  hasError: boolean
  error?: Error
}

export default class LobbyDetailsErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('LobbyDetails Error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback
      return (
        <FallbackComponent
          error={this.state.error!}
          reset={() => this.setState({ hasError: false, error: undefined })}
          lng={this.props.lng || 'en'}
        />
      )
    }

    return this.props.children
  }
}

function DefaultErrorFallback({ error, reset, lng }: { error: Error, reset: () => void, lng: string }) {
  const { t } = getTranslation(lng, 'common')

  return (
    <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark">
      <div className="text-center max-w-md mx-auto p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          {t('error_boundary_title')}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          {t('error_boundary_description')}
        </p>
        <div className="space-y-3">
          <Button onClick={reset} className="w-full">
            {t('try_again')}
          </Button>
          <Link href={`/${lng}/lobbies`} className="block">
            <Button variant="outline" className="w-full">
              {t('back_to_lobbies')}
            </Button>
          </Link>
        </div>
        {process.env.NODE_ENV === 'development' && (
          <details className="mt-6 text-left">
            <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
              {t('error_details')}
            </summary>
            <pre className="mt-2 p-3 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-auto">
              {error.message}
            </pre>
          </details>
        )}
      </div>
    </div>
  )
}
