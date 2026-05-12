create or replace function public.slugify_bg(input text)
returns text
language sql
immutable
as $$
  with chars as (
    select
      lower(coalesce(input, '')) as source,
      array[
        'a','b','v','g','d','e','zh','z','i','y','k','l','m','n','o','p','r','s','t','u','f','h','ts','ch','sh','sht','a','','yu','ya'
      ] as replacements
  ),
  letters as (
    select
      string_to_array(source, null) as character_list,
      replacements
    from chars
  ),
  transliterated as (
    select string_agg(
      case letters.item
        when U&'\0430' then replacements[1]
        when U&'\0431' then replacements[2]
        when U&'\0432' then replacements[3]
        when U&'\0433' then replacements[4]
        when U&'\0434' then replacements[5]
        when U&'\0435' then replacements[6]
        when U&'\0436' then replacements[7]
        when U&'\0437' then replacements[8]
        when U&'\0438' then replacements[9]
        when U&'\0439' then replacements[10]
        when U&'\043A' then replacements[11]
        when U&'\043B' then replacements[12]
        when U&'\043C' then replacements[13]
        when U&'\043D' then replacements[14]
        when U&'\043E' then replacements[15]
        when U&'\043F' then replacements[16]
        when U&'\0440' then replacements[17]
        when U&'\0441' then replacements[18]
        when U&'\0442' then replacements[19]
        when U&'\0443' then replacements[20]
        when U&'\0444' then replacements[21]
        when U&'\0445' then replacements[22]
        when U&'\0446' then replacements[23]
        when U&'\0447' then replacements[24]
        when U&'\0448' then replacements[25]
        when U&'\0449' then replacements[26]
        when U&'\044A' then replacements[27]
        when U&'\044C' then replacements[28]
        when U&'\044E' then replacements[29]
        when U&'\044F' then replacements[30]
        else letters.item
      end,
      ''
    ) as value
    from letters,
    unnest(character_list) as letters(item)
  )
  select left(
    trim(both '-' from regexp_replace(regexp_replace(value, '[^a-z0-9]+', '-', 'g'), '-{2,}', '-', 'g')),
    80
  )
  from transliterated;
$$;

alter table public.blog_posts
  add column if not exists slug text;

with prepared as (
  select
    id,
    created_at,
    coalesce(
      nullif(trim(public.slugify_bg(coalesce(slug, ''))), ''),
      nullif(trim(public.slugify_bg(title)), ''),
      left(id::text, 8)
    ) as base_slug
  from public.blog_posts
),
ranked as (
  select
    id,
    case
      when count(*) over (partition by base_slug) = 1 then base_slug
      else base_slug || '-' || row_number() over (partition by base_slug order by created_at, id)
    end as final_slug
  from prepared
)
update public.blog_posts as posts
set slug = ranked.final_slug
from ranked
where posts.id = ranked.id
  and coalesce(posts.slug, '') <> ranked.final_slug;

create unique index if not exists blog_posts_slug_unique
  on public.blog_posts (slug)
  where slug is not null;
