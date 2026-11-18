import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, test } from 'node:test'
import { createPrintHubServer } from './index.mjs'
import { createWebhookSignature, getPaymentConfig } from './paymongo.mjs'

const activeServers = []

afterEach(async () => {
  await Promise.all(activeServers.splice(0).map(async ({ server, directory }) => {
    await new Promise((resolve) => server.close(resolve))
    await rm(directory, { recursive: true, force: true })
  }))
})

async function setup(fetchImpl = async () => { throw new Error('Unexpected PayMongo request') }) {
  const directory = await mkdtemp(join(tmpdir(), 'printhub-test-'))
  const server = createPrintHubServer({
    env: {
      PAYMENT_ENVIRONMENT: 'test',
      PAYMONGO_SECRET_KEY: 'sk_test_unit_test',
      PAYMONGO_WEBHOOK_SECRET: 'webhook_test_secret',
      APP_BASE_URL: 'http://localhost:5173',
      STAFF_EMAIL: 'staff@example.test',
      STAFF_PASSWORD: 'staff-test-password',
      ADMIN_EMAIL: 'owner@example.test',
      ADMIN_PASSWORD: 'owner-test-password',
    },
    dbPath: join(directory, 'test.sqlite'),
    uploadsDir: join(directory, 'uploads'),
    fetchImpl,
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  activeServers.push({ server, directory })
  const address = server.address()
  const baseUrl = `http://127.0.0.1:${address.port}`
  return {
    baseUrl,
    request: (path, init = {}) => fetch(`${baseUrl}${path}`, init),
    json: (path, method, body, headers = {}) => fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173', ...headers },
      body: JSON.stringify(body),
    }),
  }
}

function orderBody(overrides = {}) {
  return {
    requestId: '4bf9e7da-55f8-45e1-a511-2bb66c3b699d',
    acceptedTotal: 5,
    customerName: 'Test Customer',
    contactNumber: '09171234567',
    email: '',
    service: 'Documents',
    paperSize: 'A4',
    color: 'Black & White',
    quantity: 1,
    instructions: '',
    file: { name: 'document.docx', base64: Buffer.from('PK test DOCX fixture').toString('base64') },
    ...overrides,
  }
}

test('configuration rejects live payment credentials and environments', () => {
  assert.throws(() => getPaymentConfig({ PAYMENT_ENVIRONMENT: 'live' }), /only supports PayMongo test mode/)
  assert.throws(() => getPaymentConfig({ PAYMONGO_SECRET_KEY: 'sk_live_not_allowed' }), /test secret keys/)
  assert.equal(getPaymentConfig({ APP_BASE_URL: 'printhub-mics.up.railway.app' }).appBaseUrl, 'https://printhub-mics.up.railway.app')
  assert.equal(getPaymentConfig({ APP_BASE_URL: 'https://printhub-mics.up.railway.app/' }).appBaseUrl, 'https://printhub-mics.up.railway.app')
})

test('server rejects modified totals and unauthorized order lookups', async () => {
  const app = await setup()
  const changedAmount = await app.json('/api/orders', 'POST', orderBody({ acceptedTotal: 0.01 }))
  assert.equal(changedAmount.status, 409)

  const created = await app.json('/api/orders', 'POST', orderBody())
  assert.equal(created.status, 201)
  const { order } = await created.json()

  const wrongContact = await app.json('/api/payments/status', 'POST', {
    reference: order.reference,
    contactNumber: '09170000000',
  })
  assert.equal(wrongContact.status, 404)

  const replay = await app.json('/api/orders', 'POST', orderBody({ contactNumber: '09170000000' }))
  assert.equal(replay.status, 409)
})

test('checkout uses the server order amount and allows GCash only in test mode', async () => {
  const calls = []
  const app = await setup(async (url, init) => {
    calls.push({ url, init })
    return Response.json({
      data: {
        id: 'cs_test_123',
        attributes: {
          livemode: false,
          status: 'active',
          checkout_url: 'https://checkout.paymongo.com/cs_test_123',
        },
      },
    })
  })
  const created = await app.json('/api/orders', 'POST', orderBody())
  const { order } = await created.json()
  const checkout = await app.json('/api/payments/checkout', 'POST', {
    reference: order.reference,
    contactNumber: order.contactNumber,
  })
  assert.equal(checkout.status, 201)
  assert.equal((await checkout.json()).checkoutUrl, 'https://checkout.paymongo.com/cs_test_123')
  const payload = JSON.parse(calls[0].init.body)
  assert.deepEqual(payload.data.attributes.payment_method_types, ['gcash'])
  assert.equal(payload.data.attributes.line_items[0].amount, 500)
  assert.equal(payload.data.attributes.line_items[0].quantity, 1)
  assert.equal(payload.data.attributes.success_url.includes(order.reference), true)
})

