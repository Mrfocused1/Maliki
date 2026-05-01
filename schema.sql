-- Products
create table if not exists products (
  id text primary key,
  slug text unique not null,
  title text not null,
  subtitle text default '',
  description text default '',
  price_cents integer not null default 0,
  currency text not null default 'GBP',
  category text not null default 'ring',
  metal text default '',
  stone text default '',
  hand_size text default '',
  stock integer,
  published boolean not null default true,
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Product images
create table if not exists product_images (
  id bigserial primary key,
  product_id text not null references products(id) on delete cascade,
  url text not null,
  alt text default '',
  position integer not null default 0
);
create index if not exists product_images_product_id on product_images(product_id);

-- Customers
create table if not exists customers (
  id text primary key,
  name text not null,
  email text unique not null,
  city text default '',
  country text default '',
  joined_at timestamptz not null default now()
);

-- Orders
create table if not exists orders (
  id text primary key,
  number text unique not null,
  customer_id text references customers(id),
  customer_email text not null,
  customer_name text not null,
  subtotal_cents integer not null default 0,
  shipping_cents integer not null default 0,
  total_cents integer not null default 0,
  currency text not null default 'GBP',
  status text not null default 'paid',
  shipping_address jsonb,
  discount_cents integer not null default 0,
  discount_code text not null default '',
  stripe_payment_intent_id text,
  created_at timestamptz not null default now()
);

-- Order items
create table if not exists order_items (
  id bigserial primary key,
  order_id text not null references orders(id) on delete cascade,
  product_id text,
  title text not null,
  image text default '',
  quantity integer not null default 1,
  price_cents integer not null default 0
);
create index if not exists order_items_order_id on order_items(order_id);

-- Subscribers
create table if not exists subscribers (
  id text primary key,
  email text unique not null,
  source text default 'manual',
  status text not null default 'subscribed',
  subscribed_at timestamptz not null default now()
);

-- Discounts
create table if not exists discounts (
  id text primary key,
  code text unique not null,
  type text not null default 'percent',
  value numeric not null default 0,
  minimum_cents integer not null default 0,
  applies_to text default 'all',
  status text not null default 'active',
  starts_at timestamptz,
  ends_at timestamptz,
  usage_count integer not null default 0,
  usage_limit integer,
  description text default '',
  created_at timestamptz not null default now()
);

-- Pages
create table if not exists pages (
  id text primary key,
  slug text unique not null,
  title text not null,
  body text default '',
  status text not null default 'published',
  updated_at timestamptz not null default now()
);

-- Settings (one row per section)
create table if not exists settings (
  section text primary key,
  value jsonb not null default '{}'
);

-- Email templates
create table if not exists email_templates (
  key text primary key,
  subject text not null default '',
  body text not null default '',
  updated_at timestamptz not null default now()
);

-- Page views (analytics)
create table if not exists page_views (
  id bigserial primary key,
  path text not null,
  referrer text default '',
  created_at timestamptz not null default now()
);

-- Email log
create table if not exists email_log (
  id text primary key,
  template_key text,
  recipient_email text not null,
  recipient_name text default '',
  subject text default '',
  order_id text,
  status text not null default 'queued',
  sent_at timestamptz not null default now(),
  opened_at timestamptz
);
