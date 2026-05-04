# Jewellery Expansion — Design Spec
_Date: 2026-05-04_

## Overview

Change Maliki Atelier from a rings-only store to a general fine jewellery brand. All copy, admin UI, and product logic must reflect jewellery broadly. No database migration is required.

---

## 1. Data & API Layer

**Files:** `api/admin/products.js`, `assets/store.js`, `schema.sql`

- Remove `category ||= 'ring'` default from `api/admin/products.js`.
- Remove `category: 'ring'` hardcoded default from `assets/store.js` `addProduct()`.
- Update `schema.sql`: `category text not null default 'ring'` → `category text not null default 'jewellery'`.
- The `hand_size` DB column is retained unchanged. All UI relabels it dynamically based on selected category.
- Supported category values: `ring`, `necklace`, `earring`, `bracelet`, `brooch`, `anklet`, `pendant`.

---

## 2. Admin UI

**File:** `admin/index.html`

- **Category field**: Replace free-text input with a `<select>` dropdown:
  - Ring, Necklace, Earring, Bracelet, Brooch, Anklet, Pendant
- **Category-aware size field** (still submits as `hand_size`):
  - Ring → label "Ring size", placeholder "e.g. UK J–Q"
  - Necklace / Pendant → label "Chain length", placeholder "e.g. 40cm, 45cm, 50cm"
  - Bracelet / Anklet → label "Length", placeholder "e.g. 16cm, 18cm, 20cm"
  - Earring / Brooch → field hidden entirely
- **Subtitle placeholder**: Change from "e.g. Brilliant-cut diamond solitaire" → "e.g. Hand-finished 18ct gold pendant"

---

## 3. Frontend Copy

### Homepage (`home/index.html`)
| Element | Before | After |
|---|---|---|
| `<title>` | Maliki Atelier — Hand-finished Rings, London | Maliki Atelier — Hand-finished Jewellery, London |
| `<meta name="description">` | …twelve rings, hand-finished in London… | …hand-finished fine jewellery, made in London. One piece at a time, for a person whose name we know. |
| `og:title` / `twitter:title` | …Hand-finished Rings, London | …Hand-finished Jewellery, London |
| `og:description` | …Twelve rings, hand-finished in London. | …Made by hand, for a person whose name we know. Hand-finished fine jewellery, made in London. |
| Hero CTA | Discover the rings | Discover the collection |
| Collection link | View all twelve → | View the collection → |
| Story copy | Each ring is hand-finished… | Each piece is hand-finished… |

### Shop Listing (`shop/index.html`)
| Element | Before | After |
|---|---|---|
| `<meta name="description">` | The Maliki Atelier ring collection. | The Maliki Atelier collection. |
| `og:description` | Discover hand-finished fine jewellery rings from Maliki Atelier. | Discover hand-finished fine jewellery from Maliki Atelier. |
| JSON-LD description | The Maliki Atelier ring collection. | The Maliki Atelier collection. |
| Lede | Twelve pieces, hand-finished in the atelier… | Hand-finished pieces, made in the atelier. Each one made to be worn for a long time. |

### Product Page (`shop/product.html`)
| Element | Before | After |
|---|---|---|
| `<meta name="description">` | A piece from the Maliki Atelier ring collection. | A piece from the Maliki Atelier collection. |
| `og:description` | A piece from the Maliki Atelier ring collection. | A piece from the Maliki Atelier collection. |
| `twitter:description` | A piece from the Maliki Atelier ring collection. | A piece from the Maliki Atelier collection. |
| Ring Size Guide modal | Present | Removed entirely |
| "Ring size guide →" button | Present | Removed entirely |
| `hand_size` display label | "Hand size" | Category-aware label (Ring size / Chain length / Length / hidden) |

### About Page (`about/index.html`)
| Element | Before | After |
|---|---|---|
| `<meta name="description">` | …hand-finished rings made in London… | …hand-finished jewellery made in London, one piece at a time. |
| `og:description` | …hand-finished rings made in London… | …hand-finished jewellery made in London, one piece at a time. |
| Lede | A quiet practice…and twelve rings made to be worn for a lifetime. | A quiet practice, a long tradition, and pieces made to be worn for a lifetime. |
| Body copy | Each ring is hand-finished… | Each piece is hand-finished… |

---

## 4. ring-svg.js & mock-data.js

- **`assets/ring-svg.js`**: No changes. SVG renders only when category is `ring` and no image is present. Other categories fall back to no placeholder.
- **`assets/mock-data.js`**: No changes. Demo seed data only, not visible to real users.

---

## Out of Scope

- No `ALTER TABLE` DB migration (column rename `hand_size` → `size` deferred).
- No changes to checkout, order, or customer flows.
- No new placeholder images for non-ring categories.
