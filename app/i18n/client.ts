'use client'

import i18next from 'i18next'
import { initReactI18next, useTranslation as getTranslationOrg } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { getOptions, cookieName } from './settings'
import { useEffect, useState } from 'react'
import en from '../../public/locales/en/common.json'
import ru from '../../public/locales/ru/common.json'
import ua from '../../public/locales/ua/common.json'

const runsOnServerSide = typeof window === 'undefined'

// Locales are imported statically on purpose: with the previous async
// backend loader, SSR could render a different language than the client
// (changeLanguage was not awaited during render), causing hydration
// mismatches. Static resources make i18next resolve languages synchronously
// on both server and client.
i18next
  .use(initReactI18next)
  .use(LanguageDetector)
  .init({
    ...getOptions(),
    lng: undefined, // let detect the language on client side
    resources: {
      en: { common: en },
      ru: { common: ru },
      ua: { common: ua },
    },
    detection: {
      order: ['path', 'htmlTag', 'cookie', 'navigator'],
    },
  })

export function getTranslation(lng: string, ns: string, options?: Parameters<typeof getTranslationOrg>[1]) {
  const ret = getTranslationOrg(ns, options)
  const { i18n } = ret
  if (runsOnServerSide && lng && i18n.resolvedLanguage !== lng) {
    i18n.changeLanguage(lng)
  }
  else {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [activeLng, setActiveLng] = useState(i18n.resolvedLanguage)
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {
      if (activeLng === i18n.resolvedLanguage) return
      setActiveLng(i18n.resolvedLanguage)
    }, [activeLng, i18n.resolvedLanguage])
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {
      if (!lng || i18n.resolvedLanguage === lng) return
      i18n.changeLanguage(lng)
    }, [lng, i18n])
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {
      if (cookies.get(cookieName) === lng) return
      cookies.set(cookieName, lng, { path: '/' })
    }, [lng])
  }
  return ret
}

// Simple cookie helper to avoid adding another dependency just for this
const cookies = {
  get: (name: string) => {
    if (typeof document === 'undefined') return ''
    const value = `; ${document.cookie}`
    const parts = value.split(`; ${name}=`)
    if (parts.length === 2) return parts.pop()?.split(';').shift()
    return ''
  },
  set: (name: string, value: string, options: { path?: string }) => {
    if (typeof document === 'undefined') return
    let cookie = `${name}=${value}`
    if (options.path) cookie += `; path=${options.path}`
    document.cookie = cookie
  },
}
