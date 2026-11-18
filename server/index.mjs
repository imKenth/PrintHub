import { createServer } from 'node:http'
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { mkdirSync, readFileSync } from 'node:fs'
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import { ACCEPTED_DOCUMENT_TYPES, ACCEPTED_FILE_TYPES, DEFAULT_PRICING, MAX_FILE_SIZE, PAPER_SIZES, SERVICES } from './shared-data.mjs'
import { assertTestModeSession, getPaymentConfig, HttpError, paidGcashPayment, paymongoRequest, verifyWebhookSignature } from './paymongo.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const envPath = join(root, '.env')
const MAX_BODY_BYTES = 16 * 1024 * 1024
const SESSION_COOKIE = 'printhub_session'

function loadEnvFile() {
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/)
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2')
    }
  }
}

function jsonResponse(response, status, value, headers = {}) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  })
  response.end(JSON.stringify(value))
}

async function readBody(request) {
  let size = 0
  const chunks = []
  for await (const chunk of request) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) throw new HttpError(413, 'Request is too large.')
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

async function readJson(request) {
  let data
  try {
    data = JSON.parse((await readBody(request)).toString('utf8'))
  } catch (error) {
    if (error instanceof HttpError) throw error
    throw new HttpError(400, 'Request body must be valid JSON.')
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new HttpError(400, 'Request body must be a JSON object.')
  }
  return data
}

function contactDigits(value) {
  return String(value ?? '').replace(/\D/g, '')
}

function timingSafeText(left, right) {
  const a = Buffer.from(String(left))
  const b = Buffer.from(String(right))
  return a.length === b.length && timingSafeEqual(a, b)
}

function normalizeOrder(row) {
  return {
    id: row.reference,
    reference: row.reference,
    customerName: row.customer_name,
    contactNumber: row.contact_number,
    email: row.email,
    service: row.service,
    paperSize: row.paper_size,
    color: row.color,
    quantity: row.quantity,
    instructions: row.instructions,
    fileName: row.file_name,
    unitPrice: row.unit_price,
    total: row.total,
    paymentStatus: row.payment_status,
    paymentMethod: row.payment_status === 'Paid' ? 'GCash' : undefined,
    paymentReference: row.payment_id || undefined,
    paidAt: row.paid_at || undefined,
    status: row.status,
    createdAt: row.created_at,
  }
}

