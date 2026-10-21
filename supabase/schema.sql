
create extension if not exists pgcrypto;

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null,
  invoice_data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists invoices_updated_at_idx
  on public.invoices (updated_at desc);

create index if not exists invoices_invoice_number_idx
  on public.invoices (invoice_number);

alter table public.invoices enable row level security;

-- Access is provided through the server-side service role.
-- Do not create public read/write policies for this table.
