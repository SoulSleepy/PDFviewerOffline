import '@react-pdf-viewer/core/lib/styles/index.css'
import '@react-pdf-viewer/default-layout/lib/styles/index.css'

import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react'
import { Worker, Viewer, SpecialZoomLevel } from '@react-pdf-viewer/core'
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout'
import { zoomPlugin } from '@react-pdf-viewer/zoom'

import {
    getInlinePdfWorkerUrl,
    revokeInlinePdfWorkerUrl,
} from './helpers/pdf-worker-inline'

import { DownloadIcon, FullScreenIcon, ShrinkScreenIcon } from './Icons/Icons'

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

const isIosLike = () => {
    const ua = navigator.userAgent || ''
    return (
        /iPad|iPhone|iPod/.test(ua) ||
        (ua.includes('Mac') && 'ontouchend' in document)
    )
}

const inIframe = () => {
    try {
        return window.top !== window.self
    } catch {
        return true
    }
}

const clamp = (v: number, min: number, max: number) =>
    Math.max(min, Math.min(max, v))

const App: React.FC = () => {
    const [fileUrl, setFileUrl] = useState<string | null>(null)
    const [fileBlob, setFileBlob] = useState<Blob | null>(null)
    const [downloadName, setDownloadName] = useState<string>('document.pdf')
    const inputRef = useRef<HTMLInputElement>(null)

    const containerRef = useRef<HTMLDivElement>(null)
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [cssFullscreen, setCssFullscreen] = useState(false)

    const zoomBaseRef = useRef<number>(1)
    const zoomLiveRef = useRef<number>(1)
    const zoomTargetRef = useRef<number>(1)
    const zoomRafRef = useRef<number | null>(null)
    const viewerHostRef = useRef<HTMLDivElement>(null)
    const isDraggingRef = useRef(false)
    const dragStateRef = useRef({
        startX: 0,
        startY: 0,
        startScrollLeft: 0,
        startScrollTop: 0,
    })

    const zoom = zoomPlugin()
    const { zoomTo } = zoom

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
                        <div className='flex items-center gap-2 border-b bg-white px-2 py-1'>
                            <ZoomOut />
                            <Zoom />
                            <ZoomIn />

                            <div className='mx-2 h-6 w-px bg-gray-200' />

                            <div className='flex items-center gap-1 text-black'>
                                <CurrentPageInput />
                                <div className='text-sm text-gray-500'>/</div>
                                <NumberOfPages />
                            </div>
                        </div>
                    )
                }}
            </Toolbar>
        ),
    })

    const getScrollContainer = useCallback((): HTMLElement | null => {
    const host = viewerHostRef.current
    if (!host) return null

    return (host.querySelector('[data-testid="core__inner-pages"]') ||
        host.querySelector('.rpv-core__inner-pages') ||
        host.querySelector('.rpv-core__viewer') ||
        host.firstElementChild) as HTMLElement | null
}, [])

    const workerUrl = useMemo(() => getInlinePdfWorkerUrl(), [])

    useEffect(() => {
        return () => {
            revokeInlinePdfWorkerUrl()

            if (zoomRafRef.current) {
                cancelAnimationFrame(zoomRafRef.current)
            }
        }
    }, [workerUrl])

    useEffect(() => {
        const host = viewerHostRef.current
        if (!host) return

        const getInteractiveTarget = (target: EventTarget | null) => {
            if (!(target instanceof HTMLElement)) return null

            return target.closest(
                'input, textarea, button, select, a, [role="button"], .rpv-default-layout__toolbar, .rpv-core__button',
            )
        }

        const onMouseDown = (e: MouseEvent) => {
            if (e.button !== 0) return
            if (getInteractiveTarget(e.target)) return

            const scroller = getScrollContainer()
            if (!scroller) return

            const canPanX = scroller.scrollWidth > scroller.clientWidth
            const canPanY = scroller.scrollHeight > scroller.clientHeight

            if (!canPanX && !canPanY) return

            isDraggingRef.current = true
            dragStateRef.current = {
                startX: e.clientX,
                startY: e.clientY,
                startScrollLeft: scroller.scrollLeft,
                startScrollTop: scroller.scrollTop,
            }

            host.style.cursor = 'grabbing'
            document.body.style.userSelect = 'none'
        }

        const onMouseMove = (e: MouseEvent) => {
            if (!isDraggingRef.current) return

            const scroller = getScrollContainer()
            if (!scroller) return

            const dx = e.clientX - dragStateRef.current.startX
            const dy = e.clientY - dragStateRef.current.startY

            scroller.scrollLeft = dragStateRef.current.startScrollLeft - dx
            scroller.scrollTop = dragStateRef.current.startScrollTop - dy
        }

        const stopDragging = () => {
            if (!isDraggingRef.current) return

            isDraggingRef.current = false
            document.body.style.userSelect = ''
        }

        host.addEventListener('mousedown', onMouseDown)
        window.addEventListener('mousemove', onMouseMove)
        window.addEventListener('mouseup', stopDragging)
        window.addEventListener('mouseleave', stopDragging)

        return () => {
            host.removeEventListener('mousedown', onMouseDown)
            window.removeEventListener('mousemove', onMouseMove)
            window.removeEventListener('mouseup', stopDragging)
            window.removeEventListener('mouseleave', stopDragging)

            document.body.style.userSelect = ''
        }
    }, [getScrollContainer, fileUrl])

    const suggestDownloadName = useCallback(async (): Promise<string> => {
        let name =
            downloadName ||
            ((fileBlob as (Blob & { name?: string }) | null)?.name ??
                undefined) ||
            (fileUrl ? guessNameFromUrl(fileUrl) : 'document.pdf')

        name = ensurePdfExt(sanitizeFileName(name))

        if (!fileBlob && fileUrl && !fileUrl.startsWith('blob:')) {
            try {
                const res = await fetch(fileUrl, { method: 'HEAD' })
                const cd = res.headers.get('content-disposition')

                if (cd) {
                    const match =
                        /filename\*=UTF-8''([^;]+)|filename="?([^"]+)"?/i.exec(
                            cd,
                        )
                    const raw = decodeURIComponent(
                        match?.[1] || match?.[2] || '',
                    )

                    if (raw) {
                        name = ensurePdfExt(sanitizeFileName(raw))
                    }
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

    useEffect(() => {
        const onFsChange = () => {
            const fsElement =
                document.fullscreenElement ||
                (document as Document & { webkitFullscreenElement?: Element })
                    .webkitFullscreenElement ||
                (document as Document & { mozFullScreenElement?: Element })
                    .mozFullScreenElement ||
                (document as Document & { msFullscreenElement?: Element })
                    .msFullscreenElement

            setIsFullscreen(Boolean(fsElement))
        }

        document.addEventListener('fullscreenchange', onFsChange)
        document.addEventListener(
            'webkitfullscreenchange',
            onFsChange as EventListener,
        )
        document.addEventListener(
            'mozfullscreenchange',
            onFsChange as EventListener,
        )
        document.addEventListener(
            'MSFullscreenChange',
            onFsChange as EventListener,
        )

        return () => {
            document.removeEventListener('fullscreenchange', onFsChange)
            document.removeEventListener(
                'webkitfullscreenchange',
                onFsChange as EventListener,
            )
            document.removeEventListener(
                'mozfullscreenchange',
                onFsChange as EventListener,
            )
            document.removeEventListener(
                'MSFullscreenChange',
                onFsChange as EventListener,
            )
        }
    }, [])

    useEffect(() => {
        const cls = 'body-no-scroll'

        if (cssFullscreen && !inIframe()) {
            document.body.classList.add(cls)
        } else {
            document.body.classList.remove(cls)
        }

        return () => document.body.classList.remove(cls)
    }, [cssFullscreen])

    useEffect(() => {
        const onMsg = (e: MessageEvent) => {
            const data = e.data || {}

            if (data.type === 'pdfviewer:fs-changed') {
                const state = data.payload || {}
                setCssFullscreen(!!state.css)
                setIsFullscreen(!!state.native)
            }
        }

        window.addEventListener('message', onMsg)
        return () => window.removeEventListener('message', onMsg)
    }, [])

    const enterFullscreen = useCallback(async () => {
        const el = containerRef.current
        if (!el) return

        if (inIframe()) {
            window.parent?.postMessage({ type: 'pdfviewer:enter-fs' }, '*')
            return
        }

        const target = el as HTMLDivElement & {
            webkitRequestFullscreen?: () => Promise<void>
            mozRequestFullScreen?: () => Promise<void>
            msRequestFullscreen?: () => Promise<void>
        }

        try {
            if (el.requestFullscreen) await el.requestFullscreen()
            else if (target.webkitRequestFullscreen)
                await target.webkitRequestFullscreen()
            else if (target.mozRequestFullScreen)
                await target.mozRequestFullScreen()
            else if (target.msRequestFullscreen)
                await target.msRequestFullscreen()
            else setCssFullscreen(true)
        } catch {
            setCssFullscreen(true)
        }
    }, [])

    const exitFullscreen = useCallback(async () => {
        if (inIframe()) {
            window.parent?.postMessage({ type: 'pdfviewer:exit-fs' }, '*')
            return
        }

        if (cssFullscreen) {
            setCssFullscreen(false)
            return
        }

        const doc = document as Document & {
            webkitExitFullscreen?: () => Promise<void>
            mozCancelFullScreen?: () => Promise<void>
            msExitFullscreen?: () => Promise<void>
        }

        try {
            if (document.exitFullscreen) await document.exitFullscreen()
            else if (doc.webkitExitFullscreen) await doc.webkitExitFullscreen()
            else if (doc.mozCancelFullScreen) await doc.mozCancelFullScreen()
            else if (doc.msExitFullscreen) await doc.msExitFullscreen()
        } catch {}
    }, [cssFullscreen])

    useEffect(() => {
        const el = containerRef.current
        if (!el || !isIosLike()) return

        const stopZoomAnimation = () => {
            if (zoomRafRef.current) {
                cancelAnimationFrame(zoomRafRef.current)
                zoomRafRef.current = null
            }
        }

        const animateZoom = () => {
            const current = zoomLiveRef.current
            const target = zoomTargetRef.current
            const diff = target - current

            if (Math.abs(diff) < 0.01) {
                zoomLiveRef.current = target
                try {
                    zoomTo(target)
                } catch {}
                zoomRafRef.current = null
                return
            }

            const next = current + diff * 0.22
            zoomLiveRef.current = next

            try {
                zoomTo(next)
            } catch {}

            zoomRafRef.current = requestAnimationFrame(animateZoom)
        }

        const onGestureStart = (e: Event) => {
            const gestureEvent = e as Event & { scale?: number }
            gestureEvent.preventDefault?.()

            stopZoomAnimation()
            zoomBaseRef.current = zoomLiveRef.current
            zoomTargetRef.current = zoomLiveRef.current
        }

        const onGestureChange = (e: Event) => {
            const gestureEvent = e as Event & { scale?: number }
            gestureEvent.preventDefault?.()

            const next = clamp(
                zoomBaseRef.current * (gestureEvent.scale || 1),
                0.5,
                5,
            )

            zoomTargetRef.current = next

            if (!zoomRafRef.current) {
                zoomRafRef.current = requestAnimationFrame(animateZoom)
            }
        }

        const onGestureEnd = (e: Event) => {
            e.preventDefault?.()

            if (!zoomRafRef.current) {
                zoomRafRef.current = requestAnimationFrame(animateZoom)
            }
        }

        el.addEventListener('gesturestart', onGestureStart, { passive: false })
        el.addEventListener('gesturechange', onGestureChange, {
            passive: false,
        })
        el.addEventListener('gestureend', onGestureEnd, { passive: false })

        return () => {
            stopZoomAnimation()
            el.removeEventListener('gesturestart', onGestureStart)
            el.removeEventListener('gesturechange', onGestureChange)
            el.removeEventListener('gestureend', onGestureEnd)
        }
    }, [zoomTo])

    useEffect(() => {
        const fix = () => {
            if (!containerRef.current) return

            containerRef.current.style.transform = 'translateZ(0)'

            requestAnimationFrame(() => {
                if (containerRef.current) {
                    containerRef.current.style.transform = ''
                }
            })
        }

        window.addEventListener('orientationchange', fix)
        window.addEventListener('resize', fix)

        return () => {
            window.removeEventListener('orientationchange', fix)
            window.removeEventListener('resize', fix)
        }
    }, [])

    useEffect(() => {
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
                    if (prev?.startsWith('blob:')) {
                        URL.revokeObjectURL(prev)
                    }
                    return data.payload
                })
            }

            if (data.type === 'pdf-bytes') {
                const payload = data.payload

                if (
                    payload instanceof ArrayBuffer ||
                    (payload && typeof payload.buffer === 'object')
                ) {
                    const ab: ArrayBuffer =
                        payload instanceof ArrayBuffer
                            ? payload
                            : payload.buffer

                    const blob = new Blob([ab], { type: 'application/pdf' })
                    const name =
                        typeof data.name === 'string'
                            ? data.name
                            : 'document.pdf'
                    const url = URL.createObjectURL(blob)

                    setDownloadName(ensurePdfExt(sanitizeFileName(name)))
                    setFileBlob(blob)

                    setFileUrl((prev) => {
                        if (prev?.startsWith('blob:')) {
                            URL.revokeObjectURL(prev)
                        }
                        return url
                    })
                }
            }

            if (data.type === 'pdf-blob' && data.payload) {
                const blob = data.payload as Blob
                const name =
                    typeof data.name === 'string'
                        ? data.name
                        : ((blob as Blob & { name?: string }).name ??
                          'document.pdf')
                const url = URL.createObjectURL(blob)

                setDownloadName(ensurePdfExt(sanitizeFileName(name)))
                setFileBlob(blob)

                setFileUrl((prev) => {
                    if (prev?.startsWith('blob:')) {
                        URL.revokeObjectURL(prev)
                    }
                    return url
                })
            }

            if (data.type === 'clear-pdf') {
                setDownloadName('document.pdf')
                setFileBlob(null)

                setFileUrl((prev) => {
                    if (prev?.startsWith('blob:')) {
                        URL.revokeObjectURL(prev)
                    }
                    return null
                })
            }
        }

        window.addEventListener('message', onMsg)
        window.parent?.postMessage({ type: 'viewer-ready' }, '*')

        return () => window.removeEventListener('message', onMsg)
    }, [])

    const pick = () => inputRef.current?.click()

    const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const url = URL.createObjectURL(file)

        setDownloadName(
            ensurePdfExt(sanitizeFileName(file.name || 'document.pdf')),
        )
        setFileBlob(file)

        setFileUrl((prev) => {
            if (prev?.startsWith('blob:')) {
                URL.revokeObjectURL(prev)
            }
            return url
        })
    }

    const applyInternalCssFs = cssFullscreen && !inIframe()

    const BtnStyle =
        'flex items-center justify-center rounded-xl bg-white p-1 outline outline-1 outline-[#4C56AF0F] transition duration-200 ease-in-out hover:bg-[#4C56AF0F]'

    return (
        <div
            ref={containerRef}
            className={`relative ${applyInternalCssFs ? 'fullscreen-css' : ''}`}
            style={{ width: '100vw', height: '100dvh' }}
        >
            <div
                className='pointer-events-auto absolute right-2 top-2 z-50 flex flex-col items-center gap-1 rounded-xl bg-[#4c56af2c]/65 p-1 backdrop-blur'
                style={{
                    paddingTop: 'calc(env(safe-area-inset-top, 0) + 4px)',
                }}
            >
                <button
                    onClick={() =>
                        cssFullscreen || isFullscreen
                            ? exitFullscreen()
                            : enterFullscreen()
                    }
                    className={BtnStyle}
                    title={
                        cssFullscreen || isFullscreen
                            ? 'Выйти из полноэкранного'
                            : 'Во весь экран'
                    }
                >
                    {cssFullscreen || isFullscreen ? (
                        <ShrinkScreenIcon fill={'#636c72'} />
                    ) : (
                        <FullScreenIcon fill={'#636c72'} />
                    )}
                </button>
                <button
                    onClick={handleDownload}
                    className={BtnStyle}
                    title={`Скачать: ${downloadName}`}
                >
                    <DownloadIcon fill={'#636c72'} />
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
                        className='rounded-xl border px-4 py-2 shadow-sm text-[#636c72] border-none outline-1 outline-[#4c56af2c]'
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
                    <div
                        ref={viewerHostRef}
                        className='h-full w-full'
                    >
                        <Viewer
                            fileUrl={fileUrl}
                            plugins={[layout, zoom]}
                            defaultScale={SpecialZoomLevel.PageWidth}
                        />
                    </div>
                </Worker>
            )}
        </div>
    )
}

export default App
