# FarmDirect

A farm-to-buyer marketplace for vegetables, fruit and grains. Farmers and traders sell directly to households, shops and restaurants. Buyers see the real delivery fee for their pincode before they pay, and can pool orders with neighbours (group orders) to get wholesale prices.

```
farmdirect/
├── farmdirect-api/      Node.js + Express + MongoDB (Mongoose) — REST API
├── farmdirect-client/   React 19 + Vite — mobile-first web app
└── docs/
    ├── IMPROVED_PROMPT.md       improved version of your CTO brief
    └── PRODUCT_AND_MARKET.md    market research, positioning, risks, roadmap
```

---

## 1. Run it locally (about 5 minutes)

**You need:** Node.js 20 or newer, and MongoDB (either a local install or a free MongoDB Atlas cluster).

### Step 1: API

```bash
cd farmdirect-api
npm install
cp .env.example .env          # Windows: copy .env.example .env
```

Open `.env` and set:
- `MONGODB_URI`: `mongodb://127.0.0.1:27017/farmdirect` for local, or your Atlas connection string
- `JWT_SECRET`: any long random string. To generate one: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
- leave `PAYMENT_MODE=mock` for now. Payments are simulated, so you don't need Razorpay keys yet.

```bash
npm run seed      # loads demo farmers, traders, products and buyers (WIPES the farmdirect DB)
npm run dev       # API on http://localhost:5000
```

Check that it's up: http://localhost:5000/api/health → `{"ok":true,"db":"up",...}`

### Step 2: Client (in a second terminal)

```bash
cd farmdirect-client
npm install
npm run dev       # http://localhost:5173
```

In development, Vite forwards `/api` to `localhost:5000`, so you don't need any CORS or env setup.

### Step 3: Try it

Open http://localhost:5173 and enter pincode **411045** (demo data covers Pune: 411001, 411004, 411038, 411045, 411057).

| Account | Email | Password |
|---|---|---|
| Household buyer | customer@farmdirect.test | Farm@1234 |
| Business buyer (retailer) | retailer@farmdirect.test | Farm@1234 |
| Verified farmer | ramesh@farmdirect.test | Farm@1234 |
| Unverified farmer | anil@farmdirect.test | Farm@1234 |
| Grain trader | trader@farmdirect.test | Farm@1234 |
| Admin | admin@farmdirect.test | Admin@12345 |

A good first walkthrough: as the customer, buy tomatoes, pay with **Simulate success**, then start a group on Onion. Next, log in as Ramesh, accept the order and move it through to Delivered. Back as the customer, leave a review or report a problem. Finally, log in as admin to verify Anil and resolve the complaint.

### Run the tests

```bash
cd farmdirect-api
MONGODB_URI_TEST=mongodb://127.0.0.1:27017/farmdirect_test npm test
```

There are 22 integration tests. They run against a **real MongoDB**, because the bugs that matter here (overselling, double group joins, duplicate payments) only show up with real concurrent writes. They cover:
- auth and role isolation
- server-side pricing
- unserviceable pincodes
- 10 buyers racing for the last 5 kg
- payment idempotency
- refunds
- the order status machine
- reviews only after delivery
- **40 users joining a group at the same moment** (it never exceeds its max, and full or closed groups always reject joins)
- group deadline success and failure, with refunds

> The test DB is dropped at the start of each run. Never point `MONGODB_URI_TEST` at real data.

---

## 2. Switching on Razorpay (test mode)

1. Create a Razorpay account. In the Dashboard, switch to **Test Mode**, go to **Settings → API Keys** and generate a key.
2. In `farmdirect-api/.env`:
   ```
   PAYMENT_MODE=razorpay
   RAZORPAY_KEY_ID=rzp_test_...
   RAZORPAY_KEY_SECRET=...
   ```
3. Webhook (strongly recommended, and needed for production): go to **Dashboard → Webhooks → Add**.
   - URL: `https://<your-api>/api/payments/webhook`
   - Events: `payment.captured`, `payment.failed`
   - Secret: put the same value in `RAZORPAY_WEBHOOK_SECRET`

   For local testing, expose port 5000 with a tunnel (e.g. `ngrok http 5000`).
4. Turn on **auto-capture** in Razorpay payment settings.

How payments are protected:
- The amount is always computed on the server, in paise.
- The secret key never reaches the browser.
- The browser callback is only trusted after HMAC signature verification, plus a fetch from Razorpay to confirm the amount.
- The webhook is the backup if the buyer closes the tab.
- Each payment applies exactly once: a unique gateway payment id plus an atomic status flip.
- If a second payment arrives for an already-paid order, it is refunded.
- A late payment after the stock hold expired is either honoured (if stock is still there) or refunded automatically.
- Refunds always go back to the original payment method. There is no stored wallet balance (see the market notes on why).

`PAYMENT_MODE=mock` refuses to start when `NODE_ENV=production`.

---

## 3. Deploy

