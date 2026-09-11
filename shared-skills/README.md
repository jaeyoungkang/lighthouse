# Shared Skills

`shared-skills/`는 Claude Code와 Codex가 함께 쓰는 스킬의 정본이다.

- 수정은 `shared-skills/<skill-name>/`에서만 한다.
- `npm install`과 `npm ci`는 `postinstall`에서
  `python3 scripts/sync-agent-skills.py --prune`을 실행한다.
- 스크립트는 Git이 무시하는 `.claude/skills/`와 `.agents/skills/` 런타임
  디렉터리를 정본에서 다시 만든다.
- 생성된 디렉터리에는 `.skill-sync-generated` 마커가 생긴다. 이 경로는
  직접 수정하지 않는다.
- 현재 설치에서 정본 변경을 바로 반영할 때는
  `python3 scripts/sync-agent-skills.py --prune`을 직접 실행한다.
- `shared-skills/` 아래에 nested `.git` metadata를 두지 않는다. 동기화
  스크립트는 숨은 commit이나 stash가 생기지 않도록 이 상태를 거부한다.

## 설계 원칙

- `SKILL.md` 본문은 Agent Skills 표준 범위 안에서 유지한다.
- Claude 전용 확장은 정말 필요할 때만 추가하고, 공용 코어에 의존성을 만들지 않는다.
- Codex 전용 UI 메타데이터는 선택 사항으로 둔다.
- 긴 절차서는 `references/`로 분리한다.

## 기존 `projects/skills`와의 관계

- `projects/skills/*/program.md`는 개념적 작업 절차 자산이다.
- `shared-skills/*/SKILL.md`는 실제 에이전트 런타임이 읽는 실행 포맷이다.
- 필요하면 기존 `program.md`를 `references/`로 옮기거나 요약해서 래핑한다.
