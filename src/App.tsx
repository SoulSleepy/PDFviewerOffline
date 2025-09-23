// src/App.tsx
import '@react-pdf-viewer/core/lib/styles/index.css'
import '@react-pdf-viewer/default-layout/lib/styles/index.css'
import '@react-pdf-viewer/search/lib/styles/index.css'

import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react'
import { Worker, Viewer, SpecialZoomLevel } from '@react-pdf-viewer/core'
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout'
import { searchPlugin } from '@react-pdf-viewer/search'
import {
    getInlinePdfWorkerUrl,
    revokeInlinePdfWorkerUrl,
} from './helpers/pdf-worker-inline'

import {
    readShareConfigFromIframeAttrs,
    generateShareLink,
    type ShareConfig,
} from './helpers/share-utils'
import {
    DownloadIcon,
    FullScIcon,
    NormalScIcon,
    ShareIcon,
} from './Icons/Icons'

// ---------- utils
const guessNameFromUrl = (u: string) => {
    try {
        const { pathname } = new URL(u, window.location.href)
        const last = pathname.split('/').filter(Boolean).pop() || 'document.pdf'
        return decodeURIComponent(last.endsWith('.pdf') ? last : `${last}.pdf`)
    } catch {
        return 'document.pdf'
    }
}

const sanitizeFileName = (name: string) =>
    (name || 'document.pdf').replace(/[\/\\?%*:|"<>]/g, '_').trim()

const ensurePdfExt = (name: string) =>
    /\.(pdf)$/i.test(name) ? name : `${name}.pdf`

// iOS / iPadOS (включая десктопный Safari с тачем)
const isIosLike = () => {
    const ua = navigator.userAgent || ''
    return (
        /iPad|iPhone|iPod/.test(ua) ||
        (ua.includes('Mac') && 'ontouchend' in document)
    )
}

const App: React.FC = () => {
    // гарантируем мета-тег один раз
    useEffect(() => {
        ensureViewportMeta()
    }, [])

    const [fileUrl, setFileUrl] = useState<string | null>(null)
    const [fileBlob, setFileBlob] = useState<Blob | null>(null)
    const [downloadName, setDownloadName] = useState<string>('document.pdf')
    const inputRef = useRef<HTMLInputElement>(null)

    // share
    const [shareUrl, setShareUrl] = useState<string | null>(null)
    const [shareConfig, setShareConfig] = useState<ShareConfig | null>(null)

    // fullscreen
    const containerRef = useRef<HTMLDivElement>(null)
    const [isFullscreen, setIsFullscreen] = useState(false) // native FS
    const [cssFullscreen, setCssFullscreen] = useState(false) // CSS fallback FS

    // === search plugin (горячие клавиши включены)
    const search = searchPlugin({ enableShortcuts: true })

    // === PDF viewer toolbar
    const layout = defaultLayoutPlugin({
        sidebarTabs: (tabs) => [tabs[0]],
        renderToolbar: (Toolbar) => (
            <Toolbar>
                {(slots) => {
                    const {
                        CurrentPageInput,
                        NumberOfPages,
                        ZoomOut,
                        Zoom,
                        ZoomIn,
                    } = slots

                    return (
                        <div className='flex items-center gap-2 px-2 py-1 border-b bg-white'>
                            <ZoomOut />
                            <Zoom />
                            <ZoomIn />
                            <div className='mx-2 h-6 w-px bg-gray-200' />
                            <div className='flex items-center gap-1 text-black'>
                                <CurrentPageInput />
                                <span className='text-sm text-gray-500'>/</span>
                                <NumberOfPages />
                            </div>
                        </div>
                    )
                }}
            </Toolbar>
        ),
    })

    const workerUrl = useMemo(() => getInlinePdfWorkerUrl(), [])
    useEffect(() => () => revokeInlinePdfWorkerUrl(), [])

    const suggestDownloadName = useCallback(async (): Promise<string> => {
        let name =
            downloadName ||
            ((fileBlob as any)?.name as string | undefined) ||
            (fileUrl ? guessNameFromUrl(fileUrl) : 'document.pdf')
        name = ensurePdfExt(sanitizeFileName(name))

        if (!fileBlob && fileUrl && !fileUrl.startsWith('blob:')) {
            try {
                const res = await fetch(fileUrl, { method: 'HEAD' })
                const cd = res.headers.get('content-disposition')
                if (cd) {
                    const m =
                        /filename\*=UTF-8''([^;]+)|filename="?([^"]+)"?/i.exec(
                            cd
                        )
                    const raw = decodeURIComponent(m?.[1] || m?.[2] || '')
                    if (raw) name = ensurePdfExt(sanitizeFileName(raw))
                }
            } catch {}
        }

        const typed = window.prompt('Сохранить как (имя файла):', name)
        if (!typed) return ''
        const finalName = ensurePdfExt(sanitizeFileName(typed))
        setDownloadName(finalName)
        return finalName
    }, [downloadName, fileBlob, fileUrl])

    const handleDownload = useCallback(async () => {
        const finalName = await suggestDownloadName()
        if (!finalName) return

        try {
            let blob = fileBlob
            if (!blob && fileUrl) {
                const res = await fetch(fileUrl)
                blob = await res.blob()
            }
            if (blob) {
                const a = document.createElement('a')
                const tmp = URL.createObjectURL(blob)
                a.href = tmp
                a.download = finalName
                a.click()
                URL.revokeObjectURL(tmp)
                return
            }
            if (fileUrl) {
                const a = document.createElement('a')
                a.href = fileUrl
                a.download = finalName
                a.click()
            }
        } catch (e) {
            console.error('[download] error:', e)
            if (fileUrl) {
                const a = document.createElement('a')
                a.href = fileUrl
                a.download = finalName
                a.click()
            }
        }
    }, [fileBlob, fileUrl, suggestDownloadName])

    // sync native fullscreen flag
    useEffect(() => {
        const onFsChange = () => {
            const fsElement =
                document.fullscreenElement ||
                (document as any).webkitFullscreenElement ||
                (document as any).mozFullScreenElement ||
                (document as any).msFullscreenElement
            setIsFullscreen(Boolean(fsElement))
        }
        document.addEventListener('fullscreenchange', onFsChange)
        document.addEventListener('webkitfullscreenchange', onFsChange as any)
        document.addEventListener('mozfullscreenchange', onFsChange as any)
        document.addEventListener('MSFullscreenChange', onFsChange as any)
        return () => {
            document.removeEventListener('fullscreenchange', onFsChange)
            document.removeEventListener(
                'webkitfullscreenchange',
                onFsChange as any
            )
            document.removeEventListener(
                'mozfullscreenchange',
                onFsChange as any
            )
            document.removeEventListener(
                'MSFullscreenChange',
                onFsChange as any
            )
        }
    }, [])

    // блокируем прокрутку боди при CSS FS
    useEffect(() => {
        const cls = 'body-no-scroll'
        if (cssFullscreen) document.body.classList.add(cls)
        else document.body.classList.remove(cls)
        return () => document.body.classList.remove(cls)
    }, [cssFullscreen])

    // === fullscreen enter (smart: native -> fallback CSS)
    const enterFullscreen = useCallback(async () => {
        const el = containerRef.current
        if (!el) return
        const anyEl = el as any

        // На iOS сразу уходим в CSS-фуллскрин: нативный FS часто недоступен/ограничен
        if (isIosLike()) {
            setCssFullscreen(true)
            return
        }

        try {
            if (el.requestFullscreen) await el.requestFullscreen()
            else if (anyEl.webkitRequestFullscreen)
                await anyEl.webkitRequestFullscreen()
            else if (anyEl.mozRequestFullScreen)
                await anyEl.mozRequestFullScreen()
            else if (anyEl.msRequestFullscreen)
                await anyEl.msRequestFullscreen()
            else setCssFullscreen(true)
        } catch (e) {
            console.warn('[fullscreen] native failed, fallback to CSS:', e)
            setCssFullscreen(true)
        }
    }, [])

    const exitFullscreen = useCallback(async () => {
        if (cssFullscreen) {
            setCssFullscreen(false)
            return
        }
        try {
            if (document.exitFullscreen) await document.exitFullscreen()
            else if ((document as any).webkitExitFullscreen)
                await (document as any).webkitExitFullscreen()
            else if ((document as any).mozCancelFullScreen)
                await (document as any).mozCancelFullScreen()
            else if ((document as any).msExitFullscreen)
                await (document as any).msExitFullscreen()
        } catch (e) {
            console.error('[fullscreen] exit error:', e)
        }
    }, [cssFullscreen])

    // Ctrl+wheel для десктопов
    useEffect(() => {
        const el = containerRef.current
        if (!el) return
        const onWheel = (e: WheelEvent) => {
            if (e.ctrlKey) {
                e.preventDefault()
                const factor = e.deltaY > 0 ? 0.95 : 1.05
                const next = clamp(zoomLiveRef.current * factor, 0.5, 5)
                zoomLiveRef.current = next
                zoomTo(next)
            }
        }
        el.addEventListener('wheel', onWheel, { passive: false })
        return () => el.removeEventListener('wheel', onWheel)
    }, [zoomTo])

    // iOS высоты, ре-лайаут
    useEffect(() => {
        const fix = () => {
            if (containerRef.current) {
                containerRef.current.style.transform = 'translateZ(0)'
                requestAnimationFrame(() => {
                    if (containerRef.current)
                        containerRef.current.style.transform = ''
                })
            }
        }
        window.addEventListener('orientationchange', fix)
        window.addEventListener('resize', fix)
        return () => {
            window.removeEventListener('orientationchange', fix)
            window.removeEventListener('resize', fix)
        }
    }, [])

    // === postMessage приём
    useEffect(() => {
        const initialFromAttrs = readShareConfigFromIframeAttrs()
        if (initialFromAttrs)
            setShareConfig((prev) => ({ ...initialFromAttrs, ...prev }))

        const onMsg = (e: MessageEvent) => {
            const data = e.data || {}

            if (data.type === 'pdf-url' && typeof data.payload === 'string') {
                const name =
                    typeof data.name === 'string'
                        ? data.name
                        : guessNameFromUrl(data.payload)
                setDownloadName(ensurePdfExt(sanitizeFileName(name)))
                setFileBlob(null)
                setFileUrl((prev) => {
                    if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev)
                    return data.payload
                })
            }

            if (data.type === 'pdf-bytes') {
                const p = data.payload
                if (
                    p instanceof ArrayBuffer ||
                    (p && typeof p.buffer === 'object')
                ) {
                    const ab: ArrayBuffer =
                        p instanceof ArrayBuffer ? p : p.buffer
                    const blob = new Blob([ab], { type: 'application/pdf' })
                    const name =
                        typeof data.name === 'string'
                            ? data.name
                            : 'document.pdf'
                    const url = URL.createObjectURL(blob)
                    setDownloadName(ensurePdfExt(sanitizeFileName(name)))
                    setFileBlob(blob)
                    setFileUrl((prev) => {
                        if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev)
                        return url
                    })
                }
            }

            if (data.type === 'pdf-blob' && data.payload) {
                const blob: Blob = data.payload
                const name =
                    typeof data.name === 'string'
                        ? data.name
                        : (blob as any).name || 'document.pdf'
                const url = URL.createObjectURL(blob)
                setDownloadName(ensurePdfExt(sanitizeFileName(name)))
                setFileBlob(blob)
                setFileUrl((prev) => {
                    if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev)
                    return url
                })
            }

            if (data.type === 'clear-pdf') {
                setDownloadName('document.pdf')
                setFileBlob(null)
                setFileUrl((prev) => {
                    if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev)
                    return null
                })
            }

            if (
                data.type === 'share-link' &&
                typeof data.payload === 'string'
            ) {
                setShareUrl(data.payload)
            }

            if (
                data.type === 'share-config' &&
                data.payload &&
                typeof data.payload === 'object'
            ) {
                const cfg = data.payload as ShareConfig
                setShareConfig((prev) => ({ ...(prev || {}), ...cfg }))
            }
        }

        window.addEventListener('message', onMsg)
        window.parent?.postMessage({ type: 'viewer-ready' }, '*')
        return () => window.removeEventListener('message', onMsg)
    }, [])

    // local loader
    const pick = () => inputRef.current?.click()
    const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0]
        if (!f) return
        const url = URL.createObjectURL(f)
        setDownloadName(
            ensurePdfExt(sanitizeFileName(f.name || 'document.pdf'))
        )
        setFileBlob(f)
        setFileUrl((prev) => {
            if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev)
            return url
        })
    }

    const handleShare = useCallback(async () => {
        try {
            let url = shareUrl
            if (!url) {
                if (!shareConfig) {
                    alert(
                        'Нет готовой ссылки и не передан конфиг для генерации. Передайте `share-link` или `share-config` в iframe.'
                    )
                    return
                }
                url = await generateShareLink(shareConfig)
                setShareUrl(url)
            }
            await navigator.clipboard.writeText(url)
            alert('Ссылка скопирована в буфер обмена!')
        } catch (e: any) {
            console.error('[share] error:', e)
            alert(`Не удалось получить/скопировать ссылку: ${e?.message || e}`)
        }
    }, [shareUrl, shareConfig])

    const ios = isIosLike()

    return (
        <div
            ref={containerRef}
            className={`relative ${cssFullscreen ? 'fullscreen-css' : ''}`}
            style={{
                width: '100vw',
                height: '100dvh',
                // Ключевой момент: для Android даём полный контроль над gesture через Pointer Events
                // (не даём странице забирать пинч). На iOS оставляем 'manipulation', чтобы не ломать жесты Safari.
                touchAction: ios ? 'manipulation' : 'none',
            }}
        >
            <div
                className='pointer-events-auto absolute right-2 top-2 z-50 flex flex-col items-center gap-1 p-1 rounded-xl bg-white/65 backdrop-blur shadow-sm'
                style={{
                    // чтобы кнопки не упирались в "чёлку"/индикатор iOS
                    paddingTop: 'calc(env(safe-area-inset-top, 0) + 8px)',
                }}
            >
                <button
                    onClick={handleDownload}
                    className='outline-none flex items-center justify-center rounded-lg outline outline-blue-300 p-1 text-sm hover:outline-1 w-12 h-12 max-sm:w-7 max-sm:h-7'
                    title={`Скачать: ${downloadName}`}
                >
                    <div className='flex items-center scale-[0.7] max-sm:scale-[0.4]'>
                        <DownloadIcon fill='white' />
                    </div>
                </button>
                <button
                    onClick={handleShare}
                    className='outline-none flex items-center justify-center rounded-lg outline outline-blue-300 p-1 text-sm hover:outline-1 w-12 h-12 max-sm:w-7 max-sm:h-7'
                    title='Поделиться'
                >
                    <div className='scale-[0.7] max-sm:scale-[0.4]'>
                        <ShareIcon fill='white' />
                    </div>
                </button>

                {/* Полный экран */}
                <button
                    onClick={() =>
                        cssFullscreen || isFullscreen
                            ? exitFullscreen()
                            : enterFullscreen()
                    }
                    className='outline-none flex items-center justify-center rounded-lg outline outline-blue-300 p-1 text-sm hover:outline-1 w-12 h-12 max-sm:w-7 max-sm:h-7'
                    title={
                        cssFullscreen || isFullscreen
                            ? 'Выйти из полноэкранного'
                            : 'Во весь экран'
                    }
                >
                    <div className='scale-[0.7] max-sm:scale-[0.4]'>
                        {cssFullscreen || isFullscreen ? (
                            <NormalScIcon fill='white' />
                        ) : (
                            <FullScIcon fill='white' />
                        )}
                    </div>
                </button>
            </div>

            {!fileUrl ? (
                <div
                    style={{
                        height: '100%',
                        display: 'grid',
                        placeItems: 'center',
                        gap: 12,
                    }}
                >
                    <button
                        onClick={pick}
                        className='px-4 py-2 rounded-xl border shadow-sm'
                    >
                        Открыть PDF
                    </button>
                    <input
                        ref={inputRef}
                        type='file'
                        accept='application/pdf'
                        className='hidden'
                        onChange={onChange}
                    />
                    <div className='text-sm text-gray-500'>
                        или пришлите PDF в этот iframe через postMessage
                    </div>
                </div>
            ) : (
                <Worker workerUrl={workerUrl}>
                    <Viewer
                        fileUrl={fileUrl}
                        plugins={[search, layout]} // порядок важен: search -> layout
                        defaultScale={SpecialZoomLevel.PageWidth}
                    />
                </Worker>
            )}
        </div>
    )
}

export default App
