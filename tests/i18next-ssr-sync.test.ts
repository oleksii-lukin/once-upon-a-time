// Guards the SSR determinism fix in app/i18n/client.ts (see the comment there).
//
// Why this test exists: locale JSONs used to be loaded asynchronously
// (i18next-resources-to-backend), so during SSR `i18n.changeLanguage(lng)`
// (called WITHOUT await in the server branch of getTranslation) did not take
// effect before render — the server could emit the fallback language while the
// client rendered the target language, causing React hydration mismatches.
//
// The fix relies on i18next resolving languages SYNCHRONOUSLY when static
// `resources` are passed to init(). If an i18next upgrade or a refactor of
// client.ts ever breaks that (e.g. reintroduces an async backend loader),
// these tests fail — before users see hydration errors again.
import i18next from 'i18next'
import { describe, expect, it } from 'vitest'
// Side-effect import: initializes the shared i18next singleton the way the app does.
import '@/app/i18n/client'

describe('i18n client SSR determinism', () => {
  it('loads all locale bundles synchronously from static resources', () => {
    // No async backend: resources are static imports in client.ts.
    expect(i18next.options.resources).toBeTruthy()
    for (const lng of ['en', 'ru', 'ua']) {
      expect(i18next.hasResourceBundle(lng, 'common')).toBe(true)
    }
  })

  it('changeLanguage applies synchronously — no await between call and effect', () => {
    // This is the invariant the unawaited server-branch call depends on:
    // with static resources, loadResources short-circuits (else branch calls
    // the callback synchronously), so changeLanguage sets i18n.language
    // before it returns. Do NOT add `await` here to "fix" the assertion —
    // if an await becomes necessary, SSR rendering is async again and the
    // hydration fix in client.ts is broken.
    i18next.changeLanguage('en')
    expect(i18next.language).toBe('en')

    i18next.changeLanguage('ru')
    expect(i18next.language).toBe('ru')

    i18next.changeLanguage('ua')
    expect(i18next.language).toBe('ua')
  })

  it('resolves a translation for the current language without any async step', () => {
    i18next.changeLanguage('ru')
    expect(i18next.t('title')).toBe('Жили-были')

    i18next.changeLanguage('en')
    expect(i18next.t('title')).toBe('Once Upon a Time')
  })
})