function sessionRole(request, db) {
  const cookie = request.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`))
  if (!cookie) return null
  const token = decodeURIComponent(cookie.slice(SESSION_COOKIE.length + 1))
  const digest = createHash('sha256').update(token).digest('hex')
  const session = db.prepare('SELECT role, expires_at FROM staff_sessions WHERE token_hash = ?').get(digest)
  if (!session || session.expires_at <= Date.now()) {
    db.prepare('DELETE FROM staff_sessions WHERE token_hash = ?').run(digest)
    return null
  }
  return session.role
}

function requireStaff(request, db, adminOnly = false) {
  const role = sessionRole(request, db)
  if (!role) throw new HttpError(401, 'Please sign in to access the staff workspace.')
  if (adminOnly && role !== 'Admin') throw new HttpError(403, 'Administrator access is required.')
  return role
}

function checkOrigin(request, env) {
  const origin = request.headers.origin
  if (!origin) return
  const allowed = new URL(env.APP_BASE_URL || 'http://localhost:5173').origin
  if (origin !== allowed) throw new HttpError(403, 'Request origin is not allowed.')
}

function loadPricing(db) {
  return db.prepare('SELECT id, service, paper_size AS paperSize, black_and_white AS blackAndWhite, color, active FROM pricing_rules ORDER BY service, paper_size').all()
    .map((rule) => ({ ...rule, active: Boolean(rule.active) }))
}

function createDatabase(dbPath) {
  mkdirSyncSafe(dirname(dbPath))
  const db = new DatabaseSync(dbPath)
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;')
  db.exec(`
    CREATE TABLE IF NOT EXISTS pricing_rules (
      id TEXT PRIMARY KEY, service TEXT NOT NULL, paper_size TEXT NOT NULL,
      black_and_white REAL NOT NULL, color REAL NOT NULL, active INTEGER NOT NULL,
      UNIQUE(service, paper_size)
    );
    CREATE TABLE IF NOT EXISTS orders (
      reference TEXT PRIMARY KEY, request_id TEXT NOT NULL UNIQUE,
      customer_name TEXT NOT NULL, contact_number TEXT NOT NULL, email TEXT NOT NULL DEFAULT '',
      service TEXT NOT NULL, paper_size TEXT NOT NULL, color TEXT NOT NULL,
      quantity INTEGER NOT NULL, instructions TEXT NOT NULL DEFAULT '', file_name TEXT NOT NULL,
      file_path TEXT NOT NULL, unit_price REAL NOT NULL, total REAL NOT NULL,
      payment_status TEXT NOT NULL DEFAULT 'Unpaid',
      status TEXT NOT NULL DEFAULT 'Pending Payment',
      checkout_session_id TEXT, checkout_url TEXT, payment_id TEXT, paid_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS staff_sessions (
      token_hash TEXT PRIMARY KEY, role TEXT NOT NULL, expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS webhook_events (
      event_id TEXT PRIMARY KEY, processed_at TEXT NOT NULL
    );
  `)
  const insertPrice = db.prepare(`INSERT OR IGNORE INTO pricing_rules
    (id, service, paper_size, black_and_white, color, active) VALUES (?, ?, ?, ?, ?, 1)`)
  db.exec('BEGIN')
  try {
    for (const rule of DEFAULT_PRICING) {
      insertPrice.run(rule.id, rule.service, rule.paperSize, rule.blackAndWhite, rule.color)
    }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    db.close()
    throw error
  }
  return db
}

function mkdirSyncSafe(path) {
  mkdirSync(path, { recursive: true })
}

function validateUpload(file, service) {
  if (!file || typeof file.name !== 'string' || typeof file.base64 !== 'string') {
    throw new HttpError(400, 'Upload a print file.')
  }
  const extension = extname(file.name).toLowerCase()
  const allowed = service === 'Documents' ? ACCEPTED_DOCUMENT_TYPES : ACCEPTED_FILE_TYPES.filter((item) => !ACCEPTED_DOCUMENT_TYPES.includes(item) || item === '.pdf')
  if (!allowed.includes(extension)) throw new HttpError(400, 'This file type is not supported for the selected print service.')
  const content = Buffer.from(file.base64, 'base64')
  if (!content.length || content.length > MAX_FILE_SIZE || content.toString('base64').replace(/=+$/, '') !== file.base64.replace(/=+$/, '')) {
    throw new HttpError(400, 'The uploaded file is empty, invalid, or larger than 10 MB.')
  }
  const validSignature = extension === '.pdf'
    ? content.subarray(0, 5).toString() === '%PDF-'
    : extension === '.png'
      ? content.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : extension === '.jpg' || extension === '.jpeg'
        ? content[0] === 0xff && content[1] === 0xd8
        : extension === '.docx'
          ? content.subarray(0, 2).toString() === 'PK'
          : extension === '.doc'
            ? content.subarray(0, 4).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0]))
            : false
  if (!validSignature) throw new HttpError(400, 'The uploaded file does not match its file type.')
  return { extension, content, fileName: file.name.slice(0, 180) }
}

async function getPdfPageCount(content) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const task = pdfjs.getDocument({ data: new Uint8Array(content), useSystemFonts: false, isEvalSupported: false })
  try {
    const pdf = await task.promise
    return pdf.numPages
  } catch {
    throw new HttpError(400, 'We could not read this PDF. Upload a valid, unprotected PDF.')
  } finally {
    await task.destroy()
  }
}

function checkStaffCredentials(body, env) {
  const email = String(body.email ?? '').trim().toLowerCase()
  const password = String(body.password ?? '')
  if (!email || !password) return null
  const accounts = [
    { email: String(env.ADMIN_EMAIL || '').toLowerCase(), password: String(env.ADMIN_PASSWORD || ''), role: 'Admin' },
    { email: String(env.STAFF_EMAIL || '').toLowerCase(), password: String(env.STAFF_PASSWORD || ''), role: 'Staff' },
  ]
  return accounts.find((account) => account.email && account.password
    && timingSafeText(email, account.email)
    && timingSafeText(password, account.password))?.role ?? null
}

function cookieHeader(token, isProduction) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800${isProduction ? '; Secure' : ''}`
}

function getCustomerOrder(db, reference, contactNumber) {
  const row = db.prepare('SELECT * FROM orders WHERE reference = ?').get(reference)
  if (!row || !timingSafeText(contactDigits(row.contact_number), contactDigits(contactNumber))) {
    throw new HttpError(404, 'No order matches that reference and contact number.')
  }
  return row
}

function applyPaidSession(db, order, session) {
  const paidPayment = paidGcashPayment(session, Math.round(order.total * 100))
  if (!paidPayment) return null
  const paymentId = paidPayment.id
  const paidAt = new Date().toISOString()
  db.prepare(`UPDATE orders SET payment_status = 'Paid', status = 'Paid', payment_id = ?, paid_at = ?
    WHERE reference = ? AND checkout_session_id = ? AND payment_status != 'Paid'`)
    .run(paymentId, paidAt, order.reference, session.id)
  return paidPayment
}

async function syncPaymentStatus(db, order, config, fetchImpl) {
  if (order.payment_status === 'Paid' || !order.checkout_session_id) return order
  const response = await paymongoRequest(`/checkout_sessions/${encodeURIComponent(order.checkout_session_id)}`, {
    secretKey: config.secretKey,
  }, fetchImpl)
  assertTestModeSession(response)
  const session = response.data
  const attributes = session.attributes
  if (attributes.reference_number !== order.reference) throw new HttpError(502, 'Checkout session does not match this order.')
  const payment = paidGcashPayment(session, Math.round(order.total * 100))
  if (payment) {
    const result = applyPaidSession(db, order, session)
    if (result) {
      return db.prepare('SELECT * FROM orders WHERE reference = ?').get(order.reference)
    }
  }
  if (attributes.status === 'expired') {
    db.prepare(`UPDATE orders SET payment_status = 'Expired' WHERE reference = ? AND payment_status != 'Paid'`).run(order.reference)
  } else {
    const payments = Array.isArray(attributes.payments) ? attributes.payments : []
    if (payments.some((item) => item?.attributes?.status === 'failed')) {
      db.prepare(`UPDATE orders SET payment_status = 'Failed' WHERE reference = ? AND payment_status != 'Paid'`).run(order.reference)
    } else {
      db.prepare(`UPDATE orders SET payment_status = 'Pending' WHERE reference = ? AND payment_status != 'Paid'`).run(order.reference)
    }
  }
  return db.prepare('SELECT * FROM orders WHERE reference = ?').get(order.reference)
}

export function createPrintHubServer({
  env = process.env,
  dbPath = join(root, 'server', 'data', 'printhub.sqlite'),
  uploadsDir = join(root, 'server', 'data', 'uploads'),
  fetchImpl = fetch,
} = {}) {
  const paymentConfig = getPaymentConfig(env)
  const db = createDatabase(dbPath)
  const origin = new URL(env.APP_BASE_URL || 'http://localhost:5173').origin
  const isProduction = env.NODE_ENV === 'production'

  const server = createServer(async (request, response) => {
    let url
    try {
      url = new URL(request.url, `http://${request.headers.host || 'localhost'}`)
      const path = url.pathname
      const method = request.method

      if (method === 'OPTIONS') {
        response.writeHead(204, {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Vary': 'Origin',
        })
        response.end()
        return
      }

      if (method === 'GET' && path === '/api/health') {
        jsonResponse(response, 200, { ok: true, paymentEnvironment: paymentConfig.environment })
        return
      }

      if (method === 'GET' && path === '/api/pricing') {
        jsonResponse(response, 200, { pricing: loadPricing(db) })
        return
      }

      if (method === 'POST' && path === '/api/staff/login') {
        checkOrigin(request, env)
        const role = checkStaffCredentials(await readJson(request), env)
        if (!role) throw new HttpError(401, 'Email or password is incorrect.')
        const token = randomBytes(32).toString('base64url')
        db.prepare('INSERT INTO staff_sessions (token_hash, role, expires_at) VALUES (?, ?, ?)')
          .run(createHash('sha256').update(token).digest('hex'), role, Date.now() + 8 * 60 * 60 * 1000)
        jsonResponse(response, 200, { user: { email: role === 'Admin' ? env.ADMIN_EMAIL : env.STAFF_EMAIL, name: role === 'Admin' ? 'PrintHub Admin' : 'PrintHub Staff', role } }, {
          'Set-Cookie': cookieHeader(token, isProduction),
        })
        return
      }

      if (method === 'GET' && path === '/api/staff/session') {
        const role = sessionRole(request, db)
        jsonResponse(response, 200, { user: role ? { role } : null })
        return
      }

      if (method === 'POST' && path === '/api/staff/logout') {
        checkOrigin(request, env)
        const cookie = request.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`))
        if (cookie) db.prepare('DELETE FROM staff_sessions WHERE token_hash = ?')
          .run(createHash('sha256').update(decodeURIComponent(cookie.slice(SESSION_COOKIE.length + 1))).digest('hex'))
        jsonResponse(response, 200, { ok: true }, { 'Set-Cookie': `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isProduction ? '; Secure' : ''}` })
        return
      }

      if (method === 'POST' && path === '/api/orders') {
        checkOrigin(request, env)
        const body = await readJson(request)
        const requestId = String(body.requestId ?? '')
        if (!/^[0-9a-f-]{36}$/i.test(requestId)) throw new HttpError(400, 'A valid order request ID is required.')
        const existing = db.prepare('SELECT * FROM orders WHERE request_id = ?').get(requestId)
        if (existing) {
          if (!timingSafeText(contactDigits(existing.contact_number), contactDigits(body.contactNumber))) {
            throw new HttpError(409, 'This order request ID is already in use.')
          }
          jsonResponse(response, 200, { order: normalizeOrder(existing) })
          return
        }
        const customerName = String(body.customerName ?? '').trim().slice(0, 120)
        const contactNumber = String(body.contactNumber ?? '').trim().slice(0, 40)
        const email = String(body.email ?? '').trim().slice(0, 254)
        const service = String(body.service ?? '')
        const paperSize = String(body.paperSize ?? '')
        const color = String(body.color ?? '')
        let quantity = Number(body.quantity)
        if (customerName.length < 2) throw new HttpError(400, 'Enter a valid customer name.')
        if (contactDigits(contactNumber).length < 7 || contactDigits(contactNumber).length > 15) throw new HttpError(400, 'Enter a valid contact number.')
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Enter a valid email address.')
        if (!SERVICES.includes(service) || !PAPER_SIZES.includes(paperSize) || !['Black & White', 'Color'].includes(color)) throw new HttpError(400, 'Choose valid print specifications.')
        const upload = validateUpload(body.file, service)
        if (service === 'Documents' && upload.extension === '.pdf') {
          quantity = await getPdfPageCount(upload.content)
        }
        if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 500) throw new HttpError(400, 'Order quantity must be between 1 and 500.')
        const rule = db.prepare('SELECT * FROM pricing_rules WHERE service = ? AND paper_size = ? AND active = 1').get(service, paperSize)
        if (!rule) throw new HttpError(400, 'This printing option is currently unavailable.')
        const unitPrice = color === 'Color' ? rule.color : rule.black_and_white
        const total = Math.round(unitPrice * quantity * 100) / 100
        if (!Number.isFinite(body.acceptedTotal) || Math.round(Number(body.acceptedTotal) * 100) !== Math.round(total * 100)) {
          throw new HttpError(409, 'The final price changed. Review the current price and accept it before submitting.')
        }
        const reference = `PH-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`
        const filename = `${randomUUID()}${upload.extension}`
        const filePath = join(uploadsDir, filename)
        await mkdir(uploadsDir, { recursive: true })
        await writeFile(filePath, upload.content, { flag: 'wx', mode: 0o600 })
        try {
          db.prepare(`INSERT INTO orders
            (reference, request_id, customer_name, contact_number, email, service, paper_size, color,
             quantity, instructions, file_name, file_path, unit_price, total, payment_status, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Unpaid', 'Pending Payment', ?)`)
            .run(reference, requestId, customerName, contactNumber, email, service, paperSize, color,
              quantity, String(body.instructions ?? '').slice(0, 1000), upload.fileName, filePath, unitPrice, total, new Date().toISOString())
        } catch (error) {
          await unlink(filePath).catch(() => {})
          if (String(error).includes('request_id')) {
            const duplicate = db.prepare('SELECT * FROM orders WHERE request_id = ?').get(requestId)
            if (duplicate) {
              jsonResponse(response, 200, { order: normalizeOrder(duplicate) })
              return
            }
          }
          throw error
        }
        const saved = db.prepare('SELECT * FROM orders WHERE reference = ?').get(reference)
        jsonResponse(response, 201, { order: normalizeOrder(saved) })
        return
      }

      if (method === 'POST' && path === '/api/payments/checkout') {
        checkOrigin(request, env)
        const body = await readJson(request)
        const order = getCustomerOrder(db, String(body.reference ?? ''), body.contactNumber)
        if (order.payment_status === 'Paid' || order.status !== 'Pending Payment') throw new HttpError(409, 'This order is not eligible for payment.')
        if (!paymentConfig.secretKey) throw new HttpError(503, 'PayMongo test checkout is not configured yet.')
        if (order.checkout_session_id && ['Pending', 'Failed'].includes(order.payment_status)) {
          try {
            const oldSession = await paymongoRequest(`/checkout_sessions/${encodeURIComponent(order.checkout_session_id)}`, {
              secretKey: paymentConfig.secretKey,
            }, fetchImpl)
            assertTestModeSession(oldSession)
            if (oldSession.data.attributes.status === 'active') {
              const checkoutUrl = oldSession.data.attributes.checkout_url
              if (!checkoutUrl || new URL(checkoutUrl).hostname !== 'checkout.paymongo.com') throw new HttpError(502, 'PayMongo returned an invalid checkout URL.')
              jsonResponse(response, 200, { checkoutUrl, order: normalizeOrder(order) })
              return
            }
          } catch (error) {
            if (error instanceof HttpError && error.status < 500) throw error
          }
        }
        if (order.checkout_session_id) {
          const previous = await paymongoRequest(`/checkout_sessions/${encodeURIComponent(order.checkout_session_id)}`, {
            secretKey: paymentConfig.secretKey,
          }, fetchImpl)
          assertTestModeSession(previous)
          if (paidGcashPayment(previous.data, Math.round(order.total * 100))) {
            applyPaidSession(db, order, previous.data)
            throw new HttpError(409, 'This order has already been paid.')
          }
          if (previous.data.attributes.status !== 'expired') throw new HttpError(409, 'The current checkout is still active. Refresh the payment page and try again.')
          db.prepare(`UPDATE orders SET payment_status = 'Expired' WHERE reference = ?`).run(order.reference)
        }
        const created = await paymongoRequest('/checkout_sessions', {
          method: 'POST',
          secretKey: paymentConfig.secretKey,
          body: {
            data: {
              attributes: {
                line_items: [{
                  name: `${order.service} printing · ${order.paper_size} · ${order.color}`,
                  amount: Math.round(order.unit_price * 100),
                  currency: 'PHP',
                  quantity: order.quantity,
                }],
                payment_method_types: ['gcash'],
                reference_number: order.reference,
                success_url: `${paymentConfig.appBaseUrl}/?payment=return&reference=${encodeURIComponent(order.reference)}`,
                cancel_url: `${paymentConfig.appBaseUrl}/?payment=cancelled&reference=${encodeURIComponent(order.reference)}`,
                metadata: { printHubReference: order.reference },
              },
            },
          },
        }, fetchImpl)
        const sessionData = assertTestModeSession(created)
        const checkoutUrl = sessionData.attributes.checkout_url
        if (!sessionData.id || !checkoutUrl || new URL(checkoutUrl).hostname !== 'checkout.paymongo.com') {
          throw new HttpError(502, 'PayMongo returned an invalid test checkout session.')
        }
        db.prepare(`UPDATE orders SET checkout_session_id = ?, checkout_url = ?, payment_status = 'Pending',
          status = 'Pending Payment' WHERE reference = ? AND payment_status != 'Paid'`)
          .run(sessionData.id, checkoutUrl, order.reference)
        jsonResponse(response, 201, {
          checkoutUrl,
          order: normalizeOrder(db.prepare('SELECT * FROM orders WHERE reference = ?').get(order.reference)),
        })
        return
      }

      if (method === 'POST' && path === '/api/payments/status') {
        checkOrigin(request, env)
        const body = await readJson(request)
        let order = getCustomerOrder(db, String(body.reference ?? ''), body.contactNumber)
        if (order.checkout_session_id && order.payment_status !== 'Paid' && paymentConfig.secretKey) {
          order = await syncPaymentStatus(db, order, paymentConfig, fetchImpl)
        }
        jsonResponse(response, 200, { order: normalizeOrder(order) })
        return
      }

      if (method === 'POST' && path === '/api/payments/webhook') {
        const rawBody = await readBody(request)
        if (!paymentConfig.webhookSecret) throw new HttpError(503, 'PayMongo test webhook verification is not configured.')
        if (!verifyWebhookSignature(rawBody.toString('utf8'), request.headers['x-paymongo-signature'], paymentConfig.webhookSecret)) {
          throw new HttpError(401, 'Invalid PayMongo webhook signature.')
        }
        let event
        try {
          event = JSON.parse(rawBody.toString('utf8'))
        } catch {
          throw new HttpError(400, 'Webhook body must be valid JSON.')
        }
        const eventAttributes = event?.data?.attributes
        const eventType = eventAttributes?.type ?? event?.data?.type
        const sessionData = eventAttributes?.data ?? event?.data?.data
        if (!eventType || !sessionData?.id) {
          jsonResponse(response, 200, { received: true, ignored: true })
          return
        }
        const eventId = String(event.data.id || createHash('sha256').update(rawBody).digest('hex'))
        if (db.prepare('SELECT 1 FROM webhook_events WHERE event_id = ?').get(eventId)) {
          jsonResponse(response, 200, { received: true, duplicate: true })
          return
        }
        if (eventAttributes?.livemode === true || event.livemode === true || event.data.livemode === true || sessionData.attributes?.livemode === true) {
          throw new HttpError(400, 'Live-mode PayMongo events are not accepted.')
        }
        const paymentEvent = [
          'checkout_session.payment.paid',
          'checkout_session.payment.failed',
          'checkout_session.expired',
        ].includes(eventType)
        if (paymentEvent) {
          const trusted = await paymongoRequest(`/checkout_sessions/${encodeURIComponent(sessionData.id)}`, {
            secretKey: paymentConfig.secretKey,
          }, fetchImpl)
          const session = assertTestModeSession(trusted)
          const reference = session.attributes.reference_number
          const order = db.prepare('SELECT * FROM orders WHERE reference = ?').get(reference)
          if (!order || order.checkout_session_id !== session.id) throw new HttpError(404, 'Webhook checkout session does not match an order.')
          if (eventType === 'checkout_session.payment.paid') {
            const paid = paidGcashPayment(session, Math.round(order.total * 100))
            if (!paid) throw new HttpError(400, 'PayMongo session does not contain a matching successful GCash payment.')
            applyPaidSession(db, order, session)
          } else if (eventType === 'checkout_session.payment.failed') {
            const payments = Array.isArray(session.attributes.payments) ? session.attributes.payments : []
            if (payments.some((payment) => payment?.attributes?.status === 'failed')) {
              db.prepare(`UPDATE orders SET payment_status = 'Failed'
                WHERE reference = ? AND payment_status != 'Paid'`).run(order.reference)
            }
          } else if (session.attributes.status === 'expired') {
            db.prepare(`UPDATE orders SET payment_status = 'Expired'
              WHERE reference = ? AND payment_status != 'Paid'`).run(order.reference)
          }
        }
        try {
          db.prepare('INSERT INTO webhook_events (event_id, processed_at) VALUES (?, ?)').run(eventId, new Date().toISOString())
        } catch (error) {
          if (!db.prepare('SELECT 1 FROM webhook_events WHERE event_id = ?').get(eventId)) throw error
          jsonResponse(response, 200, { received: true, duplicate: true })
          return
        }
        jsonResponse(response, 200, { received: true })
        return
      }

      if (method === 'GET' && path === '/api/orders') {
        requireStaff(request, db)
        const rows = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all()
        jsonResponse(response, 200, { orders: rows.map(normalizeOrder) })
        return
      }

      if (method === 'GET' && path === '/api/orders/file') {
        requireStaff(request, db)
        const reference = url.searchParams.get('reference') || ''
        const row = db.prepare('SELECT file_path, file_name FROM orders WHERE reference = ?').get(reference)
        if (!row) throw new HttpError(404, 'Order file was not found.')
        const content = await readFile(row.file_path)
        response.writeHead(200, {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(row.file_name)}`,
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
        })
        response.end(content)
        return
      }

      const statusMatch = path.match(/^\/api\/orders\/([^/]+)\/status$/)
      if (method === 'PATCH' && statusMatch) {
        checkOrigin(request, env)
        requireStaff(request, db)
        const body = await readJson(request)
        const reference = decodeURIComponent(statusMatch[1])
        const order = db.prepare('SELECT * FROM orders WHERE reference = ?').get(reference)
        if (!order) throw new HttpError(404, 'Order was not found.')
        const nextByStatus = {
          Paid: 'Processing',
          Processing: 'Ready for Pickup',
          'Ready for Pickup': 'Completed',
          'Pending Payment': 'Cancelled',
        }
        if (body.status !== nextByStatus[order.status]) throw new HttpError(409, 'This order cannot move to the requested status.')
        if (['Processing', 'Ready for Pickup', 'Completed'].includes(body.status) && order.payment_status !== 'Paid') {
          throw new HttpError(409, 'Only paid orders can enter printing or pickup.')
        }
        db.prepare('UPDATE orders SET status = ? WHERE reference = ?').run(body.status, reference)
        jsonResponse(response, 200, { order: normalizeOrder(db.prepare('SELECT * FROM orders WHERE reference = ?').get(reference)) })
        return
      }

      const pricingMatch = path.match(/^\/api\/pricing\/([^/]+)$/)
      if (method === 'PATCH' && pricingMatch) {
        checkOrigin(request, env)
        requireStaff(request, db, true)
        const body = await readJson(request)
        const id = decodeURIComponent(pricingMatch[1])
        const existing = db.prepare('SELECT * FROM pricing_rules WHERE id = ?').get(id)
        if (!existing) throw new HttpError(404, 'Pricing option was not found.')
        const blackAndWhite = Number(body.blackAndWhite)
        const color = Number(body.color)
        if (!Number.isFinite(blackAndWhite) || !Number.isFinite(color) || blackAndWhite < 0 || color < 0 || blackAndWhite > 100000 || color > 100000) {
          throw new HttpError(400, 'Enter valid non-negative unit prices.')
        }
        db.prepare('UPDATE pricing_rules SET black_and_white = ?, color = ?, active = ? WHERE id = ?')
          .run(blackAndWhite, color, body.active === false ? 0 : 1, id)
        jsonResponse(response, 200, { pricing: loadPricing(db) })
        return
      }

      jsonResponse(response, 404, { error: 'API route not found.' })
    } catch (error) {
      if (error instanceof HttpError) {
        jsonResponse(response, error.status, { error: error.message })
        return
      }
      console.error('PrintHub API error:', error instanceof Error ? error.message : 'unknown error')
      if (!response.headersSent) jsonResponse(response, 500, { error: 'An unexpected server error occurred.' })
      else response.destroy()
    }
  })

  server.on('close', () => db.close())
  return server
}

loadEnvFile()

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.env.PAYMENT_ENVIRONMENT && process.env.PAYMENT_ENVIRONMENT !== 'test') {
    throw new Error('PrintHub is test-mode only. Set PAYMENT_ENVIRONMENT=test.')
  }
  if (process.env.PAYMONGO_SECRET_KEY && !process.env.PAYMONGO_SECRET_KEY.startsWith('sk_test_')) {
    throw new Error('Live PayMongo keys are not supported. Use an sk_test_ key.')
  }
  const port = Number(process.env.API_PORT || 3001)
  const server = createPrintHubServer()
  server.listen(port, '127.0.0.1', () => {
    console.log(`PrintHub test-mode API listening at http://127.0.0.1:${port}`)
  })
}
