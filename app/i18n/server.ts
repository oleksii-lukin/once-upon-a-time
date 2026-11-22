import { createInstance } from 'i18next'
import { initReactI18next } from 'react-i18next/initReactI18next'
import { getOptions } from './settings'
// Static imports on purpose — mirrors app/i18n/client.ts (see its comment):
// the previous async backend loader (i18next-resources-to-backend with a
// dynamic import() of JSON) raced under parallel dev loads, intermittently
// failing /en/lobbies with "SyntaxError: Unexpected end of JSON input" and
// a 500. Tests are locked by tests/i18next-ssr-sync.test.ts.
import en from '../../public/locales/en/common.json'
import ru from '../../public/locales/ru/common.json'
import ua from '../../public/locales/ua/common.json'

const resources = {
  en: { common: en },
  ru: { common: ru },
  ua: { common: ua },
}

const initI18next = async (lng: string, ns: string) => {
  const i18nInstance = createInstance()
  await i18nInstance
    .use(initReactI18next)
    .init({ ...getOptions(lng, ns), resources })
  return i18nInstance
}

export async function getTranslation(lng: string, ns: string, options: { keyPrefix?: string } = {}) {
  const i18nextInstance = await initI18next(lng, ns)
  return {
    t: i18nextInstance.getFixedT(lng, Array.isArray(ns) ? ns[0] : ns, options.keyPrefix),
    i18n: i18nextInstance,
  }
}
