# Jewellery Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Change Maliki Atelier from a rings-only store to a general fine jewellery brand across all copy, admin UI, and product logic.

**Architecture:** Four independent change sets — API/schema defaults, admin product form, frontend copy (homepage + shop + product page), and about page. No DB migration required; the existing `hand_size` column is repurposed via UI relabelling only.

**Tech Stack:** Vanilla JS, HTML, Node.js (no build step — edits go live immediately via local-server.js)

---

## Task 1: Remove ring defaults from API & schema

**Files:**
- Modify: `api/admin/products.js:21`
- Modify: `assets/store.js:95`
- Modify: `schema.sql` (one line)

- [ ] **Step 1: Remove `category ||= 'ring'` from products API**

In `api/admin/products.js`, find and remove line 21:
```js
// BEFORE (line 21)
out.category ||= 'ring';

// AFTER — delete the line entirely
```

- [ ] **Step 2: Fix category default in store.js**

In `assets/store.js`, change line 95:
```js
// BEFORE
category: 'ring',

// AFTER
category: String(data.category || 'jewellery'),
```

- [ ] **Step 3: Update schema default**

In `schema.sql`, change:
```sql
-- BEFORE
category text not null default 'ring',

-- AFTER
category text not null default 'jewellery',
```

- [ ] **Step 4: Commit**

```bash
git add api/admin/products.js assets/store.js schema.sql
git commit -m "fix: remove ring-only category defaults from API and schema"
```

---

## Task 2: Admin UI — category dropdown + category-aware size field

**Files:**
- Modify: `admin/index.html`

There are three sub-changes: (a) add category `<select>` to the product form template, (b) add JS to make size field react to category selection, (c) update `collectProductForm()` to read the new field.

- [ ] **Step 1: Add category select to the product form template**

In `admin/index.html`, find the subtitle form row (around line 1501–1504):
```html
    <div class="form-row">
      <label for="f-subtitle">Subtitle</label>
      <input class="input" id="f-subtitle" placeholder="e.g. Brilliant-cut diamond solitaire" value="${escape(p?.subtitle || '')}" />
    </div>
```

Replace it with:
```html
    <div class="form-row">
      <label for="f-subtitle">Subtitle</label>
      <input class="input" id="f-subtitle" placeholder="e.g. Hand-finished 18ct gold pendant" value="${escape(p?.subtitle || '')}" />
    </div>
    <div class="form-row">
      <label for="f-category">Category</label>
      <select class="input" id="f-category">
        <option value="ring"${(p?.category || 'ring') === 'ring' ? ' selected' : ''}>Ring</option>
        <option value="necklace"${p?.category === 'necklace' ? ' selected' : ''}>Necklace</option>
        <option value="earring"${p?.category === 'earring' ? ' selected' : ''}>Earring</option>
        <option value="bracelet"${p?.category === 'bracelet' ? ' selected' : ''}>Bracelet</option>
        <option value="brooch"${p?.category === 'brooch' ? ' selected' : ''}>Brooch</option>
        <option value="anklet"${p?.category === 'anklet' ? ' selected' : ''}>Anklet</option>
        <option value="pendant"${p?.category === 'pendant' ? ' selected' : ''}>Pendant</option>
      </select>
    </div>
```

- [ ] **Step 2: Add `id` attributes to the size field wrapper and label**

Find the size field inside the split-3 row (around line 1539–1542):
```html
      <div class="form-row" style="margin:0">
        <label for="f-size">Hand size</label>
        <input class="input" id="f-size" placeholder="e.g. UK J – Q" value="${escape(p?.hand_size || '')}" />
      </div>
```

Replace it with:
```html
      <div class="form-row" id="sizeRow" style="margin:0">
        <label id="sizeLbl" for="f-size">Ring size</label>
        <input class="input" id="f-size" placeholder="e.g. UK J–Q" value="${escape(p?.hand_size || '')}" />
      </div>
```

- [ ] **Step 3: Add category-aware size field JS after the form template is set**

Find the slug auto-fill setup that begins after `$('#drawerBody').innerHTML = ...` (around line 1570):
```js
  // Slug auto-fill
  let slugTouched = !!p?.slug;
```

