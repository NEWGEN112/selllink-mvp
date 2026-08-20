-- Run this in Supabase SQL Editor.
create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text not null unique,
  description text default '',
  whatsapp text not null,
  created_at timestamptz default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  price numeric not null default 0,
  category text default '',
  description text default '',
  image_url text default '',
  is_available boolean not null default true,
  created_at timestamptz default now()
);

alter table public.stores enable row level security;
alter table public.products enable row level security;

create policy "Public can view stores"
on public.stores for select using (true);

create policy "Owners can create stores"
on public.stores for insert with check (auth.uid() = owner_id);

create policy "Owners can update stores"
on public.stores for update using (auth.uid() = owner_id);

create policy "Owners can delete stores"
on public.stores for delete using (auth.uid() = owner_id);

create policy "Public can view available products"
on public.products for select using (is_available = true or exists (
  select 1 from public.stores s where s.id = products.store_id and s.owner_id = auth.uid()
));

create policy "Owners can create products"
on public.products for insert with check (exists (
  select 1 from public.stores s where s.id = products.store_id and s.owner_id = auth.uid()
));

create policy "Owners can update products"
on public.products for update using (exists (
  select 1 from public.stores s where s.id = products.store_id and s.owner_id = auth.uid()
));

create policy "Owners can delete products"
on public.products for delete using (exists (
  select 1 from public.stores s where s.id = products.store_id and s.owner_id = auth.uid()
));