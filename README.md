# PrintHub

PrintHub is a responsive printing-shop ordering and management application for Micah's Printing Shop. The frontend uses React, TypeScript, and Vite; the local backend uses Node.js 24 and SQLite. PayMongo checkout is restricted to TEST mode.

## Run locally

1. Install Node.js 24 or later and run `npm install`.
2. Copy `.env.example` to `.env`. Configure test credentials and replace the example staff passwords; never use live PayMongo keys.
3. Run `npm run dev`. This starts both the Vite frontend and local API; open the Vite URL (normally `http://localhost:5173`).

To run only the API, use `npm run dev:api`. The Vite development server proxies `/api` requests to the local API at port 3001.

See [PAYMONGO_SETUP.md](PAYMONGO_SETUP.md) for credentials, webhook setup, and test payment instructions.

## Included workflows

- Customers submit a print file, receive a server-priced total, accept it, and can launch a hosted GCash checkout in PayMongo TEST mode.
- PDF page counts are checked by the browser and recalculated by the server; DOC/DOCX page counts must be entered by the customer.
- Customers can track order and payment status using the order reference and matching contact number.
- Staff sign in to review orders, access uploaded files, and advance paid orders through printing and pickup.
- Admins can update stored pricing. Existing order prices remain unchanged.
- Only a server-verified PayMongo GCash payment can mark an order Paid. Redirect query parameters do not confirm payment.

## Persistence and remaining integration

- Orders, configured prices, staff sessions, webhook idempotency records, and uploaded files are stored under the ignored `server/data/` directory.
- Staff credentials and PayMongo test keys are configured through the local `.env` file. No payment keys are included in this repository.
- The staff access page still contains session-only demo controls; creating staff accounts and changing access requires a dedicated backend admin workflow.
- For production deployment, configure HTTPS, a persistent private file store, backups, rate limiting, and appropriate security monitoring.
- This academic implementation rejects live-mode keys and does not provide production/live payment processing.
