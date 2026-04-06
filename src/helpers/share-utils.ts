// src/share-utils.ts
export type ShareScope = 'project' | 'doc'

export interface ShareConfig {
    scope?: ShareScope
    projectId?: string | number
    userId?: string | number
    docId?: string | number
    guestTokenEndpoint?: string

    sharePathProject?: string // например: '/ru/pages-standard/document_viewer/'
    sharePathDoc?: string // например: '/ru/pages-standard/document_share/'

    targetOrigin?: string
}

export function readShareConfigFromIframeAttrs(): ShareConfig | undefined {
    const el = window.frameElement as
        | (HTMLIFrameElement & { dataset?: DOMStringMap })
        | null
    if (!el || !('dataset' in el)) return
    const d = (el as any).dataset as DOMStringMap

    const cfg: ShareConfig = {
        scope: (d.shareScope as ShareScope) || 'project',
        projectId: d.shareProjectId,
        userId: d.shareUserId,
        docId: d.shareDocId,
        guestTokenEndpoint: d.shareGuestTokenEndpoint,
        sharePathProject:
            d.sharePathProject || '/ru/pages-standard/document_viewer/',
        sharePathDoc: d.sharePathDoc || '/ru/pages-standard/document_share/',
        targetOrigin: d.targetOrigin,
    }
    return cfg
}

// src/share-utils.ts
export async function generateShareLink(
    baseConfig: ShareConfig
): Promise<string> {
    const origin = window.location.origin
    const scope = baseConfig.scope || 'project'

    const sharePathProject =
        baseConfig.sharePathProject || '/ru/pages-standard/document_viewer/'
    const sharePathDoc =
        baseConfig.sharePathDoc || '/ru/pages-standard/document_share/'

    const projectId = baseConfig.projectId
    const userId = baseConfig.userId
    if (!projectId || !userId) {
        throw new Error(
            '[share] projectId и userId обязательны для получения guest token'
        )
    }

    const endpoint = baseConfig.guestTokenEndpoint
        ? baseConfig.guestTokenEndpoint
        : `${origin}/pilot_doc/get_guest_url/${projectId}/${userId}/`

    const res = await fetch(endpoint, {
        method: 'GET',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
    })
    if (!res.ok) {
        throw new Error(
            `[share] Ошибка запроса токена: ${res.status} ${res.statusText}`
        )
    }

    const data = await res.json()
    const rawToken: string | undefined = data?.token
    if (!rawToken) throw new Error('[share] В ответе нет token')

    // тут отличие: НЕ кодируем, просто вставляем
    if (scope === 'doc') {
        const docId = baseConfig.docId
        if (!docId) throw new Error('[share] docId обязателен при scope="doc"')
        return `${origin}${sharePathDoc}?token=${rawToken}&id=${encodeURIComponent(
            String(docId)
        )}`
    } else {
        return `${origin}${sharePathProject}?token=${rawToken}`
    }
}
