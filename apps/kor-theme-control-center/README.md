# Kor Theme Control Center

Embedded app (React + Polaris + App Bridge + Admin GraphQL) to control this theme via `shop.metafields.kor_theme.*`.

## What It Controls

- `gsap_enabled`, `gsap_quality`, `gsap_enable_desktop`, `gsap_enable_mobile`
- `homepage_featured_collection_handle`, `homepage_products_limit`
- `why_us_eyebrow`, `why_us_title`, `why_us_subtitle`
- `why_us_item_1_title/text` ... `why_us_item_4_title/text`

## Required Shopify Access Scopes

- `read_products`
- `write_metafields`

## Local Setup

1. Copy `.env.example` to `.env` and fill your app credentials.
2. Install dependencies:

```bash
npm install
```

3. Start in dev mode:

```bash
npm run dev
```

- API server: `http://localhost:3001`
- Frontend: `http://localhost:5173`

In an embedded context, App Bridge injects session tokens into requests so `/api/settings` and `/api/settings` (PUT) can exchange for Admin API tokens.

## OAuth / Install Note

This mini app focuses on the control-center flows (UI + App Bridge + Admin API token exchange).  
For production install/auth routes, mount it inside your existing Shopify app shell or scaffold with Shopify CLI and reuse these `src/` + `server/` modules.

## Build

```bash
npm run build
npm start
```
