-- =====================================================================
-- AACPD — Portal da Associação Angolana dos Canais e Plataformas Digitais
-- Base de dados Supabase. Correr no SQL Editor (projecto vazio).
-- =====================================================================

-- ---------- Perfis (uma linha por conta) ----------
create table if not exists perfis (
  id uuid primary key references auth.users on delete cascade,
  nome text not null default '',
  telefone text not null default '',
  papel text not null default 'membro' check (papel in ('membro', 'admin')),
  criado_em timestamptz not null default now()
);

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfis where id = auth.uid() and papel = 'admin');
$$;

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into perfis (id, nome, telefone)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', ''), coalesce(new.raw_user_meta_data->>'telefone', ''))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

create or replace function guard_perfis() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not is_admin() then new.papel := old.papel; end if;
  return new;
end $$;
drop trigger if exists t_guard_perfis on perfis;
create trigger t_guard_perfis before update on perfis for each row execute function guard_perfis();

-- ---------- Membros (pedido de adesão + ficha) ----------
create sequence if not exists membros_numero_seq start 1;
create table if not exists membros (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null unique references perfis on delete cascade,
  numero text unique,
  nome text not null,
  tipo text not null,
  plano text not null,
  area text not null default '',
  provincia text not null default '',
  documento text not null default '',
  telefone text not null default '',
  bio text not null default '',
  plataformas jsonb not null default '[]'::jsonb,
  publico boolean not null default true,
  estado text not null default 'pendente' check (estado in ('pendente', 'activo', 'rejeitado', 'suspenso')),
  nota_admin text not null default '',
  quota_ate date,
  aprovado_em timestamptz,
  criado_em timestamptz not null default now()
);

create or replace function guard_membros() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not is_admin() then
    if tg_op = 'INSERT' then
      new.perfil_id := auth.uid(); new.estado := 'pendente'; new.numero := null; new.quota_ate := null; new.aprovado_em := null; new.nota_admin := '';
    else
      new.perfil_id := old.perfil_id; new.estado := old.estado; new.numero := old.numero; new.quota_ate := old.quota_ate;
      new.aprovado_em := old.aprovado_em; new.nota_admin := old.nota_admin; new.plano := case when old.estado = 'pendente' then new.plano else old.plano end;
    end if;
  end if;
  if new.estado = 'activo' and new.numero is null then
    new.numero := 'AACPD-' || lpad(nextval('membros_numero_seq')::text, 4, '0');
    new.aprovado_em := coalesce(new.aprovado_em, now());
  end if;
  return new;
end $$;
drop trigger if exists t_guard_membros on membros;
create trigger t_guard_membros before insert or update on membros for each row execute function guard_membros();

-- ---------- Quotas ----------
create table if not exists quotas (
  id uuid primary key default gen_random_uuid(),
  membro_id uuid not null references membros on delete cascade,
  referencia text not null unique,
  plano text not null,
  descricao text not null default '',
  valor integer not null default 0,
  meses integer not null default 12,
  estado text not null default 'pendente' check (estado in ('pendente', 'pago', 'anulado')),
  metodo text not null default '',
  comprovativo text not null default '',
  pago_em timestamptz,
  criado_em timestamptz not null default now()
);
create index if not exists quotas_membro_idx on quotas (membro_id);
create index if not exists quotas_estado_idx on quotas (estado, pago_em);

-- ---------- Conteúdos ----------
create table if not exists noticias (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  titulo text not null,
  resumo text not null default '',
  corpo text not null default '',
  categoria text not null default 'Notícia' check (categoria in ('Notícia', 'Nota de imprensa', 'Comunicado', 'Evento')),
  imagem text not null default '',
  publicado boolean not null default false,
  destaque boolean not null default false,
  publicado_em timestamptz not null default now(),
  criado_em timestamptz not null default now()
);

create table if not exists beneficios (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  parceiro text not null default '',
  descricao text not null default '',
  desconto text not null default '',
  codigo text not null default '',
  como_usar text not null default '',
  link text not null default '',
  imagem text not null default '',
  activo boolean not null default true,
  ordem integer not null default 0,
  criado_em timestamptz not null default now()
);

