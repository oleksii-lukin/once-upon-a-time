'use client'

import i18next from 'i18next'
import { initReactI18next, useTranslation as useTranslationOrg } from 'react-i18next'
import resourcesToBackend from 'i18next-resources-to-backend'
import LanguageDetector from 'i18next-browser-languagedetector'
import { getOptions, languages, cookieName } from './settings'
import { useEffect, useState } from 'react'

const runsOnServerSide = typeof window === 'undefined'

i18next
    .use(initReactI18next)
    .use(LanguageDetector)
    .use(resourcesToBackend((language: string, namespace: string) => import(`../../public/locales/${language}/${namespace}.json`)))
    .init({
        ...getOptions(),
        lng: undefined, // let detect the language on client side
        detection: {
            order: ['path', 'htmlTag', 'cookie', 'navigator'],
        },
        preload: runsOnServerSide ? languages : [],
    })

export function useTranslation(lng: string, ns: string, options?: any) {
    const ret = useTranslationOrg(ns, options)
    const { i18n } = ret
    if (runsOnServerSide && lng && i18n.resolvedLanguage !== lng) {
        i18n.changeLanguage(lng)
    } else {
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
        }, [lng, cookies])
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
    set: (name: string, value: string, options: any) => {
        if (typeof document === 'undefined') return
        let cookie = `${name}=${value}`
        if (options.path) cookie += `; path=${options.path}`
        document.cookie = cookie
    }
}
