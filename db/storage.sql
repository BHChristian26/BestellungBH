-- Shared physical inventory. Only the scoped server capability can reach these records.
create schema if not exists bh_inventory;
revoke all on schema bh_inventory from public, anon, authenticated;
create table if not exists bh_inventory.access (id boolean primary key default true check(id), token_hash text not null);
create table if not exists bh_inventory.areas (
 id text primary key, business text not null, name text not null check(length(trim(name)) between 1 and 100), sort_order integer not null default 0,
 unique(business,name)
);
create table if not exists bh_inventory.items (
 id text primary key, area_id text not null references bh_inventory.areas(id), name text not null check(length(trim(name)) between 1 and 200),
 unit text not null check(length(trim(unit)) between 1 and 100), quantity numeric check(quantity>=0 and quantity<=1000000000),
 master_id text unique, revision integer not null default 0, updated_at timestamptz not null default now(), updated_by text not null default 'initial', sort_order integer not null default 0
);
create index if not exists bh_inventory_items_area on bh_inventory.items(area_id);
create table if not exists bh_inventory.receipts (request_id uuid primary key, response jsonb not null, created_at timestamptz not null default now());
alter table bh_inventory.access enable row level security;
alter table bh_inventory.areas enable row level security;
alter table bh_inventory.items enable row level security;
alter table bh_inventory.receipts enable row level security;
revoke all on all tables in schema bh_inventory from public,anon,authenticated;

-- This non-exposed function has a deliberately narrow capability check, independent
-- of Supabase user auth. The existing BestellungBH server authenticates staff first.
create or replace function bh_inventory.api(op text, payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; item bh_inventory.items; area bh_inventory.areas; request uuid; val numeric; n text; u text;
begin
 if not exists(select 1 from bh_inventory.access where token_hash=encode(sha256(convert_to(coalesce(current_setting('request.headers',true)::jsonb->>'x-bh-inventory-key',''),'UTF8')),'hex')) then
  raise exception 'Unauthorized inventory capability' using errcode='42501';
 end if;
 if op='list' then
  return jsonb_build_object('areas',coalesce((select jsonb_agg(to_jsonb(a) order by a.sort_order,a.id) from bh_inventory.areas a where a.business='Lager'),'[]'::jsonb),
  'items',coalesce((select jsonb_agg(to_jsonb(i) order by i.sort_order,i.id) from bh_inventory.items i join bh_inventory.areas a on a.id=i.area_id where a.business='Lager'),'[]'::jsonb));
 end if;
 request=(payload->>'requestId')::uuid;
 if request is null then raise exception 'Request ID required'; end if;
 -- Serializes repeated requests, including retries from another server instance.
 perform pg_advisory_xact_lock(hashtextextended(request::text,0));
 select response into result from bh_inventory.receipts where request_id=request;
 if found then return result; end if;
 if op='createArea' then
  n=trim(payload->>'name');
  if n is null or length(n) not between 1 and 100 or payload->>'business' is distinct from 'Lager' then raise exception 'Invalid storage area'; end if;
  insert into bh_inventory.areas(id,business,name,sort_order) values(request::text,payload->>'business',n,coalesce((select max(sort_order)+1 from bh_inventory.areas where business='Lager'),0)) returning * into area;
  result=jsonb_build_object('area',to_jsonb(area));
 elsif op='renameArea' then
  n=trim(payload->>'name');
  if n is null or length(n) not between 1 and 100 then raise exception 'Invalid name';end if;
  update bh_inventory.areas set name=n where id=payload->>'id' and business='Lager' and name=payload->>'previousName' returning * into area;
  if not found then raise exception 'Storage area changed. Refresh and retry.' using errcode='P0409';end if;
  result=jsonb_build_object('area',to_jsonb(area));
 elsif op='createItem' then
  if not exists(select 1 from bh_inventory.areas where id=payload->>'areaId' and business='Lager') then raise exception 'Storage area not found' using errcode='23503';end if;
  n=trim(payload->>'name');u=trim(payload->>'unit');val=(payload->>'quantity')::numeric;
  if n is null or length(n) not between 1 and 200 or u is null or length(u) not between 1 and 100 then raise exception 'Name and unit required';end if;
  insert into bh_inventory.items(id,area_id,name,unit,quantity,updated_by,sort_order)
   values(request::text,payload->>'areaId',n,u,val,left(payload->>'actor',100),coalesce((select max(sort_order)+1 from bh_inventory.items where area_id=payload->>'areaId'),0)) returning * into item;
  result=jsonb_build_object('item',to_jsonb(item));
 elsif op in ('setQuantity','bump') then
  select * into item from bh_inventory.items where id=payload->>'id' for update;
  if not found then raise exception 'Item not found' using errcode='P0002'; end if;
  if op='setQuantity' then
   if item.revision is distinct from (payload->>'revision')::integer then raise exception 'Quantity changed elsewhere. Refresh and retry.' using errcode='P0409';end if;
   val=(payload->>'quantity')::numeric;
  else
   if item.quantity is null then raise exception 'Enter the counted stock first.' using errcode='22023';end if;
   if (payload->>'delta')::numeric not in (-1,1) then raise exception 'Invalid adjustment';end if;
   val=greatest(0,item.quantity+(payload->>'delta')::numeric);
  end if;
  if val is null or val<0 or val>1000000000 or val::text in ('NaN','Infinity','-Infinity') then raise exception 'Invalid quantity';end if;
  update bh_inventory.items set quantity=val,revision=revision+1,updated_at=now(),updated_by=left(payload->>'actor',100) where id=item.id returning * into item;
  result=jsonb_build_object('item',to_jsonb(item));
 else raise exception 'Unknown inventory operation';end if;
 insert into bh_inventory.receipts(request_id,response) values(request,result);
 return result;
end;$$;
revoke all on function bh_inventory.api(text,jsonb) from public,anon,authenticated;
grant usage on schema bh_inventory to anon;
grant execute on function bh_inventory.api(text,jsonb) to anon;
create or replace function public.bh_inventory_api(op text,payload jsonb default '{}'::jsonb) returns jsonb
 language sql security invoker set search_path='' as $$select bh_inventory.api(op,payload)$$;
revoke all on function public.bh_inventory_api(text,jsonb) from public,anon,authenticated;
grant execute on function public.bh_inventory_api(text,jsonb) to anon;
