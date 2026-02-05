// Set environment variables before any modules are imported
process.env.ENABLE_LOCAL_IMAGE_EDITOR = 'true'

// NODE_ENV might be read-only, so we need to handle it carefully
if (!process.env.NODE_ENV || process.env.NODE_ENV !== 'development') {
  try {
    (process.env as any).NODE_ENV = 'development'
  }
  catch (error) {
    // If NODE_ENV is read-only, we'll need to work around it
    console.warn('Could not set NODE_ENV to development, it may be read-only')
  }
}
