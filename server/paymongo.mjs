import { createHmac, timingSafeEqual } from 'node:crypto'

export class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export function normalizeAppBaseUrl(value) {
  const configuredUrl = String(value || 'http://localhost:5173').trim()
  const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(configuredUrl) ? configuredUrl : `https://${configuredUrl}`)
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('APP_BASE_URL must use HTTP or HTTPS.')
  }
  return url.origin
}

export function getPaymentConfig(env) {
  if ((env.PAYMENT_ENVIRONMENT || 'test') !== 'test') {
    throw new Error('PrintHub only supports PayMongo test mode. PAYMENT_ENVIRONMENT must be "test".')
  }

  const secretKey = env.PAYMONGO_SECRET_KEY || ''
  if (secretKey && !secretKey.startsWith('sk_test_')) {
    throw new Error('PrintHub only accepts PayMongo test secret keys (sk_test_...).')
  }

  const publicKey = env.PAYMONGO_PUBLIC_KEY || ''
  if (publicKey && !publicKey.startsWith('pk_test_')) {
    throw new Error('PrintHub only accepts PayMongo test public keys (pk_test_...).')
  }

  return {
    environment: 'test',
    secretKey,
    publicKey,
    webhookSecret: env.PAYMONGO_WEBHOOK_SECRET || '',
    appBaseUrl: normalizeAppBaseUrl(env.APP_BASE_URL),
  }
}

export function assertTestModeSession(session) {
  if (session?.data?.attributes?.livemode !== false) {
    throw new HttpError(502, 'PayMongo did not return a test-mode checkout session.')
  }
  return session.data
}

export function createWebhookSignature(rawBody, secret, timestamp) {
  return createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex')
}

export function verifyWebhookSignature(rawBody, header, secret, now = Date.now()) {
  if (typeof header !== 'string' || !secret) return false
  const parts = Object.fromEntries(
    header.split(',').map((part) => {
      const separator = part.indexOf('=')
      return separator < 0
        ? ['', '']
        : [part.slice(0, separator).trim(), part.slice(separator + 1).trim()]
    }),
  )
  const timestamp = parts.t
  const signature = parts.te
  const seconds = Number(timestamp)
  if (!timestamp || !signature || !Number.isSafeInteger(seconds)) return false
  if (Math.abs(Math.floor(now / 1000) - seconds) > 300) return false

  const expected = createWebhookSignature(rawBody, secret, timestamp)
  const providedBuffer = Buffer.from(signature, 'hex')
  const expectedBuffer = Buffer.from(expected, 'hex')
  return providedBuffer.length === expectedBuffer.length
    && timingSafeEqual(providedBuffer, expectedBuffer)
}

export async function paymongoRequest(path, { method = 'GET', body, secretKey } = {}, fetchImpl = fetch) {
  if (!secretKey?.startsWith('sk_test_')) {
    throw new HttpError(503, 'PayMongo test-mode checkout is not configured. Set PAYMONGO_SECRET_KEY to an sk_test_ key.')
  }
  let response
  try {
    response = await fetchImpl(`https://api.paymongo.com/v2${path}`, {
      method,
      headers: {
        Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(15000),
    })
  } catch (error) {
    console.error('PayMongo API request failed:', error instanceof Error ? error.message : 'network error')
    throw new HttpError(502, 'Unable to reach PayMongo. Please try again.')
  }

  let json
  try {
    json = await response.json()
  } catch {
    throw new HttpError(502, 'PayMongo returned an invalid response.')
  }
  if (!response.ok) {
    console.error('PayMongo API rejected the request:', response.status, JSON.stringify(json?.errors ?? []).slice(0, 1000))
    throw new HttpError(502, 'PayMongo could not process this request. Please try again.')
  }
  return json
}

export function paidGcashPayment(session, expectedAmount) {
  const data = session?.data ?? session
  const attributes = data?.attributes
  if (!attributes || attributes.livemode !== false) return null
  const payments = Array.isArray(attributes.payments) ? attributes.payments : []
  return payments.find((payment) => {
    const details = payment?.attributes
    return details?.status === 'paid'
      && details?.currency?.toUpperCase() === 'PHP'
      && Number(details?.amount) === expectedAmount
      && (details?.source?.type === 'gcash' || details?.payment_method_type === 'gcash')
  }) ?? null
}
