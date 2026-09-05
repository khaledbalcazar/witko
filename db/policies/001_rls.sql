-- Row Level Security.
--
-- La app y el worker se conectan con el rol `postgres` / service_role, que
-- bypassa RLS: la autorizacion real la aplica la maquina de estados en el
-- servidor. Estas politicas son la segunda red, para cualquier cosa que llegue
-- a la base con el token de un usuario (por ejemplo el cliente de Supabase en
-- el navegador, o una consulta desde el panel).
--
-- Regla general: un usuario ve lo de las marcas donde es miembro y nada mas.
-- Las escrituras no tienen politica: pasan siempre por el servidor.
--
-- Este archivo se aplica en cada `npm run db:migrate`, asi que tiene que ser
-- idempotente.

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

create or replace function public.es_miembro(b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from brand_members
    where brand_id = b and user_id = auth.uid()
  );
$$;

create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from users
    where id = auth.uid() and rol = 'ADMIN' and activo
  );
$$;

/* ------------------------------------------------------------------ */
/* Activar RLS en todo                                                 */
/* ------------------------------------------------------------------ */

do $$
declare
  t text;
begin
  foreach t in array array[
    'users', 'brands', 'brand_members', 'social_accounts',
    'posts', 'post_targets', 'media_assets', 'media_tags',
    'approvals', 'comments', 'publish_jobs',
    'boards', 'board_columns', 'board_cards', 'card_labels',
    'card_label_links', 'card_comments', 'card_checklist_items',
    'audit_log'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end
$$;

/* ------------------------------------------------------------------ */
/* Politicas de lectura                                                */
/* ------------------------------------------------------------------ */

-- Un usuario se ve a si mismo y a quienes comparten alguna marca con el.
drop policy if exists users_select on public.users;
create policy users_select on public.users
  for select to authenticated
  using (
    id = auth.uid()
    or public.es_admin()
    or exists (
      select 1
      from brand_members propios
      join brand_members ajenos on ajenos.brand_id = propios.brand_id
      where propios.user_id = auth.uid() and ajenos.user_id = users.id
    )
  );

drop policy if exists brands_select on public.brands;
create policy brands_select on public.brands
  for select to authenticated
  using (public.es_miembro(id) or public.es_admin());

drop policy if exists brand_members_select on public.brand_members;
create policy brand_members_select on public.brand_members
  for select to authenticated
  using (public.es_miembro(brand_id) or public.es_admin());

-- social_accounts no tiene politica a proposito: guarda tokens cifrados y solo
-- el servidor y el worker (service_role) pueden leerla.

drop policy if exists posts_select on public.posts;
create policy posts_select on public.posts
  for select to authenticated
  using (public.es_miembro(brand_id));

drop policy if exists post_targets_select on public.post_targets;
create policy post_targets_select on public.post_targets
  for select to authenticated
  using (
    exists (
      select 1 from posts p
      where p.id = post_targets.post_id and public.es_miembro(p.brand_id)
    )
  );

drop policy if exists media_assets_select on public.media_assets;
create policy media_assets_select on public.media_assets
  for select to authenticated
  using (
    exists (
      select 1 from posts p
      where p.id = media_assets.post_id and public.es_miembro(p.brand_id)
    )
  );

drop policy if exists media_tags_select on public.media_tags;
create policy media_tags_select on public.media_tags
  for select to authenticated
  using (
    exists (
      select 1
      from post_targets pt
      join posts p on p.id = pt.post_id
      where pt.id = media_tags.post_target_id and public.es_miembro(p.brand_id)
    )
  );

drop policy if exists approvals_select on public.approvals;
create policy approvals_select on public.approvals
  for select to authenticated
  using (
    exists (
      select 1 from posts p
      where p.id = approvals.post_id and public.es_miembro(p.brand_id)
    )
  );

drop policy if exists comments_select on public.comments;
create policy comments_select on public.comments
  for select to authenticated
  using (
    exists (
      select 1 from posts p
      where p.id = comments.post_id and public.es_miembro(p.brand_id)
    )
  );

-- publish_jobs es cosa del worker: sin politica.

/* ------------------------------------------------------------------ */
/* Tablero                                                             */
/* ------------------------------------------------------------------ */

drop policy if exists boards_select on public.boards;
create policy boards_select on public.boards
  for select to authenticated
  using (public.es_miembro(brand_id));

drop policy if exists board_columns_select on public.board_columns;
create policy board_columns_select on public.board_columns
  for select to authenticated
  using (
    exists (
      select 1 from boards b
      where b.id = board_columns.board_id and public.es_miembro(b.brand_id)
    )
  );

drop policy if exists board_cards_select on public.board_cards;
create policy board_cards_select on public.board_cards
  for select to authenticated
  using (
    exists (
      select 1 from boards b
      where b.id = board_cards.board_id and public.es_miembro(b.brand_id)
    )
  );

drop policy if exists card_labels_select on public.card_labels;
create policy card_labels_select on public.card_labels
  for select to authenticated
  using (
    exists (
      select 1 from boards b
      where b.id = card_labels.board_id and public.es_miembro(b.brand_id)
    )
  );

drop policy if exists card_label_links_select on public.card_label_links;
create policy card_label_links_select on public.card_label_links
  for select to authenticated
  using (
    exists (
      select 1
      from board_cards c
      join boards b on b.id = c.board_id
      where c.id = card_label_links.card_id and public.es_miembro(b.brand_id)
    )
  );

drop policy if exists card_comments_select on public.card_comments;
create policy card_comments_select on public.card_comments
  for select to authenticated
  using (
    exists (
      select 1
      from board_cards c
      join boards b on b.id = c.board_id
      where c.id = card_comments.card_id and public.es_miembro(b.brand_id)
    )
  );

drop policy if exists card_checklist_select on public.card_checklist_items;
create policy card_checklist_select on public.card_checklist_items
  for select to authenticated
  using (
    exists (
      select 1
      from board_cards c
      join boards b on b.id = c.board_id
      where c.id = card_checklist_items.card_id and public.es_miembro(b.brand_id)
    )
  );

/* ------------------------------------------------------------------ */
/* Auditoria                                                           */
/* ------------------------------------------------------------------ */

-- Solo lectura, y solo para administradores.
drop policy if exists audit_log_select on public.audit_log;
create policy audit_log_select on public.audit_log
  for select to authenticated
  using (public.es_admin());