create table if not exists direccao (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cargo text not null,
  foto text not null default '',
  bio text not null default '',
  ordem integer not null default 0
);

create table if not exists definicoes (
  chave text primary key,
  valor jsonb not null default '{}'::jsonb,
  actualizado_em timestamptz not null default now()
);

-- mensagens já existe (formulário de contacto); acrescentar gestão
alter table mensagens add column if not exists respondida boolean not null default false;

-- ---------- Regras de acesso ----------
alter table perfis enable row level security;
alter table membros enable row level security;
alter table quotas enable row level security;
alter table noticias enable row level security;
alter table beneficios enable row level security;
alter table direccao enable row level security;
alter table definicoes enable row level security;

create policy perfis_ver on perfis for select using (id = (select auth.uid()) or is_admin());
create policy perfis_editar on perfis for update using (id = (select auth.uid()) or is_admin());

create policy membros_ver on membros for select using (perfil_id = (select auth.uid()) or is_admin());
create policy membros_pedir on membros for insert with check (perfil_id = (select auth.uid()) or is_admin());
create policy membros_editar on membros for update using (perfil_id = (select auth.uid()) or is_admin());
create policy membros_apagar on membros for delete using (is_admin());

create policy quotas_ver on quotas for select using (is_admin() or exists (select 1 from membros m where m.id = membro_id and m.perfil_id = (select auth.uid())));
create policy quotas_admin on quotas for all using (is_admin()) with check (is_admin());

create policy noticias_ver on noticias for select using (publicado or is_admin());
create policy noticias_admin on noticias for all using (is_admin()) with check (is_admin());
create policy beneficios_admin on beneficios for all using (is_admin()) with check (is_admin());
create policy direccao_ver on direccao for select using (true);
create policy direccao_admin on direccao for all using (is_admin()) with check (is_admin());
create policy definicoes_ver on definicoes for select using (true);
create policy definicoes_admin on definicoes for all using (is_admin()) with check (is_admin());
create policy mensagens_admin_ver on mensagens for select using (is_admin());
create policy mensagens_admin_editar on mensagens for update using (is_admin());
create policy mensagens_admin_apagar on mensagens for delete using (is_admin());

revoke all on perfis, membros, quotas, noticias, beneficios, direccao, definicoes from anon, authenticated;
grant select, update on perfis to authenticated;
grant select, insert, update, delete on membros, quotas, noticias, beneficios, direccao, definicoes to authenticated;
grant select on noticias, direccao, definicoes to anon;
grant select, update, delete on mensagens to authenticated;

-- ---------- Vistas públicas ----------
create or replace view v_beneficios as
  select id, titulo, parceiro, descricao, desconto, link, imagem, ordem from beneficios where activo;
create or replace view v_directorio as
  select m.numero, m.nome, m.tipo, m.area, m.provincia, m.plataformas, m.bio from membros m
  where m.estado = 'activo' and m.publico;
grant select on v_beneficios, v_directorio to anon, authenticated;

-- ---------- Funções ----------
-- Membro pede o pagamento da quota do seu plano (gera referência)
create or replace function pedir_quota() returns quotas
language plpgsql security definer set search_path = public as $$
declare v_m membros; v_plano jsonb; v_q quotas;
begin
  select * into v_m from membros where perfil_id = auth.uid();
  if not found then raise exception 'Faça primeiro o pedido de adesão.'; end if;
  if v_m.estado in ('rejeitado', 'suspenso') then raise exception 'A sua adesão não está activa. Contacte a associação.'; end if;
  select * into v_q from quotas where membro_id = v_m.id and estado = 'pendente' order by criado_em desc limit 1;
  if found then return v_q; end if;
  select p into v_plano from definicoes d, jsonb_array_elements(d.valor) p where d.chave = 'planos' and p->>'id' = v_m.plano;
  if v_plano is null then raise exception 'Plano de quota não encontrado. Contacte a associação.'; end if;
  insert into quotas (membro_id, referencia, plano, descricao, valor, meses)
  values (v_m.id, 'Q-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6)), v_plano->>'nome',
          'Quota ' || (v_plano->>'nome') || ' · ' || coalesce(v_plano->>'periodo', 'anual'),
          coalesce((v_plano->>'valor')::int, 0), case when v_plano->>'periodo' = 'mensal' then 1 else 12 end)
  returning * into v_q;
  return v_q;
