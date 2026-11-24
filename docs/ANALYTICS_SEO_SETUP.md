# ML Nutrition — Phase 4 analytics and Google indexing

The tracking code and sitemap improvements are prepared in `feature/analytics-seo-foundations-v22`. **Neither GA4 data collection nor Search Console property verification is enabled by this code alone.** Website ownership and the Google account belong to ML Nutrition.

## 1. Activate GA4

1. Sign in at https://analytics.google.com/ using the ML Nutrition Google account.
2. Create or select a **Google Analytics 4** property and add a **Web** data stream for `https://www.mlnutrition.in`.
3. Copy the **Measurement ID** beginning with `G-` (not a Measurement Protocol API secret, password or service key).
4. ML Nutrition's verified web-stream Measurement ID `G-4HQ3W72C7E` is now configured in `analytics-config.js` on the Phase 4 preview branch. Deploy this reviewed change to `main` once approved.
5. Open the production website, choose **Allow analytics**, then test Google Analytics **Realtime** and **DebugView**. The script must not load if the visitor declines analytics.

Analytics events: `view_item`, `add_to_cart`, `begin_checkout`, `search`, `select_item` (autocomplete result selection), `whatsapp_enquiry_click`. A WhatsApp checkout handoff is **not** a completed purchase. Do not mark it as revenue or a `purchase` event. Price ranges and products without fixed prices do not send invented prices or values.

## 2. Verify the website in Google Search Console

1. Visit https://search.google.com/search-console/ and add a **URL-prefix** property for exactly `https://www.mlnutrition.in/`.
2. Select **HTML tag** verification and add Google's actual verification meta tag to the `<head>` of `index.html`. Never use a placeholder verification code. Keep this verification meta tag after Google confirms ownership.
   - Alternatively, use a **Domain** property and verify using the TXT record Google supplies in the domain's DNS settings.
3. When the production sitemap routes have been released, submit:
   - `https://www.mlnutrition.in/sitemap.xml`
   - `https://www.mlnutrition.in/products-sitemap.xml`
4. Inspect real product URLs via Search Console's **URL Inspection** tool. Query-string product pages use client-rendered content/canonical tags; sitemap submission improves discovery, but does not guarantee indexing.

## 3. Sitemap source and reliability

- `sitemap.xml` lists known canonical public pages; outdated fabricated `lastmod` dates were removed.
- `products-sitemap.xml` rewrites to `api/products-sitemap.js`, which reads **real product IDs** from the same public Google Sheet used by `product.html`.
- No prices, product claims or last-modified dates are invented for the sitemap. If the Sheet is unavailable, the endpoint responds 503 instead of publishing an empty catalogue sitemap.
- `robots.txt` advertises both sitemap URLs.
- Production Google indexing cannot be verified until Search Console ownership is completed.

## 4. Privacy and testing

- Google Analytics loads **only after explicit opt-in** and only if a genuine Measurement ID is configured.
- Visitors who refuse still can browse products and use the cart. Preferences can be changed through the Privacy Policy page.
- Test on real phones after activation. Verify the banner appears, rejecting it makes no Google Analytics request, and opt-in records test events in GA4.
- The analytics preference is stored in browser local storage; optional analytics is disabled by default.