test('payment webhook rejects bad signatures and applies one verified test payment idempotently', async () => {
  let session = {
    id: 'cs_test_paid',
    attributes: {
      livemode: false,
      status: 'active',
      checkout_url: 'https://checkout.paymongo.com/cs_test_paid',
      reference_number: '',
      payments: [{
        id: 'pay_test_123',
        attributes: { status: 'paid', currency: 'PHP', amount: 500, source: { type: 'gcash' } },
      }],
    },
  }
  const app = await setup(async () => Response.json({ data: session }))
  const created = await app.json('/api/orders', 'POST', orderBody())
  const { order } = await created.json()
  session.attributes.reference_number = order.reference
  await app.json('/api/payments/checkout', 'POST', { reference: order.reference, contactNumber: order.contactNumber })

  const event = JSON.stringify({
    data: {
      id: 'evt_test_123',
      attributes: { type: 'checkout_session.payment.paid', livemode: false, data: { id: session.id } },
    },
  })
  const timestamp = String(Math.floor(Date.now() / 1000))
  const signature = createWebhookSignature(event, 'webhook_test_secret', timestamp)
  const invalid = await app.request('/api/payments/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Paymongo-Signature': `t=${timestamp},te=${'0'.repeat(64)}` },
    body: event,
  })
  assert.equal(invalid.status, 401)

  const webhook = () => app.request('/api/payments/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Paymongo-Signature': `t=${timestamp},te=${signature}` },
    body: event,
  })
  assert.equal((await webhook()).status, 200)
  const duplicate = await webhook()
  assert.equal(duplicate.status, 200)
  assert.equal((await duplicate.json()).duplicate, true)

  const login = await app.json('/api/staff/login', 'POST', { email: 'staff@example.test', password: 'staff-test-password' })
  const cookie = login.headers.get('set-cookie').split(';')[0]
  const orders = await app.request('/api/orders', { headers: { Cookie: cookie } })
  const paidOrder = (await orders.json()).orders[0]
  assert.equal(paidOrder.paymentStatus, 'Paid')
  assert.equal(paidOrder.status, 'Paid')
  assert.equal(paidOrder.paymentReference, 'pay_test_123')
})

test('pending and failed payments cannot enter the printing queue', async () => {
  const session = {
    id: 'cs_test_failed',
    attributes: {
      livemode: false,
      status: 'active',
      checkout_url: 'https://checkout.paymongo.com/cs_test_failed',
      reference_number: '',
      payments: [],
    },
  }
  const app = await setup(async () => Response.json({ data: session }))
  const created = await app.json('/api/orders', 'POST', orderBody())
  const { order } = await created.json()
  session.attributes.reference_number = order.reference
  await app.json('/api/payments/checkout', 'POST', { reference: order.reference, contactNumber: order.contactNumber })

  const pending = await app.json('/api/payments/status', 'POST', {
    reference: order.reference,
    contactNumber: order.contactNumber,
  })
  assert.equal((await pending.json()).order.paymentStatus, 'Pending')

  const login = await app.json('/api/staff/login', 'POST', { email: 'staff@example.test', password: 'staff-test-password' })
  const cookie = login.headers.get('set-cookie').split(';')[0]
  const attempt = await app.json(`/api/orders/${order.reference}/status`, 'PATCH', { status: 'Processing' }, { Cookie: cookie })
  assert.equal(attempt.status, 409)

  session.attributes.payments = [{ attributes: { status: 'failed' } }]
  const failedEvent = JSON.stringify({
    data: {
      id: 'evt_test_failed',
      attributes: { type: 'checkout_session.payment.failed', livemode: false, data: { id: session.id } },
    },
  })
  const timestamp = String(Math.floor(Date.now() / 1000))
  const failedSignature = createWebhookSignature(failedEvent, 'webhook_test_secret', timestamp)
  const webhook = await app.request('/api/payments/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Paymongo-Signature': `t=${timestamp},te=${failedSignature}` },
    body: failedEvent,
  })
  assert.equal(webhook.status, 200)

  const failed = await app.json('/api/payments/status', 'POST', {
    reference: order.reference,
    contactNumber: order.contactNumber,
  })
  const failedOrder = (await failed.json()).order
  assert.equal(failedOrder.paymentStatus, 'Failed')
  assert.equal(failedOrder.status, 'Pending Payment')
})