end $$;

-- Membro anexa o comprovativo (caminho do ficheiro no Storage)
create or replace function anexar_comprovativo(p_quota uuid, p_caminho text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update quotas q set comprovativo = p_caminho
  where q.id = p_quota and q.estado = 'pendente'
    and exists (select 1 from membros m where m.id = q.membro_id and m.perfil_id = auth.uid())
    and p_caminho like (select m.id::text from membros m where m.perfil_id = auth.uid()) || '/%';
  if not found then raise exception 'Não foi possível anexar o comprovativo.'; end if;
end $$;

-- Admin confirma o pagamento: quota paga e validade prolongada
create or replace function confirmar_quota(p_quota uuid, p_metodo text, p_valor int) returns void
language plpgsql security definer set search_path = public as $$
declare v_q quotas;
begin
  if not is_admin() then raise exception 'Sem permissão.'; end if;
  update quotas set estado = 'pago', metodo = coalesce(p_metodo, ''), valor = coalesce(p_valor, valor), pago_em = now()
  where id = p_quota and estado = 'pendente' returning * into v_q;
  if not found then raise exception 'Quota não encontrada ou já tratada.'; end if;
  update membros set quota_ate = (greatest(coalesce(quota_ate, current_date), current_date) + make_interval(months => v_q.meses))::date
  where id = v_q.membro_id;
end $$;

-- Benefícios com código: só para membros activos com quota em dia
create or replace function meus_beneficios() returns setof beneficios
language sql stable security definer set search_path = public as $$
  select b.* from beneficios b
  where b.activo and exists (select 1 from membros m where m.perfil_id = auth.uid() and m.estado = 'activo' and m.quota_ate >= current_date)
  order by b.ordem, b.criado_em;
$$;

-- Verificação pública do cartão de membro (parceiros validam benefícios)
create or replace function verificar_membro(p_numero text) returns json
language sql stable security definer set search_path = public as $$
  select coalesce((select json_build_object('ok', true, 'numero', numero, 'nome', nome, 'tipo', tipo, 'estado', estado,
      'quota_ate', quota_ate, 'em_dia', (estado = 'activo' and quota_ate >= current_date))
    from membros where upper(numero) = upper(trim(p_numero))), json_build_object('ok', false));
$$;

-- Painel da administração
create or replace function admin_resumo() returns json
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Sem permissão.'; end if;
  return json_build_object(
    'activos', (select count(*) from membros where estado = 'activo'),
    'em_dia', (select count(*) from membros where estado = 'activo' and quota_ate >= current_date),
    'pendentes', (select count(*) from membros where estado = 'pendente'),
    'quotas_pendentes', (select count(*) from quotas where estado = 'pendente'),
    'com_comprovativo', (select count(*) from quotas where estado = 'pendente' and comprovativo <> ''),
    'receita_ano', (select coalesce(sum(valor), 0) from quotas where estado = 'pago' and date_trunc('year', pago_em) = date_trunc('year', now())),
    'receita_total', (select coalesce(sum(valor), 0) from quotas where estado = 'pago'),
    'por_receber', (select coalesce(sum(valor), 0) from quotas where estado = 'pendente'),
    'mensagens_novas', (select count(*) from mensagens where not lida),
    'noticias', (select count(*) from noticias where publicado),
    'por_tipo', coalesce((select json_agg(x) from (select tipo, count(*) as n from membros where estado = 'activo' group by tipo order by 2 desc) x), '[]'::json),
    'por_mes', coalesce((select json_agg(x order by x.mes) from (
        select to_char(m, 'YYYY-MM') as mes,
          coalesce((select sum(valor) from quotas where estado = 'pago' and date_trunc('month', pago_em) = m), 0) as receita,
          (select count(*) from membros where date_trunc('month', criado_em) = m) as adesoes
        from generate_series(date_trunc('month', now()) - interval '11 months', date_trunc('month', now()), interval '1 month') m) x), '[]'::json));
end $$;

create or replace function admin_membros() returns table (id uuid, perfil_id uuid, numero text, nome text, email text, telefone text, tipo text, plano text, area text,
  provincia text, documento text, bio text, plataformas jsonb, publico boolean, estado text, nota_admin text, quota_ate date, aprovado_em timestamptz, criado_em timestamptz,
  papel text, quota_pendente uuid, comprovativo text)
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Sem permissão.'; end if;
  return query select m.id, m.perfil_id, m.numero, m.nome, u.email::text, m.telefone, m.tipo, m.plano, m.area, m.provincia, m.documento, m.bio, m.plataformas,
      m.publico, m.estado, m.nota_admin, m.quota_ate, m.aprovado_em, m.criado_em, p.papel,
      (select q.id from quotas q where q.membro_id = m.id and q.estado = 'pendente' order by q.criado_em desc limit 1),
      coalesce((select q.comprovativo from quotas q where q.membro_id = m.id and q.estado = 'pendente' order by q.criado_em desc limit 1), '')
    from membros m join perfis p on p.id = m.perfil_id join auth.users u on u.id = m.perfil_id
    order by case m.estado when 'pendente' then 0 when 'activo' then 1 else 2 end, m.criado_em desc;
end $$;

create or replace function admin_quotas() returns table (id uuid, membro_id uuid, membro text, numero text, email text, referencia text, plano text, descricao text,
  valor int, meses int, estado text, metodo text, comprovativo text, pago_em timestamptz, criado_em timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Sem permissão.'; end if;
  return query select q.id, q.membro_id, m.nome, m.numero, u.email::text, q.referencia, q.plano, q.descricao, q.valor, q.meses, q.estado, q.metodo, q.comprovativo, q.pago_em, q.criado_em
    from quotas q join membros m on m.id = q.membro_id join auth.users u on u.id = m.perfil_id
    order by case q.estado when 'pendente' then 0 else 1 end, q.criado_em desc limit 1000;
end $$;

create or replace function admin_definir_papel(p_email text, p_papel text) returns void
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not is_admin() then raise exception 'Sem permissão.'; end if;
  if p_papel not in ('membro', 'admin') then raise exception 'Papel inválido.'; end if;
  select id into v_id from auth.users where lower(email) = lower(trim(p_email));
  if v_id is null then raise exception 'Não existe conta com esse email.'; end if;
  if v_id = auth.uid() and p_papel <> 'admin' then raise exception 'Não pode retirar o seu próprio acesso.'; end if;
  update perfis set papel = p_papel where id = v_id;
end $$;

create or replace function admin_lista_admins() returns table (email text, nome text)
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Sem permissão.'; end if;
  return query select u.email::text, p.nome from perfis p join auth.users u on u.id = p.id where p.papel = 'admin' order by p.nome;
end $$;

revoke execute on function handle_new_user(), guard_perfis(), guard_membros() from public, anon, authenticated;
revoke execute on function pedir_quota(), anexar_comprovativo(uuid, text), confirmar_quota(uuid, text, int), meus_beneficios(), admin_resumo(), admin_membros(),
  admin_quotas(), admin_definir_papel(text, text), admin_lista_admins() from public, anon;
grant execute on function pedir_quota(), anexar_comprovativo(uuid, text), confirmar_quota(uuid, text, int), meus_beneficios(), admin_resumo(), admin_membros(),
  admin_quotas(), admin_definir_papel(text, text), admin_lista_admins() to authenticated;
grant execute on function verificar_membro(text) to anon, authenticated;

-- ---------- Ficheiros (Storage) ----------
insert into storage.buckets (id, name, public) values ('publico', 'publico', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit) values ('comprovativos', 'comprovativos', false, 5242880) on conflict (id) do nothing;
create policy publico_ler on storage.objects for select using (bucket_id = 'publico');
create policy publico_admin on storage.objects for insert to authenticated with check (bucket_id = 'publico' and is_admin());
create policy publico_admin_upd on storage.objects for update to authenticated using (bucket_id = 'publico' and is_admin());
create policy publico_admin_del on storage.objects for delete to authenticated using (bucket_id = 'publico' and is_admin());
create policy comprov_enviar on storage.objects for insert to authenticated with check (
  bucket_id = 'comprovativos' and (storage.foldername(name))[1] = (select m.id::text from membros m where m.perfil_id = (select auth.uid())));
create policy comprov_ler on storage.objects for select to authenticated using (
  bucket_id = 'comprovativos' and (is_admin() or (storage.foldername(name))[1] = (select m.id::text from membros m where m.perfil_id = (select auth.uid()))));

-- ---------- Conteúdo inicial ----------
insert into direccao (nome, cargo, foto, ordem) values
  ('Sarchel Nécesio', 'Presidente da Associação', 'img/sarchel-necesio.jpg', 1),
  ('Nuno Baio', 'Vice-Presidente para a Área de Influenciadores Digitais e Criadores de Conteúdo', 'img/nuno-baio.jpg', 2),
  ('David Moma', 'Vice-Presidente para a Área Social de Projectos e Inovações', 'img/david-moma.jpg', 3),
  ('Ildo Espinha', 'Secretário-Geral da Associação', 'img/ildo-espinha.jpg', 4),
  ('Mariano Fonseca', 'Director Nacional para Marketing e Comunicação Institucional', 'img/mariano-fonseca.jpg', 5);

insert into definicoes (chave, valor) values
 ('planos', '[
   {"id":"estudante","nome":"Estudante","descricao":"Estudantes e criadores em início de carreira","valor":5000,"periodo":"anual"},
   {"id":"criador","nome":"Criador de Conteúdo","descricao":"Influenciadores e criadores de conteúdo individuais","valor":15000,"periodo":"anual"},
   {"id":"canal","nome":"Canal / Plataforma Digital","descricao":"Canais, páginas, portais e plataformas digitais","valor":50000,"periodo":"anual"},
   {"id":"empresa","nome":"Empresa Parceira","descricao":"Empresas, agências e marcas que apoiam o sector","valor":250000,"periodo":"anual"}
 ]'::jsonb),
 ('pagamento', '{"titular":"","banco":"","iban":"","mcx":"","whatsapp":"","instrucoes":"Depois de pagar, anexe o comprovativo na sua área de membro. A quota fica activa quando a associação confirmar o pagamento."}'::jsonb),
 ('site', '{"missao":"Unir, representar e valorizar os canais, as plataformas digitais, os influenciadores e os criadores de conteúdo de Angola.","visao":"Um ecossistema digital angolano forte, profissional e reconhecido.","valores":"Ética · Inovação · Colaboração · Responsabilidade social","email":"","telefone":"","morada":"Luanda, Angola","site":"https://www.assodigital.org","facebook":"https://www.facebook.com/assodigital","instagram":"https://www.instagram.com/assodigital","x":"https://x.com/assodigital"}'::jsonb)
on conflict (chave) do nothing;

insert into noticias (slug, titulo, resumo, corpo, categoria, publicado, destaque) values
 ('novo-portal-aacpd', 'A AACPD tem um novo portal', 'Adesão online, quotas, benefícios para membros e notícias da associação num só lugar.',
  'A Associação Angolana dos Canais e Plataformas Digitais lança o seu novo portal.

A partir de agora, criadores de conteúdo, canais e plataformas digitais podem pedir a adesão online, pagar e acompanhar as quotas, ter o cartão de membro digital e aceder aos benefícios exclusivos para membros.

Acompanhe aqui as notícias, comunicados e notas de imprensa da associação.', 'Comunicado', true, true)
on conflict (slug) do nothing;

-- Tornar-se administrador (correr depois de criar a conta no site):
--   update perfis set papel = 'admin' where id = (select id from auth.users where email = 'o-seu-email@exemplo.com');
