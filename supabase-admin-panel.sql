create extension if not exists pgcrypto;

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  service text not null,
  patient_name text not null,
  patient_phone text not null,
  patient_email text not null,
  appointment_date date not null,
  appointment_time text not null,
  notes text,
  reminder_sent boolean not null default false,
  review_sent boolean not null default false,
  created_at timestamp with time zone not null default now()
);

create unique index if not exists appointments_unique_slot
  on public.appointments (appointment_date, appointment_time);

create table if not exists public.blocked_days (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.blocked_hours (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  time text not null,
  created_at timestamp with time zone not null default now()
);

create unique index if not exists blocked_hours_unique_slot
  on public.blocked_hours (date, time);

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  image text,
  created_at timestamp with time zone not null default now()
);

alter table public.appointments enable row level security;
alter table public.blocked_days enable row level security;
alter table public.blocked_hours enable row level security;
alter table public.blog_posts enable row level security;

drop policy if exists "Public can read booked slots" on public.appointments;
create policy "Public can read booked slots"
on public.appointments
for select
to anon
using (true);

drop policy if exists "Public can create appointments" on public.appointments;
create policy "Public can create appointments"
on public.appointments
for insert
to anon
with check (
  service is not null
  and patient_name is not null
  and patient_phone is not null
  and patient_email is not null
  and appointment_date is not null
  and appointment_time is not null
  and reminder_sent is not null
  and review_sent is not null
);