### API → Render (Web Service)
- Root directory: `farmdirect-api`
- Build: `npm install`, Start: `npm start`
- Environment: everything from `.env.example`, with `NODE_ENV=production`, a strong `JWT_SECRET` (the server refuses weak ones in production), your Atlas URI, and `CLIENT_ORIGINS=https://your-app.vercel.app`
- Health check path: `/api/health`
- Create the first admin from the Render shell: `node scripts/create-admin.js "Your Name" you@domain.in 'a-long-password'`

> ⚠️ **Uploaded images:** Render's disk is wiped on every deploy. Before real users, move uploads to Cloudinary, S3 or Cloudflare R2. Only `src/routes/uploads.js` needs to change.
>
> ⚠️ **Render free tier sleeps** after inactivity. The first request then takes 30–60 s, and the background sweeper (which expires unpaid orders and closes groups) pauses with it. Use a paid instance for launch.

### Client → Vercel
- Root directory: `farmdirect-client`, framework: Vite
- Env: `VITE_API_URL=https://your-api.onrender.com`
- `vercel.json` already rewrites all routes to `index.html`, so deep links work.

---

## 4. Architecture in one page

**Money** is stored as integer **paise** everywhere, which means no floating-point rounding errors. The API accepts rupees in forms and converts them.

**Order lifecycle** (one order per seller; a cart with three sellers becomes three orders paid in one payment):

```
pending_payment ─pay─▶ placed ─seller─▶ accepted ─▶ packed ─▶ out_for_delivery / ready_for_pickup ─▶ delivered
      │                  ├─seller─▶ rejected  (auto refund + restock)
      │                  └─buyer──▶ cancelled (auto refund + restock, only before acceptance)
      └─15 min, unpaid─▶ expired (stock released)
```

Every transition is checked against a table of who is allowed to make it (`models/Order.js → TRANSITIONS`). It is applied with a "status must still be X" condition, so two quick clicks can't both go through.

**Stock** is reserved at checkout with a single atomic `findOneAndUpdate({stock: {$gte: qty}}, {$inc: -qty})`, which prevents overselling. Stock is released exactly once on expiry, rejection or cancellation, guarded by a `stockReleased` flag.

**Group orders** (`services/groups.js`):
- When a group is created, it reserves its max quantity from stock.
- A join is one atomic update that checks: status is open, the deadline hasn't passed, the user isn't already a member, and `joinedQty + qty ≤ maxQty`. Races are therefore impossible without needing locks.
- Members pay upfront, and an unpaid spot is released after 15 minutes.
- At the deadline: if the paid quantity has reached the target, the group is confirmed, member orders go to the seller and unused stock returns. Otherwise everyone is refunded.
- Delivery goes to one shared drop point, and the seller's group price includes that delivery.

**Delivery pricing** is by pincode, not distance. Each seller lists the pincodes they actually serve, with a flat fee and ETA for each. They can also set "free above ₹X" and a minimum order value, and offer free pickup. Product discovery filters by the buyer's pincode, so the app never promises delivery where none exists.

