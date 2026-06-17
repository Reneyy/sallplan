-- SallPlan production schema for Supabase/PostgreSQL.
-- Run this in the Supabase SQL editor after creating a new project.

create extension if not exists pgcrypto;

create table if not exists teachers (
  id text primary key,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  name text not null,
  username text not null unique,
  role text not null check (role in ('teacher', 'admin')),
  teacher_type text not null check (teacher_type in ('class_teacher', 'subject_teacher', 'admin')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists rooms (
  id text primary key,
  name text not null,
  type text not null check (type in ('fixed_schedule', 'free_booking')),
  building text not null default '',
  floor text not null default '',
  capacity integer not null default 0,
  responsible_teacher_id text references teachers(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists fixed_schedule (
  id uuid primary key default gen_random_uuid(),
  room_id text not null references rooms(id) on delete cascade,
  day text not null,
  slot_id text not null,
  subject text not null,
  teacher_id text references teachers(id) on delete set null,
  status text not null default 'fix_belegt',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (room_id, day, slot_id)
);

create table if not exists recurring_releases (
  id text primary key,
  room_id text not null references rooms(id) on delete cascade,
  day text not null,
  slot_id text not null,
  reason text not null,
  created_by text references teachers(id) on delete set null,
  valid_from date not null,
  valid_until date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (room_id, day, slot_id, valid_from, valid_until)
);

create table if not exists manual_releases (
  id text primary key,
  room_id text not null references rooms(id) on delete cascade,
  date date not null,
  day text not null,
  slot_id text not null,
  reason text not null,
  note text not null default '',
  created_by text references teachers(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (room_id, date, slot_id)
);

create table if not exists reservations (
  id text primary key,
  room_id text not null references rooms(id) on delete cascade,
  teacher_id text not null references teachers(id) on delete cascade,
  second_person text not null default '',
  date date not null,
  day text not null,
  slot_id text not null,
  note text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (room_id, date, slot_id)
);

create table if not exists room_blocks (
  id text primary key,
  room_id text not null references rooms(id) on delete cascade,
  date date not null,
  day text not null,
  slot_id text not null,
  reason text not null,
  created_by text references teachers(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (room_id, date, slot_id)
);

create table if not exists school_holidays (
  id text primary key,
  name text not null,
  start_date date not null,
  end_date date not null,
  created_by text references teachers(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create or replace function current_teacher_id()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select id from teachers where auth_user_id = auth.uid() and active = true limit 1
$$;

create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from teachers
    where auth_user_id = auth.uid()
      and role = 'admin'
      and active = true
  )
$$;

create or replace function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists teachers_touch_updated_at on teachers;
create trigger teachers_touch_updated_at before update on teachers
for each row execute function touch_updated_at();

drop trigger if exists rooms_touch_updated_at on rooms;
create trigger rooms_touch_updated_at before update on rooms
for each row execute function touch_updated_at();

drop trigger if exists fixed_schedule_touch_updated_at on fixed_schedule;
create trigger fixed_schedule_touch_updated_at before update on fixed_schedule
for each row execute function touch_updated_at();

drop trigger if exists recurring_releases_touch_updated_at on recurring_releases;
create trigger recurring_releases_touch_updated_at before update on recurring_releases
for each row execute function touch_updated_at();

drop trigger if exists manual_releases_touch_updated_at on manual_releases;
create trigger manual_releases_touch_updated_at before update on manual_releases
for each row execute function touch_updated_at();

drop trigger if exists reservations_touch_updated_at on reservations;
create trigger reservations_touch_updated_at before update on reservations
for each row execute function touch_updated_at();

drop trigger if exists room_blocks_touch_updated_at on room_blocks;
create trigger room_blocks_touch_updated_at before update on room_blocks
for each row execute function touch_updated_at();

drop trigger if exists school_holidays_touch_updated_at on school_holidays;
create trigger school_holidays_touch_updated_at before update on school_holidays
for each row execute function touch_updated_at();

alter table teachers enable row level security;
alter table rooms enable row level security;
alter table fixed_schedule enable row level security;
alter table recurring_releases enable row level security;
alter table manual_releases enable row level security;
alter table reservations enable row level security;
alter table room_blocks enable row level security;
alter table school_holidays enable row level security;

-- Everyone signed in can read the planning data.
create policy "teachers_read_authenticated" on teachers for select to authenticated using (true);
create policy "rooms_read_authenticated" on rooms for select to authenticated using (true);
create policy "fixed_schedule_read_authenticated" on fixed_schedule for select to authenticated using (true);
create policy "recurring_releases_read_authenticated" on recurring_releases for select to authenticated using (true);
create policy "manual_releases_read_authenticated" on manual_releases for select to authenticated using (true);
create policy "reservations_read_authenticated" on reservations for select to authenticated using (true);
create policy "room_blocks_read_authenticated" on room_blocks for select to authenticated using (true);
create policy "school_holidays_read_authenticated" on school_holidays for select to authenticated using (true);

-- Admins manage master data.
create policy "teachers_admin_all" on teachers for all to authenticated using (is_admin()) with check (is_admin());
create policy "rooms_admin_all" on rooms for all to authenticated using (is_admin()) with check (is_admin());
create policy "room_blocks_admin_all" on room_blocks for all to authenticated using (is_admin()) with check (is_admin());
create policy "school_holidays_admin_all" on school_holidays for all to authenticated using (is_admin()) with check (is_admin());

-- Class teachers can edit their own room schedule and releases. Admins can edit all.
create policy "fixed_schedule_admin_or_responsible" on fixed_schedule
for all to authenticated
using (
  is_admin()
  or exists (
    select 1 from rooms
    where rooms.id = fixed_schedule.room_id
      and rooms.responsible_teacher_id = current_teacher_id()
  )
)
with check (
  is_admin()
  or exists (
    select 1 from rooms
    where rooms.id = fixed_schedule.room_id
      and rooms.responsible_teacher_id = current_teacher_id()
  )
);

create policy "recurring_releases_admin_or_responsible" on recurring_releases
for all to authenticated
using (
  is_admin()
  or exists (
    select 1 from rooms
    where rooms.id = recurring_releases.room_id
      and rooms.responsible_teacher_id = current_teacher_id()
  )
)
with check (
  is_admin()
  or exists (
    select 1 from rooms
    where rooms.id = recurring_releases.room_id
      and rooms.responsible_teacher_id = current_teacher_id()
  )
);

create policy "manual_releases_admin_or_responsible" on manual_releases
for all to authenticated
using (
  is_admin()
  or exists (
    select 1 from rooms
    where rooms.id = manual_releases.room_id
      and rooms.responsible_teacher_id = current_teacher_id()
  )
)
with check (
  is_admin()
  or exists (
    select 1 from rooms
    where rooms.id = manual_releases.room_id
      and rooms.responsible_teacher_id = current_teacher_id()
  )
);

-- Teachers create and delete their own reservations. Admins manage all.
create policy "reservations_insert_own_or_admin" on reservations
for insert to authenticated
with check (is_admin() or teacher_id = current_teacher_id());

create policy "reservations_update_admin_only" on reservations
for update to authenticated
using (is_admin())
with check (is_admin());

create policy "reservations_delete_own_or_admin" on reservations
for delete to authenticated
using (is_admin() or teacher_id = current_teacher_id());
