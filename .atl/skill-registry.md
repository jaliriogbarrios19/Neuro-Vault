# Skill Registry — NeuroVault

Generated: 2026-06-05 | Mode: engram

## Project Convention Files

- `C:\Users\Usuario\.config\opencode\AGENTS.md` — Global rules, tone, personality, lang, philosophy
- `C:\Users\Usuario\AGENTS.md` — Default workspace style, process selection, artifact structure, memory rules

### Compact Rules (from AGENTS.md)

- 300-line file limit intransgredible for source files (.ts, .tsx, .js, .jsx, .css)
- Never build after changes
- Never add AI attribution to commits; use conventional commits only
- Respond in user's language; Spanish = Rioplatense voseo
- Prefer modifying existing architecture over introducing parallel patterns
- Work in small slices that can be verified
- Keep task state explicit: todo, doing, done, blocked

## Invokable Skills

| Skill | Trigger | Path |
|-------|---------|------|
| agno-agent | agno, agent runtime, build agent, delegate, web search, code analysis | `~/.config/opencode/skills/agno-agent/SKILL.md` |
| branch-pr | creating PRs, pull requests | `~/.config/opencode/skills/branch-pr/SKILL.md` |
| chained-pr | PRs over 400 lines, stacked PRs | `~/.config/opencode/skills/chained-pr/SKILL.md` |
| cognitive-doc-design | guides, READMEs, RFCs, onboarding, architecture docs | `~/.config/opencode/skills/cognitive-doc-design/SKILL.md` |
| comment-writer | PR feedback, issue replies, reviews, GitHub comments | `~/.config/opencode/skills/comment-writer/SKILL.md` |
| issue-creation | creating GitHub issues, bug reports, feature requests | `~/.config/opencode/skills/issue-creation/SKILL.md` |
| judgment-day | dual review, adversarial review, juzgar | `~/.config/opencode/skills/judgment-day/SKILL.md` |
| lessons-learned | learned, lessons learned, aprendizajes, recordar aprendizajes | `~/.config/opencode/skills/lessons-learned/SKILL.md` |
| model-router | modelo, model routing, qué modelo usar, switch model | `~/.config/opencode/skills/model-router/SKILL.md` |
| skill-creator | new skills, agent instructions, AI usage patterns | `~/.config/opencode/skills/skill-creator/SKILL.md` |
| skill-curator | curate skills, review, archive, improve, maintenance | `~/.config/opencode/skills/skill-curator/SKILL.md` |
| work-unit-commits | commit splitting, chained PRs, keeping tests with code | `~/.config/opencode/skills/work-unit-commits/SKILL.md` |
