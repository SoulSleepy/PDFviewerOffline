import workerSource from 'pdfjs-dist/build/pdf.worker.min.js?raw'

let cachedUrl: string | null = null

export function getInlinePdfWorkerUrl() {
    if (!cachedUrl) {
        const blob = new Blob([workerSource], { type: 'text/javascript' })
        cachedUrl = URL.createObjectURL(blob)
    }
    return cachedUrl
}

export function revokeInlinePdfWorkerUrl() {
    if (cachedUrl) {
        URL.revokeObjectURL(cachedUrl)
        cachedUrl = null
    }
}
