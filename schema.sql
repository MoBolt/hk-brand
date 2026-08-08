-- =========================================================
-- HK Brand - Supabase Schema
-- Tables: orders, order_items, newsletter_subscribers, promo_codes
-- =========================================================

create extension if not exists "uuid-ossp";

-- =========================================================
-- TABLE: orders
-- =========================================================
create table if not exists orders (
    id uuid primary key default uuid_generate_v4(),
    order_number text unique not null,
    stripe_payment_intent_id text unique not null,

    customer_name text not null,
    customer_email text not null,
    customer_phone text,

    shipping_address text not null,
    shipping_city text not null,
    shipping_province text not null,
    shipping_postal_code text not null,
    shipping_country text default 'CA',

    subtotal_cents integer not null,
    shipping_cents integer not null default 1000,
    tax_tps_cents integer default 0,
    tax_tvq_cents integer default 0,
    tax_tvh_cents integer default 0,
    tax_pst_cents integer default 0,
    discount_cents integer default 0,
    total_cents integer not null,

    promo_code text,

    status text not null default 'paid'
        check (status in ('pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_orders_email on orders(customer_email);
create index if not exists idx_orders_status on orders(status);
create index if not exists idx_orders_created_at on orders(created_at desc);

-- =========================================================
-- TABLE: order_items
-- =========================================================
create table if not exists order_items (
    id uuid primary key default uuid_generate_v4(),
    order_id uuid not null references orders(id) on delete cascade,

    product_name text not null,
    product_variant text,
    quantity integer not null default 1,
    unit_price_cents integer not null,
    line_total_cents integer not null,

    created_at timestamptz not null default now()
);

create index if not exists idx_order_items_order_id on order_items(order_id);

-- =========================================================
-- TABLE: newsletter_subscribers
-- =========================================================
create table if not exists newsletter_subscribers (
    id uuid primary key default uuid_generate_v4(),
    email text unique not null,
    subscribed_at timestamptz not null default now(),
    is_active boolean not null default true,
    source text default 'website_modal'
);

create index if not exists idx_newsletter_email on newsletter_subscribers(email);

-- =========================================================
-- TABLE: promo_codes
-- =========================================================
create table if not exists promo_codes (
    id uuid primary key default uuid_generate_v4(),
    code text unique not null,
    discount_type text not null
        check (discount_type in ('percentage', 'fixed')),
    discount_value numeric not null,
    is_active boolean not null default true,
    is_single_use boolean not null default false,
    max_uses integer,
    times_used integer not null default 0,
    expires_at timestamptz,
    created_at timestamptz not null default now()
);

insert into promo_codes (code, discount_type, discount_value, is_active)
values
    ('HKLAUNCH', 'percentage', 15, true),
    ('HK10', 'percentage', 10, true),
    ('HKVIP', 'percentage', 20, true)
on conflict (code) do nothing;

-- =========================================================
-- TABLE: promo_code_uses
-- =========================================================
create table if not exists promo_code_uses (
    id uuid primary key default uuid_generate_v4(),
    promo_code_id uuid not null references promo_codes(id) on delete cascade,
    customer_email text not null,
    order_id uuid references orders(id) on delete set null,
    used_at timestamptz not null default now(),

    unique(promo_code_id, customer_email)
);

-- =========================================================
-- TRIGGER: updated_at automatique
-- =========================================================
create or replace function update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists set_updated_at on orders;
create trigger set_updated_at
    before update on orders
    for each row
    execute function update_updated_at_column();

-- =========================================================
-- ROW LEVEL SECURITY
-- =========================================================
alter table orders enable row level security;
alter table order_items enable row level security;
alter table newsletter_subscribers enable row level security;
alter table promo_codes enable row level security;
alter table promo_code_uses enable row level security;