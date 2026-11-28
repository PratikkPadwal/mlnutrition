# ML Nutrition — mobile performance audit (28 November 2026)

## Scope and methodology

Audited the production website `https://www.mlnutrition.in` using Lighthouse 13.6 with mobile emulation and Chromium from a temporary Vercel Sandbox in Mumbai (India). The Google PageSpeed Insights API returned HTTP 429 (quota exhausted), so independently measured Lighthouse lab results are used instead. These are **single synthetic runs**, not real-user Core Web Vitals or guaranteed scores for every phone, network or location.

| Production URL | Lighthouse performance | First Contentful Paint | Largest Contentful Paint | CLS | Transfer | Requests |
|---|---:|---:|---:|---:|---:|---:|
| `/` | 100/100 | 0.9 s | 0.9 s | 0 | 1.78 MB | 35 |
| `/products.html` | 74/100 | 1.7 s | 12.2 s | 0 | 8.51 MB | 39 |
| `/product.html?id=1` | 76/100 | 1.7 s | 6.6 s | 0 | 1.02 MB | 26 |

The main opportunity is **product image transfer and priority**. The homepage transfers about 1.71 MB of image data. The catalogue transfers about 8.33 MB of image data, with roughly 7.99 MB from third-party resources. Three Avvatar product images alone represented approximately 2,171 KB, 1,926 KB and 1,655 KB respectively (roughly 5.75 MB combined). One mobile catalogue LCP diagnostic identified a product card's visible image as lazy-loaded without high fetch priority.

## Optimizations implemented in preview branch

1. **Small, cached catalogue thumbnails:** For the *specific* external host `www.avvatarindia.com/images/product_images/`, catalogue cards now request a 384 px/quality 70 optimized image from Vercel Image Optimization. The original source URL is retained and used if optimization fails; only the listing thumbnail changes, not the full-resolution product detail/gallery.
2. **First visible product images:** First two catalogue cards explicitly use `loading="eager"` and `fetchpriority="high"`. Other cards remain lazy/low priority.
3. **Homepage image scheduling:** The center hero product image is prioritized, while category cards and featured products are lazy/low priority.
4. **Brand images:** Below-the-fold third-party brand logos do not initiate network requests until their carousel item is near the viewport (IntersectionObserver, with a fallback for older browsers).
5. **Product image gallery:** The initial displayed product image is eager/high priority. Other slides and thumbnails are lazy/low priority; user-activated slides switch to eager to avoid delays.
6. **No functional shopping changes:** Cart/checkout stock validation, price calculations, GA4, Google Sheets catalogue and the supplied original ML Nutrition logo are unchanged.

### Optimization validation

The new Vercel endpoint on the preview deployment returned **HTTP 200**, with content-length **16,192 bytes** for Avvatar's previously ~2.17 MB `1757488551_FOP.jpg` source. This confirms substantial transfer reduction **for that one image**. Other sources, image sizes, network conditions and actual full-page totals may differ.

**Potential Vercel charges:** Vercel Image Optimization may incur transformation/cache usage charges; the configuration restricts both source domain and valid widths/qualities to avoid arbitrary proxying. Monitor Vercel Usage after release.

**External image reliability:** Some original third-party image URLs responded with HTTP 403 to automated HEAD requests. Browser results may differ; this change does not silently replace product images with incorrect imagery. Broken external assets need a separate controlled catalogue quality review.

## Verification and remaining work

- JavaScript syntax and 12 regression tests passed.
- Latest preview build READY; production remains unchanged.
- **Before-and-after Lighthouse score not verified:** The preview deployment is access-protected and could not be loaded directly by the external Lighthouse browser. Vercel's authenticated fetch confirmed preview assets and successful optimization; we must not claim a new PageSpeed score.
- Before merging: manually verify the preview on a phone, especially catalogue product thumbnails, flavour selection, product gallery swipe/lightbox, brand carousel and Add to Cart.
- After merging: rerun mobile Lighthouse on the same production URLs and compare transfer size, LCP and image errors. Test multiple runs on a slower mobile network for more representative results.
- Future priorities: verify/correct high-resolution images and 403-prone image hosts; avoid modifying the official ML Nutrition logo artwork; monitor GA4 and Google Search Console Core Web Vitals.

