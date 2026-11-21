# FarmDirect — Market notes, positioning, audit and roadmap

_Prepared November 2026. Market facts are summarised from public sources linked at the end; check them again before using them in a pitch deck._

## 1. What already exists (and what it teaches us)

| Player | Model | Lesson for FarmDirect |
|---|---|---|
| **Ninjacart** | B2B: aggregates from farmers and supplies retailers at large scale. | B2B fresh produce is where the volume is. Retailers and restaurants are a core segment, not an afterthought. |
| **DeHaat** | Full-stack farmer platform: inputs, advisory, market access and finance, run through local micro-entrepreneur centres. | Farmers trust **people nearby**, so offline field agents matter. Earn trust first and monetise later. |
| **BigHaat / AgroStar** | Agri-inputs marketplaces (seeds, fertiliser). | A different side of the market (selling *to* farmers). A possible later add-on, not our core. |
| **KisanKonnect** | Farm-to-fork in Mumbai/Pune through an app plus farm stores, with QR traceability. | Traceability and freshness are what consumers will pay for. Physical touchpoints help. |
| **Otipy (shut down May 2025)** | Community group buying (resellers) for fresh produce. Raised large funding. | **The most important cautionary tale.** It reportedly ran negative gross margins, was squeezed by 10-minute quick commerce, failed to raise its next round, and left customers with **stuck wallet balances** and vendors unpaid. |
| **Deep Rooted** | Farm-to-fork D2C. | Also wound down. The asset-heavy D2C fresh model is hard. |
| **e-NAM (government)** | Electronic trading across APMC mandis; crores of registered farmers. | Farmers' main complaints are **delayed payments, untrusted quality grading and opaque prices**. Uploading a photo doesn't establish quality. |

**Pain points that come up repeatedly in research and surveys:**
- Farmers: delayed payment, opaque price discovery, grading disputes and rejected crops, unreliable pickup, low trust in new buyers.
- Buyers: inconsistent quality, no recourse when produce arrives damaged, hidden delivery charges.
- Everyone: trust is local and slow to build, and digital literacy varies widely.

## 2. Where FarmDirect should position itself

**Don't fight Blinkit/Zepto on 10-minute delivery.** That race killed Otipy. Compete on **price transparency, freshness, bulk value and trust** for buyers who plan ahead: households buying weekly, kirana shops, restaurants and caterers.

**Asset-light by design.** Sellers deliver in their own pincodes or offer pickup. FarmDirect doesn't run warehouses or fleets. That keeps gross margin positive from day one (the platform fee is pure margin), which is the opposite of the model that failed.

### Differentiators already built into this version
1. **Honest delivery.** Sellers list the exact pincodes they serve, with a fee for each. Discovery hides sellers who can't reach you, and the full bill (goods + delivery + platform fee) is shown before payment.
2. **Freshness and grade on every listing.** Harvest date ("harvested yesterday"), grade A/B/C with notes, and organic claims clearly labelled *"declared by seller"* unless verified.
3. **Group orders that can't oversell.** Neighbours or nearby shops pool quantity for a group price, delivered to one drop point, with automatic refunds if the target isn't met. Groups can be shared on WhatsApp.
4. **Bulk tiers for B2B**, plus business-only listings (e.g. jowar per quintal).
5. **No wallet. Refunds always go back to the original payment method.** A direct lesson from Otipy: customer money never gets stuck in a stored balance.
6. **Verified-seller badge** granted by admins after an offline check, and **reviews only from delivered orders.**
7. **Structured complaints.** Photo evidence, the seller responds first, the admin decides, and the decision records **who bears the cost** (seller, delivery partner or platform).
8. **Hindi toggle** for core flows; regional languages are next.

### Ideas worth validating next (not built yet)
- **Mandi price reference**: show today's APMC modal price next to the farmer's price (data from Agmarknet/e-NAM). This makes "fair price" visible. A strong trust feature.
- **Pre-orders for upcoming harvests**: buyers commit before harvest and farmers plan picking. Reduces waste.
- **Standing weekly orders** for restaurants and kiranas (recurring revenue).
- **WhatsApp ordering and notifications** for farmers. Most farmers respond to WhatsApp far more reliably than to an app.
- **Weekly UPI payouts** with a payout ledger (RazorpayX Route). Payment speed is farmers' #1 complaint, so make "paid every Monday" a promise.
- **Field agents** (the DeHaat lesson): one person per cluster of villages who onboards and verifies farmers.

## 3. Audit of what was delivered

Your original prompt asked for an audit of an existing repo. **That repo wasn't accessible in this session** (no files were uploaded and the computer link wasn't connected), so this is a fresh build that follows your spec. When you share the old code, compare it against the checklist below and port over anything worth keeping.

### Bugs and risks the design prevents (all tested)
| Severity | Problem typical in student/early marketplace code | How it's handled here |
|---|---|---|
| Critical | Group order keeps accepting joins after it's full or closed, or 2 users race past the max | Single atomic conditional update; a 40-concurrent-joins test proves it |
| Critical | Overselling when two buyers buy the last stock | Atomic `$gte`-guarded decrement; a 10-buyer race test |
| Critical | Trusting the frontend "payment success" | HMAC signature + Razorpay fetch + webhook; exactly-once apply |
| Critical | Prices taken from the client | Server reprices every item; a test sends a fake price |
| Critical | Anyone can register as admin, or set themselves `verified` | Role allow-list; zod strips unknown fields |
| High | Seller can edit another seller's product | Ownership in the query itself; test |
| High | Buyer can read another buyer's order | 404 for non-parties; test |
| High | Duplicate orders on double-click or retry | Idempotency-Key on checkout; test |
| High | Stock never returned for abandoned checkouts | 15-minute hold plus sweeper; test |
| High | Floating-point money errors | Integer paise everywhere |
| Medium | Fake reviews | Only buyers of delivered orders, one per product per order |
| Medium | Delivery promised to unserviceable areas | Pincode service areas; test |

