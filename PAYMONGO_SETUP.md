# PayMongo GCash TEST mode setup

PrintHub deliberately supports **PayMongo TEST mode only**. Never configure a live secret key or real payment environment in this project. A checkout URL or browser redirect is not proof of payment: the local API verifies the checkout session with PayMongo and accepts a successful payment only when a signed webhook and the trusted session both match the order, amount, PHP currency, and GCash method.

## 1. Create a test account and credentials

1. Create or sign in to a PayMongo account at [PayMongo](https://dashboard.paymongo.com/).
2. Switch the dashboard to **Test Mode** before setting up credentials or webhooks.
3. In the dashboard's API keys section, copy the **test secret key** (`sk_test_...`) and test public key (`pk_test_...`). Do not use any `sk_live_...` or `pk_live_...` key.
4. Create a webhook in Test Mode. Subscribe to `checkout_session.payment.paid` and set its URL to `https://YOUR_PUBLIC_TEST_HOST/api/payments/webhook`. Copy the webhook's signing secret. Do not expose this secret in frontend code or commit it.

The hosted checkout is created server-side with GCash as its only payment method; a public key is not needed to create this hosted checkout.

## 2. Configure local environment

Copy `.env.example` to `.env` and replace the placeholders:

```dotenv
PAYMENT_ENVIRONMENT=test
PAYMONGO_SECRET_KEY=sk_test_...
PAYMONGO_PUBLIC_KEY=pk_test_...
PAYMONGO_WEBHOOK_SECRET=your_test_webhook_signing_secret
APP_BASE_URL=http://localhost:5173
API_PORT=3001
ADMIN_EMAIL=owner@example.test
ADMIN_PASSWORD=use-a-unique-local-password
STAFF_EMAIL=staff@example.test
STAFF_PASSWORD=use-another-unique-local-password
```

`.env` is ignored by Git. Keep credentials private. The API rejects any non-test `PAYMENT_ENVIRONMENT` and any PayMongo key that is not prefixed with the test key prefix. Missing test keys leave order management available but checkout and webhook verification unavailable.

## 3. Run the application and expose the webhook

Use Node.js 24 or later:

```sh
npm install
npm run dev
```

This starts the frontend and API together. Vite proxies `/api` requests to the local API on port 3001. To receive PayMongo webhooks locally, expose the API port with a tunnel such as ngrok:

```sh
ngrok http 3001
```

Set the webhook URL in the PayMongo **Test Mode** dashboard to the tunnel URL ending in `/api/payments/webhook`. The server validates the webhook signature from the raw request body and rejects stale or invalid signatures. Keep the tunnel address and webhook secret private.

For deployments, use HTTPS and set `APP_BASE_URL` to the exact public frontend origin. The local development server binds to loopback and is not intended as a public deployment server.

## 4. Simulate payment outcomes

1. Create an order in PrintHub and review/accept its final price.
2. Select **Pay with GCash** to open the hosted PayMongo checkout.
3. In Test Mode, follow the current PayMongo [payment acceptance testing guide](https://docs.paymongo.com/docs/payment-acceptance-testing) and the checkout instructions shown by PayMongo to simulate a successful, failed, or cancelled attempt. Test payments do not move real funds.
4. After returning to PrintHub, the result page fetches payment status from the API. A return URL alone never marks an order paid. A verified paid order becomes **Paid** and can then enter **Processing**.
5. To check again, use the result page's refresh action or track the order with its reference and original contact number. The API retrieves the session status from PayMongo when configured.

Use PayMongo's up-to-date test instructions for the exact simulation steps; test payment methods and instructions can change. A pending attempt remains unpaid until PayMongo reports a matching successful payment. A failed or cancelled attempt does not enter the printing queue. Expired sessions can be retried if PayMongo reports them expired.

## 5. Verify behavior and troubleshoot

Run the local automated checks:

```sh
npm run test:api
npm run build
npm run lint
```

Common issues:

- **Test checkout not configured:** verify that `.env` exists, has an `sk_test_...` key, and restart `npm run dev:api`.
- **Invalid checkout URL or API error:** confirm Test Mode is on, the key is copied correctly, and the machine can reach `api.paymongo.com`.
- **Payment remains pending:** confirm the Test Mode webhook URL is reachable, the `checkout_session.payment.paid` event is enabled, and the configured webhook secret matches this webhook. Use the order tracking page to trigger a server-side status check.
- **Invalid webhook signature:** check that the secret is the signing secret for the same Test Mode webhook and that the tunnel forwards the unmodified request body to port 3001.
- **Staff login fails:** use the email/password configured in `.env`; restart the API after changing `.env`.
- **Price changed before submission:** review the current price again and accept the amount displayed by PrintHub. The server independently computes the amount and rejects mismatches.

The API stores SQLite data and private uploads under `server/data/`; deleting this folder deletes local project data. Back it up appropriately if needed. No real credentials or successful live payment have been supplied or tested.
