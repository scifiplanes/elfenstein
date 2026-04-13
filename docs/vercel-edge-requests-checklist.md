# Vercel edge requests checklist (static Vite deploy)

This project is deployed as a static site (Vite `dist/`). On Vercel, every static asset fetch is served via the edge network, so overall **Edge Requests** scale roughly with:

- unique visitors × (requests on a cold load)
- returning visitors × (requests that miss CDN/browser cache)

## 1) Identify what’s driving requests

In the Vercel dashboard for the project:

- Open **Analytics** and locate the view that breaks down requests by **path** (or “Top paths”).
- Group/eyeball by **prefix** and estimate the share:
  - **`/assets/`**: Vite hashed JS/CSS chunks (should be immutable-cached)
  - **`/content/`**: PNG art copied from repo `Content/` (stable filenames)
  - **`/debug-settings.json`**
  - **`/index.html`**

If your edge requests are dominated by:

- **`/content/`**: you’re paying for “lots of small files” + cache misses/revalidations.
- **`/assets/`**: caching headers or deploy root config may be off (hashed assets should rarely refetch after warm).
- **`/index.html`**: HTML caching policy may be too strict for your traffic (see §2 below).

## 2) Verify caching headers are behaving as intended

In Chrome DevTools → Network:

- Hard refresh once (cold). Click a representative file from each bucket:
  - `/index.html`
  - one `/assets/*.js`
  - one `/content/*.png`
  - `/debug-settings.json`
- Confirm the response `Cache-Control` matches the intended policy from `web/vercel.json` (expect **`s-maxage`** on **`/`**, **`/index.html`**, **`/content/*`**, and **`/sounds/*`** as committed).
- Reload again and verify most `/assets/*` and many `/content/*` requests come from **(disk cache)** or show **0B transferred** / `304` patterns depending on policy.

## 3) What to change based on results

- If `/index.html` is a disproportionate share, add a small **CDN shared-cache window** (`s-maxage`) while keeping browsers at `max-age=0`.
- If `/content/*` is dominant, consider splitting browser vs CDN TTL (`max-age` vs `s-maxage`) and tuning `stale-while-revalidate` to raise CDN hit rate without pinning art forever.

