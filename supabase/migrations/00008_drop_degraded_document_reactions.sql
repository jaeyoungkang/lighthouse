update lighthouse.documents
set reaction = null
where (
    reaction ->> 'title' = 'AI comment를 만들지 못했습니다'
    and reaction ->> 'body' = '현재 문서는 그대로 사용할 수 있습니다.'
  )
  or coalesce(reaction ->> 'id', '') like 'awareness-failed-%'
  or coalesce(reaction ->> 'id', '') like 'respond-fallback-%'
  or coalesce(reaction ->> 'id', '') like 'respond-provider-failure-%';

update lighthouse.documents
set reaction_history = coalesce(
  (
    select jsonb_agg(history_item.item order by history_item.position)
    from jsonb_array_elements(reaction_history) with ordinality as history_item(item, position)
    where not (
      (
        history_item.item ->> 'title' = 'AI comment를 만들지 못했습니다'
        and history_item.item ->> 'body' = '현재 문서는 그대로 사용할 수 있습니다.'
      )
      or coalesce(history_item.item ->> 'id', '') like 'awareness-failed-%'
      or coalesce(history_item.item ->> 'id', '') like 'respond-fallback-%'
      or coalesce(history_item.item ->> 'id', '') like 'respond-provider-failure-%'
    )
  ),
  '[]'::jsonb
)
where exists (
  select 1
  from jsonb_array_elements(reaction_history) as item
  where (
      item ->> 'title' = 'AI comment를 만들지 못했습니다'
      and item ->> 'body' = '현재 문서는 그대로 사용할 수 있습니다.'
    )
    or coalesce(item ->> 'id', '') like 'awareness-failed-%'
    or coalesce(item ->> 'id', '') like 'respond-fallback-%'
    or coalesce(item ->> 'id', '') like 'respond-provider-failure-%'
);