Insert this block immediately before that comment:
```js
  // Category-aware size field
  const SIZE_MAP = {
    ring:      ['Ring size',     'e.g. UK J–Q'],
    necklace:  ['Chain length',  'e.g. 40cm, 45cm, 50cm'],
    pendant:   ['Chain length',  'e.g. 40cm, 45cm, 50cm'],
    bracelet:  ['Length',        'e.g. 16cm, 18cm, 20cm'],
    anklet:    ['Length',        'e.g. 16cm, 18cm, 20cm'],
  };
  const updateSizeField = () => {
    const cat = $('#f-category').value;
    const sizeRow = document.getElementById('sizeRow');
    const sizeLbl = document.getElementById('sizeLbl');
    const sizeInput = $('#f-size');
    const entry = SIZE_MAP[cat];
    if (entry) {
      sizeRow.style.display = '';
      sizeLbl.textContent = entry[0];
      sizeInput.placeholder = entry[1];
    } else {
      sizeRow.style.display = 'none';
    }
  };
  $('#f-category').addEventListener('change', updateSizeField);
  updateSizeField();

```

- [ ] **Step 4: Add `category` to `collectProductForm()`**

Find `collectProductForm()` (around line 1636). The `return { ... }` block currently starts with:
```js
  return {
    title: $('#f-title').value.trim(),
    subtitle: $('#f-subtitle').value.trim(),
```

Add `category` on the line after `subtitle`:
```js
  return {
    title: $('#f-title').value.trim(),
    subtitle: $('#f-subtitle').value.trim(),
    category: $('#f-category').value,
```

- [ ] **Step 5: Commit**

```bash
git add admin/index.html
git commit -m "feat: add category dropdown and category-aware size field to admin product form"
```

---

## Task 3: Homepage copy

**Files:**
- Modify: `home/index.html`

- [ ] **Step 1: Update `<title>` (line 6)**

```html
<!-- BEFORE -->
<title>Maliki Atelier — Hand-finished Rings, London</title>

<!-- AFTER -->
<title>Maliki Atelier — Hand-finished Jewellery, London</title>
```

- [ ] **Step 2: Update `<meta name="description">` (line 7)**

```html
<!-- BEFORE -->
<meta name="description" content="Maliki Atelier — twelve rings, hand-finished in London. Made by hand, for a person whose name we know." />

<!-- AFTER -->
<meta name="description" content="Maliki Atelier — hand-finished fine jewellery, made in London. One piece at a time, for a person whose name we know." />
```

- [ ] **Step 3: Update OG and Twitter titles (lines 15, 22)**

```html
<!-- BEFORE (both lines) -->
content="Maliki Atelier — Hand-finished Rings, London"

<!-- AFTER (both lines) -->
content="Maliki Atelier — Hand-finished Jewellery, London"
```

- [ ] **Step 4: Update OG description (line 16)**

```html
<!-- BEFORE -->
<meta property="og:description" content="Made by hand, for a person whose name we know. Twelve rings, hand-finished in London." />

<!-- AFTER -->
<meta property="og:description" content="Made by hand, for a person whose name we know. Hand-finished fine jewellery, made in London." />
```

- [ ] **Step 5: Update hero CTA (line 665)**

```html
<!-- BEFORE -->
<a href="/shop" class="hero-cta reveal r5">Discover the rings</a>

<!-- AFTER -->
<a href="/shop" class="hero-cta reveal r5">Discover the collection</a>
```

- [ ] **Step 6: Update collection link (line 680)**

```html
<!-- BEFORE -->
<a href="/shop">View all twelve &rarr;</a>

<!-- AFTER -->
<a href="/shop">View the collection &rarr;</a>
```

- [ ] **Step 7: Update story copy (line 697)**

```html
<!-- BEFORE -->
Maliki Atelier was founded as a considered response to the noise of the modern jewellery industry — a return to the practice of making one piece at a time, by hand, for a person whose name we know. Each ring is hand-finished in our London workshop, in metals we cast ourselves from recycled gold and platinum, and stones sourced through long-standing relationships in Antwerp, Bogotá, and Yangon.

<!-- AFTER -->
Maliki Atelier was founded as a considered response to the noise of the modern jewellery industry — a return to the practice of making one piece at a time, by hand, for a person whose name we know. Each piece is hand-finished in our London workshop, in metals we cast ourselves from recycled gold and platinum, and stones sourced through long-standing relationships in Antwerp, Bogotá, and Yangon.
```

- [ ] **Step 8: Commit**