### Bugs found and fixed during this build's own browser testing
- **Blank screen after choosing a pincode (Chrome).** Newer Chrome returns a Promise from `window.scrollTo`. A one-line `useEffect(() => window.scrollTo(0,0))` handed that Promise to React as a "cleanup", which crashed the app. Fixed by adding braces around the effect body. Worth checking in your old code too.
- Product names on tiles broke mid-word ("Tomat/o"). They now scale to fit using container-query units.
- On phones, the price and Add-to-cart box sat below the long description. The layout now goes photo → buy box → details on mobile.
- Page content touched the screen edges on phones (vertical padding shorthand overrode the container's side padding).
- The pincode chip took on the empty-state box style because of a CSS class name collision.
- The cart showed ₹0 totals when the only seller was below their minimum order. It now shows an estimate and the problem instead.

### Known gaps (be honest with yourself before launch)
- **Image storage** is local disk, which Render wipes on deploy. Must move to Cloudinary, S3 or R2.
- **Payouts** are not automated. Earnings are calculated, but money reaches farmers manually or outside the app. You need RazorpayX Route or a weekly manual process with a ledger.
- **Notifications** are in-app only. Add SMS/WhatsApp (MSG91, Gupshup, Interakt).
- **No OTP / phone login.** Email + password is fine for the MVP, but many farmers prefer mobile OTP.
- **GST/invoices** aren't generated. B2B buyers will ask for GST invoices.
- **Admin can't edit catalogue or category data**, and there's no audit log of admin actions.
- **No automated frontend tests** (the e2e walkthrough was run with Playwright during development but isn't committed as a test suite).
- **Legal:** terms of service, privacy policy (India's DPDP Act), refund policy, and FSSAI registration for food sellers as applicable. Talk to a lawyer; this is not legal advice.

## 4. Prioritised roadmap

**Critical: before any real user**
1. Move uploads to cloud storage.
2. Razorpay live KYC; webhook configured; test refunds end to end in test mode.
3. Paid Render instance (so the sweeper never sleeps) and Atlas backups enabled.
4. Terms, privacy and refund policy pages; a grievance contact.
5. Seller verification SOP (call + document check + ideally a visit), and decide who handles damaged-delivery cost.

**High: for launch in one city**
6. WhatsApp/SMS notifications for new orders (sellers) and status changes (buyers).
7. Weekly payout ledger and process; show "next payout" on the seller dashboard.
8. Phone OTP login.
9. Mandi reference price on listings.
10. Error monitoring (Sentry) plus structured logs, and uptime alerts.

**Medium: product quality**
11. Standing/recurring orders for B2B; GST invoices.
12. Pre-orders for upcoming harvest.
13. Marathi and other regional languages; voice-friendly listing for farmers.
14. Admin audit log; admin catalogue tools; CSV exports.
15. Playwright e2e suite in CI.

**Low: later**
16. Delivery-partner role (shared logistics per cluster).
17. Seller credit / input financing partnerships.
18. Native app (PWA first).

## 5. Business model sanity check
- **Revenue:** a 2% buyer platform fee (configurable) to start. Later, a seller commission on B2B, featured listings, and logistics for sellers who don't deliver.
- **Unit economics:** because FarmDirect holds no stock and runs no fleet, every order is margin-positive. Keep it that way until a cluster has proven density.
- **Go-to-market:** one city, 5–10 pincodes, 15–30 farmers onboarded in person, plus 3–5 housing societies seeded with group orders and 10 kirana/restaurant buyers. Measure repeat rate and complaint rate before expanding.

### Sources
- Inc42 / YourStory / DealStreetAsia on the Otipy shutdown (May 2025): https://inc42.com/buzz/otipy-shuts-operations-amid-cash-crunch , https://yourstory.com/2025/05/farm-to-consumer-startup-otipy-shuts-down-employees-customers-seek-clarity-layoff , https://inc42.com/features/otipy-raised-millions-but-couldnt-beat-the-quick-commerce-wave
- DeHaat (NITI Aayog Frontier Tech): https://frontiertech.niti.gov.in/story/dehaats-ai-enabled-agriculture-network-driving-market-access-and-efficiency-for-1-8-million-farmers/
- KisanKonnect profile: https://www.indianstartuptimes.com/?p=25908
- Agri supply-chain players overview: https://businessconnectindia.in/agritech-supply-chain-companies-india/
- e-NAM quality-testing limits: https://www.impriindia.com/centres/center-for-the-study-for-finance-and-economics/e-nam-vs-mandis-why-asymmetric-quality-testing-limits-price-arbitrage-for-farmers/
- Farmer payment and price-discovery pain points: https://www.kenresearch.com/survey/agri-commodity-trading-platform-farmer-price-discovery-payment-terms-survey