**Security:**
- bcrypt (cost 12)
- JWT with a `tokenVersion` (so "log out everywhere" works and disabled users are kicked out)
- login lockout after 5 failures
- a generic login error, so nobody can probe which emails have accounts
- rate limiting
- helmet
- a CORS allow-list
- zod validation that strips unknown fields (so you can't send `{"role":"admin"}` or `{"verified":true}`)
- NoSQL-operator stripping
- ownership checks built into every query
- other people's orders return 404, not 403, so their existence isn't revealed
- uploads checked by file signature, not just by the browser's MIME type
- no self-registration as admin

**Background sweeper** (every 60 s): expires unpaid orders and closes due groups. Each step is an atomic conditional update, so running several API instances at once is safe.

### API overview

| Area | Endpoints |
|---|---|
| Auth | `POST /api/auth/register · /login · /logout-all`, `GET/PATCH /api/auth/me`, `POST/DELETE /api/auth/me/addresses` |
| Catalogue | `GET /api/products?pincode&category&q&sort&supplierType&groupBuy&page`, `GET /api/products/:id?pincode` |
| Seller | `GET /api/products/mine`, `POST/PATCH/DELETE /api/products/:id`, `PATCH /api/seller/settings`, `GET /api/seller/stats`, `GET /api/seller/:id/public` |
| Checkout | `POST /api/checkout/quote`, `POST /api/checkout` (`Idempotency-Key` header), `POST /api/checkout/verify`, `POST /api/checkout/mock/complete`, `GET /api/checkout/payment/:checkoutId` |
| Payments | `POST /api/payments/webhook` (Razorpay, raw body + signature) |
| Orders | `GET /api/orders`, `GET /api/orders/seller`, `GET /api/orders/:id`, `POST /api/orders/:id/status` |
| Groups | `GET /api/groups?pincode`, `GET /api/groups/mine`, `GET /api/groups/:idOrCode`, `POST /api/groups`, `POST /api/groups/:id/join · /leave · /cancel` |
| Reviews | `POST /api/reviews` (delivered orders only), `GET /api/reviews/product/:id` |
| Disputes | `POST/GET /api/disputes`, `GET /api/disputes/:id`, `POST /api/disputes/:id/respond` (seller), `POST /api/disputes/:id/resolve` (admin) |
| Notifications | `GET /api/notifications`, `POST /api/notifications/read-all` |
| Admin | `GET /api/admin/stats · /users · /orders · /payments`, `PATCH /api/admin/users/:id` |
| Uploads | `POST /api/uploads` (multipart `images`, max 6 × 3 MB) |

Errors always look like `{ "error": { "code", "message", "details?" } }`.

---

## 5. Farmer ↔ Broker module (Mandi Bhav · Kahan Bechun · Vyapar)

This module exists because of a real problem. When everyone in a village grows the same crop (e.g. cauliflower), the local mandi price can crash to ₹1/kg. Farmers then have no idea whether a mandi further away, or a broker, would pay more after all the costs.

| Screen | Who | What it does |
|---|---|---|
| `/mandi` **Mandi Bhav** | everyone | Latest wholesale price of a crop in every MP and MH mandi, highest to lowest, with a 3-week trend line. Each price is labelled by source: Govt data, FarmDirect, or Sample. |
| `/mandi/calculator` **Kahan bechun?** | everyone | For a given crop, quantity, farm district (or GPS) and vehicle, it ranks every mandi by **money in hand** after transport (round trip), commission, mandi fee, hamali, packaging, harvest labour and spoilage on the way. It also shows the **minimum fair farm-gate price**: if a broker offers less than this, taking the crop to the best mandi yourself pays more. All cost assumptions can be edited. |
| `/vyapar` **Vyapar** | farmers, brokers | **Farmers** see brokers' buy requests with the broker's phone number, verification badge and public record (deals done, % paid at pickup, rating, payment complaints). Each offer is also checked against the farmer's own best mandi: good, fair or low. **Brokers** see farmers' crop listings sorted by distance. |
| `/vyapar/deals/:id` | the two parties | Proposed → both agree → broker adds vehicle and driver → **farmer confirms "loaded & paid"** with the weighed quantity, amount and payment mode. Only the farmer can confirm payment. If the amount is below the agreed amount, it is recorded as a payment problem against the broker. Either side can report a no-show or other problem. |

**How payment works (as you specified):** money changes hands at the farm when the crop is loaded (cash, UPI or bank transfer). The app does not hold the money. It keeps the record, and that record becomes the broker's reputation.

**Privacy:**
- A broker's number is visible to every logged-in farmer, so farmers can call and verify first.
- A farmer's number is shown to a broker only after the farmer proposes a deal or accepts the broker's offer. This protects farmers from spam calls.

**Broker verification:** brokers must give a phone number at sign-up. An admin verifies them after checking their mandi licence and calling them (Admin → Users → "Unverified sellers" also lists brokers).

### Mandi price data
- **Government data (AGMARKNET via data.gov.in):** set `DATA_GOV_IN_API_KEY` (free at data.gov.in). The API then pulls MP and MH prices for 14 crops every 6 hours. An admin can also trigger a pull with `POST /api/market/sync`. The endpoint is configurable (`MANDI_API_URL`) because data.gov.in has re-published this dataset under different ids. ⚠️ I couldn't reach data.gov.in from my build environment, so the live API call is **untested**. The code that reads its records *is* tested against sample records in both field formats. Check the first sync's log line after adding your key.
- **Admin entry:** `POST /api/market/prices`, for the team to type in today's rate from the local mandi board.
- **Sample data:** `npm run seed` creates 3 weeks of **made-up** prices for 20 mandis. It includes a cauliflower glut (~₹1/kg) in Dewas, Khandwa, Ratlam, Sagar, Ahilyanagar, Solapur and Jalgaon to demonstrate the problem. Every sample price is labelled "Sample" in the UI, and real data always replaces sample data for the same mandi.

Distances are straight-line × 1.3 (≈ road distance) from approximate district-HQ coordinates (`farmdirect-api/src/data/agri.js`). Cost defaults (fare per km, commission %, hamali, packaging, labour, spoilage per 100 km) are **typical assumptions, not official rates**. Edit them in that file or per calculation.

Demo logins for this module (password `Farm@1234`):
- `suresh@farmdirect.test`: farmer in Dewas (MP) with 60 qtl cauliflower
- `broker@farmdirect.test`: verified broker, Indore
- `imran@farmdirect.test`: verified broker, Nashik → Vashi
- `vikas@farmdirect.test`: unverified broker with a payment complaint

## 6. Frontend notes

- **Design:** "Mandi Ledger". Neo-brutalist structure (hard 2 px borders, offset shadows, a receipt-style bill) with minimalist restraint, an earthy palette (paper, ink, leaf, turmeric, chili) and monospace prices.
- **Mobile first:** a thumb-friendly bottom nav, 44 px+ tap targets, and 16 px inputs (so iOS doesn't zoom).
- **Product tiles without photos** show the product name typographically on a category colour, so the catalogue still looks deliberate before sellers upload real photos.
- **English / हिन्दी toggle** for the main labels (`src/lib/i18n.jsx`). Add more languages by adding keys.
- **Prices:** the cart stores only ids and quantities. Every price on the checkout screen comes from the server quote.
- **Code-splitting:** less-visited screens are lazy-loaded to keep the first load light on mobile data.