```bash
git add home/index.html
git commit -m "fix: update homepage copy from rings to jewellery"
```

---

## Task 4: Shop listing copy

**Files:**
- Modify: `shop/index.html`

- [ ] **Step 1: Update meta description (line 7)**

```html
<!-- BEFORE -->
<meta name="description" content="The Maliki Atelier ring collection." />

<!-- AFTER -->
<meta name="description" content="The Maliki Atelier collection." />
```

- [ ] **Step 2: Update OG description (line 13)**

```html
<!-- BEFORE -->
<meta property="og:description" content="Discover hand-finished fine jewellery rings from Maliki Atelier." />

<!-- AFTER -->
<meta property="og:description" content="Discover hand-finished fine jewellery from Maliki Atelier." />
```

- [ ] **Step 3: Update JSON-LD description (line 28)**

```js
// BEFORE
"description": "The Maliki Atelier ring collection.",

// AFTER
"description": "The Maliki Atelier collection.",
```

- [ ] **Step 4: Update lede (line 380)**

```html
<!-- BEFORE -->
<p class="lede">Twelve pieces, hand-finished in the atelier. Each one made to be worn for a long time.</p>

<!-- AFTER -->
<p class="lede">Hand-finished pieces, made in the atelier. Each one made to be worn for a long time.</p>
```

- [ ] **Step 5: Commit**

```bash
git add shop/index.html
git commit -m "fix: update shop listing copy from rings to jewellery"
```

---

## Task 5: Product page — meta, size guide removal, category-aware size label

**Files:**
- Modify: `shop/product.html`

- [ ] **Step 1: Update three meta description tags (lines 7, 12, 17)**

```html
<!-- BEFORE (all three) -->
content="A piece from the Maliki Atelier ring collection."

<!-- AFTER (all three) -->
content="A piece from the Maliki Atelier collection."
```

- [ ] **Step 2: Remove the Ring Size Guide modal (lines 593–623)**

Delete this entire block:
```html
  <!-- Ring size guide modal -->
  <div class="modal-overlay" id="sizeModal" role="dialog" aria-modal="true" aria-label="Ring size guide">
    <div class="modal-box">
      <button class="modal-close" id="sizeModalClose" aria-label="Close size guide">&times;</button>
      <h2 class="modal-title">Ring Size Guide</h2>
      <table class="size-table">
        <thead>
          <tr>
            <th>UK</th>
            <th>EU</th>
            <th>US</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>G</td><td>44</td><td>3.5</td></tr>
          <tr><td>K</td><td>49</td><td>5.5</td></tr>
          <tr><td>M</td><td>52</td><td>6.5</td></tr>
          <tr><td>O</td><td>55</td><td>7.5</td></tr>
          <tr><td>P</td><td>57</td><td>8</td></tr>
          <tr><td>Q</td><td>58</td><td>8.5</td></tr>
          <tr><td>R</td><td>60</td><td>9</td></tr>
          <tr><td>S</td><td>62</td><td>9.5</td></tr>
          <tr><td>T</td><td>63</td><td>10</td></tr>
          <tr><td>U</td><td>65</td><td>10.5</td></tr>
        </tbody>
      </table>
      <div class="modal-measure">
        <strong>How to measure:</strong> wrap a thin strip of paper around your finger, mark where it overlaps, measure the length in mm. Use the chart above to find your size.
      </div>
    </div>
  </div>
```

- [ ] **Step 3: Replace hand_size spec row + remove size guide button (lines 1102, 1106)**

Find:
```js
              ${p.hand_size ? `<div><div class="label">Hand size</div><div class="value">${escape(p.hand_size)}</div></div>` : ''}
              <div><div class="label">Delivery</div><div class="value">White-glove, insured</div></div>
            </div>

            <button class="size-guide-link" id="sizeGuideBtn" type="button" aria-haspopup="dialog">Ring size guide &rarr;</button>
```

Replace with:
```js
              ${p.hand_size && !['earring','brooch'].includes(p.category) ? `<div><div class="label">${escape(({'ring':'Ring size','necklace':'Chain length','pendant':'Chain length','bracelet':'Length','anklet':'Length'})[p.category] || 'Size')}</div><div class="value">${escape(p.hand_size)}</div></div>` : ''}
              <div><div class="label">Delivery</div><div class="value">White-glove, insured</div></div>
            </div>
```

