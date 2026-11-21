create table public.datasets (
  id uuid primary key,
  user_id uuid not null references auth.users(id),
  filename text not null,
  metadata jsonb not null,
  version bigint not null default 1,
  status text not null check (status in ('ready','needs_sheet','deleting','uploading')),
  parsed_path text,
  created_at timestamptz not null default now()
);
create index datasets_owner_created on public.datasets(user_id, created_at desc, id);
alter table public.datasets enable row level security;
create policy datasets_owner on public.datasets for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
revoke all on public.datasets from anon;
grant select, insert, update, delete on public.datasets to authenticated;

insert into storage.buckets (id,name,public,file_size_limit)
values ('datasets','datasets',false,41943040)
on conflict (id) do nothing;

create policy dataset_objects_owner on storage.objects for all to authenticated
using (bucket_id = 'datasets' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'datasets' and (storage.foldername(name))[1] = (select auth.uid())::text);
