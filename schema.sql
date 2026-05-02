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
  status text not null default 'pending',
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
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Pages
create table if not exists pages (
  id text primary key,
  slug text unique not null,
  title text not null,
  body text default '',
  status text not null default 'published',
  metadata jsonb,
  created_at timestamptz not null default now(),
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
  name text not null default '',
  description text,
  subject text not null default '',
  body text not null default '',
  enabled boolean not null default false,
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

-- Analytics extensions to page_views (idempotent)
alter table page_views add column if not exists session_id text;
alter table page_views add column if not exists visitor_id text;
alter table page_views add column if not exists user_agent text;
alter table page_views add column if not exists country text;
alter table page_views add column if not exists screen text;
alter table page_views add column if not exists utm_source text;
alter table page_views add column if not exists utm_medium text;
alter table page_views add column if not exists utm_campaign text;

create index if not exists page_views_created_at_idx on page_views(created_at desc);
create index if not exists page_views_path_idx on page_views(path);
create index if not exists page_views_session_idx on page_views(session_id);
create index if not exists page_views_visitor_idx on page_views(visitor_id);

-- Customer accounts (linked to Supabase Auth users)
create table if not exists customer_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  email text not null default '',
  line1 text not null default '',
  line2 text not null default '',
  city text not null default '',
  postal text not null default '',
  country text not null default '',
  updated_at timestamptz not null default now()
);

alter table customer_profiles enable row level security;

create policy "customer_profiles_own_select" on customer_profiles
  for select using (auth.uid() = user_id);
create policy "customer_profiles_own_insert" on customer_profiles
  for insert with check (auth.uid() = user_id);
create policy "customer_profiles_own_update" on customer_profiles
  for update using (auth.uid() = user_id);

create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.customer_profiles (user_id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', ''))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_auth_user();

-- Feature expansion (reviews, restock alerts, referrals, order/product/profile extensions)
create table if not exists product_reviews (
  id text primary key,
  product_id text not null,
  customer_name text not null default '',
  customer_email text not null default '',
  rating integer not null check (rating between 1 and 5),
  title text default '',
  body text not null default '',
  verified_purchase boolean default false,
  approved boolean default false,
  created_at timestamptz not null default now()
);
create index if not exists product_reviews_product_idx on product_reviews(product_id, approved);

create table if not exists restock_alerts (
  id text primary key,
  product_id text not null,
  email text not null,
  notified boolean default false,
  created_at timestamptz not null default now(),
  unique(product_id, email)
);
create index if not exists restock_alerts_product_idx on restock_alerts(product_id, notified);

create table if not exists referrals (
  id text primary key,
  referral_code text not null,
  referee_email text not null,
  order_id text,
  created_at timestamptz not null default now()
);

alter table orders add column if not exists gift_wrap boolean default false;
alter table orders add column if not exists gift_message text default '';
alter table orders add column if not exists tracking_url text default '';
alter table orders add column if not exists engraving_text text default '';

alter table customer_profiles add column if not exists wishlist jsonb default '[]';
alter table customer_profiles add column if not exists comms_prefs jsonb default '{"new_collections": true, "restock_alerts": true, "order_updates": true}';
alter table customer_profiles add column if not exists referral_code text;
alter table customer_profiles add column if not exists referred_by text;

alter table products add column if not exists engraving_enabled boolean default false;
alter table products add column if not exists engraving_label text default 'Add a personal engraving';
alter table products add column if not exists engraving_max_chars integer default 20;

-- Atomic counters: avoid read-modify-write races when concurrent webhooks
-- decrement stock or increment discount usage_count for the same row.
create or replace function decrement_stock(p_id text, p_qty integer)
returns void
language sql
security definer
set search_path = public
as $$
  update products
  set stock = greatest(0, stock - p_qty)
  where id = p_id and stock is not null;
$$;

create or replace function increment_discount_usage(p_code text)
returns void
language sql
security definer
set search_path = public
as $$
  update discounts
  set usage_count = usage_count + 1
  where code = p_code;
$$;

grant execute on function decrement_stock(text, integer) to anon, authenticated, service_role;
grant execute on function increment_discount_usage(text) to anon, authenticated, service_role;