- [ ] **Step 4: Remove size guide JS event listeners**

Find and delete this block (around line 1172–1176):
```js
      // Size guide modal
      document.getElementById('sizeGuideBtn').addEventListener('click', () => {
        document.getElementById('sizeModal').classList.add('open');
        document.getElementById('sizeModalClose').focus();
      });
```

Find and delete this block (around line 1260–1271):
```js
    document.getElementById('sizeModalClose').addEventListener('click', () => {
      document.getElementById('sizeModal').classList.remove('open');
    });
    document.getElementById('sizeModal').addEventListener('click', (e) => {
      if (e.target === document.getElementById('sizeModal')) {
        document.getElementById('sizeModal').classList.remove('open');
      }
    });
    const sizeModalKeydown = (e) => {
      if (e.key === 'Escape') document.getElementById('sizeModal').classList.remove('open');
    };
    document.addEventListener('keydown', sizeModalKeydown);
```

- [ ] **Step 5: Remove the `.size-guide-link` CSS rule (around lines 185–195)**

Find and delete:
```css
  .size-guide-link {
```
through its closing `}` (the entire rule block for `.size-guide-link` and `.size-guide-link:hover`).

- [ ] **Step 6: Commit**

```bash
git add shop/product.html
git commit -m "fix: update product page — generalise copy, remove ring size guide, add category-aware size label"
```

---

## Task 6: About page copy

**Files:**
- Modify: `about/index.html`

- [ ] **Step 1: Update meta description (line 7)**

```html
<!-- BEFORE -->
<meta name="description" content="The story of Maliki Atelier — hand-finished rings made in London, one piece at a time." />

<!-- AFTER -->
<meta name="description" content="The story of Maliki Atelier — hand-finished jewellery made in London, one piece at a time." />
```

- [ ] **Step 2: Update OG description (line 12)**

```html
<!-- BEFORE -->
<meta property="og:description" content="The story of Maliki Atelier — hand-finished rings made in London, one piece at a time." />

<!-- AFTER -->
<meta property="og:description" content="The story of Maliki Atelier — hand-finished jewellery made in London, one piece at a time." />
```

- [ ] **Step 3: Update lede (line 311)**

```html
<!-- BEFORE -->
<p class="lede">A quiet practice, a long tradition, and twelve rings made to be worn for a lifetime.</p>

<!-- AFTER -->
<p class="lede">A quiet practice, a long tradition, and pieces made to be worn for a lifetime.</p>
```

- [ ] **Step 4: Update "Each ring" in Our Story (line 322)**

```html
<!-- BEFORE -->
<p>Each ring is hand-finished in our London workshop, in metals we cast ourselves from recycled gold and platinum, set with stones sourced through long-standing relationships in Antwerp, Bogotá, and Yangon. There are twelve pieces in the collection. Not twelve styles — twelve pieces. When one is sold, another is made. That is the model, and we intend to keep it.</p>

<!-- AFTER -->
<p>Each piece is hand-finished in our London workshop, in metals we cast ourselves from recycled gold and platinum, set with stones sourced through long-standing relationships in Antwerp, Bogotá, and Yangon. Every piece in the collection is made to order — when one is commissioned, it is made. That is the model, and we intend to keep it.</p>
```

- [ ] **Step 5: Update "A ring that passes" in Craftsmanship (line 345)**

```html
<!-- BEFORE -->
<p>We believe the materials are inseparable from the meaning. A ring that passes from one generation to the next carries the quality of its making as a kind of memory.</p>

<!-- AFTER -->
<p>We believe the materials are inseparable from the meaning. A piece that passes from one generation to the next carries the quality of its making as a kind of memory.</p>
```

- [ ] **Step 6: Update Care instructions (line 363)**

```html
<!-- BEFORE -->
<p>Remove your ring before sleep, exercise, gardening, or contact with chlorinated water. Store it in its presentation case when not being worn. These are small habits that preserve the finish and the integrity of the setting.</p>

<!-- AFTER -->
<p>Remove your jewellery before sleep, exercise, gardening, or contact with chlorinated water. Store each piece in its presentation case when not being worn. These are small habits that preserve the finish and the integrity of the setting.</p>
```

- [ ] **Step 7: Commit**

```bash
git add about/index.html
git commit -m "fix: update about page copy from rings to jewellery"
```
