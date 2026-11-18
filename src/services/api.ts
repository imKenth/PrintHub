export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    })
  } catch {
    throw new Error('PrintHub server is unavailable. Start the API server and try again.')
  }
  const body = await response.json().catch(() => ({})) as { error?: string } & T
  if (!response.ok) throw new Error(body.error || 'The request could not be completed.')
  return body
}

export async function downloadOrderFile(reference: string, fileName: string) {
  const response = await fetch(`/api/orders/file?reference=${encodeURIComponent(reference)}`, { credentials: 'include' })
  if (!response.ok) throw new Error('You are not authorized to download this order file.')
  const url = URL.createObjectURL(await response.blob())
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        reject(new Error('Could not read the selected file.'))
        return
      }
      resolve(result.slice(result.indexOf(',') + 1))
    }
    reader.onerror = () => reject(new Error('Could not read the selected file.'))
    reader.readAsDataURL(file)
  })
}
