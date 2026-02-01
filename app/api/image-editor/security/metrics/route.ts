import { NextRequest, NextResponse } from 'next/server'
import { withEnvironmentGuard, EnvironmentConfig } from '@/lib/image-editor-env'
import { securityLogger } from '@/lib/security-logger'

/**
 * GET /api/image-editor/security/metrics
 * Get security metrics for monitoring and debugging
 * Only available in development mode
 */
async function handleGetSecurityMetrics(request: NextRequest, config: EnvironmentConfig) {
  try {
    const metrics = securityLogger.getMetrics()

    return NextResponse.json({
      success: true,
      metrics,
      timestamp: new Date().toISOString(),
      environment: {
        isEnabled: config.isLocalImageEditorEnabled,
        isDevelopment: config.isDevelopmentMode,
        nodeEnv: process.env.NODE_ENV,
      },
    })
  }
  catch (error) {
    console.error('Error getting security metrics:', error)
    return NextResponse.json(
      { error: 'Failed to get security metrics' },
      { status: 500 },
    )
  }
}

/**
 * POST /api/image-editor/security/metrics/reset
 * Reset security metrics (development only)
 */
async function handleResetSecurityMetrics(request: NextRequest, config: EnvironmentConfig) {
  try {
    securityLogger.resetMetrics()

    return NextResponse.json({
      success: true,
      message: 'Security metrics reset successfully',
      timestamp: new Date().toISOString(),
    })
  }
  catch (error) {
    console.error('Error resetting security metrics:', error)
    return NextResponse.json(
      { error: 'Failed to reset security metrics' },
      { status: 500 },
    )
  }
}

export const GET = withEnvironmentGuard(handleGetSecurityMetrics)
export const POST = withEnvironmentGuard(handleResetSecurityMetrics)
