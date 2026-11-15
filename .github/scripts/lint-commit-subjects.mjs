// Reject commit subjects release-please cannot read.
//
// release-please parses the commits that land on `main` and silently drops any
// that do not match the Conventional Commits grammar. A dropped commit is not
// an error — it simply never appears in the changelog and never contributes to
// the version bump, which is exactly the kind of failure that is discovered a
// release later. This script turns that silence into a red check.
//
// Usage: node .github/scripts/lint-commit-subjects.mjs <base-rev> [<head-rev>]
//
// Only the subject line is checked. The body is free text, and a `BREAKING
// CHANGE:` footer is optional, so neither is inspected.

import { execFileSync } from 'node:child_process'

/** Must stay in step with `changelog-sections` in release-please-config.json. */
const TYPES = [
  'feat',
  'fix',
  'perf',
  'revert',
  'docs',
  'style',
  'chore',
  'refactor',
  'test',
  'build',
  'ci',
]

// `type(scope)!: subject` — the grammar release-please's parser accepts.
const SUBJECT = new RegExp(`^(?:${TYPES.join('|')})(?:\\([^()\\r\\n]+\\))?!?: .+`)

/**
 * Commits this script must ignore.
 *
 * Merge commits are created by GitHub, not written by a human, so they are not
 * the author's to fix. A revert created by `git revert` is prose by design and
 * release-please recognises it separately from a `revert:` commit.
 */
const IGNORED = [/^Merge (?:pull request|branch|remote-tracking)/]

const [base, head = 'HEAD'] = process.argv.slice(2)
if (!base) {
  console.error('usage: lint-commit-subjects.mjs <base-rev> [<head-rev>]')
  process.exit(2)
}

let log
try {
  // NUL separates the fields and a record separator terminates each commit so
  // that a multi-line body can never be mistaken for a subject line.
  log = execFileSync(
    'git',
    ['log', '--no-merges', '--format=%H%x00%s%x00%an%x1e', `${base}..${head}`],
    { encoding: 'utf8' },
  )
} catch (error) {
  console.error(`could not read commits between ${base} and ${head}: ${error.message}`)
  process.exit(2)
}

const commits = log
  .split('\x1e')
  .map((record) => record.trim())
  .filter(Boolean)
  .map((record) => {
    const [sha, subject, author] = record.split('\x00')
    return { sha, subject, author }
  })

if (commits.length === 0) {
  console.log(`No commits between ${base} and ${head}; nothing to check.`)
  process.exit(0)
}

const failures = commits.filter(
  (commit) =>
    !SUBJECT.test(commit.subject) &&
    !IGNORED.some((pattern) => pattern.test(commit.subject)),
)

for (const commit of commits) {
  const bad = failures.includes(commit)
  const mark = bad ? 'FAIL' : 'ok  '
  console.log(`  ${mark}  ${commit.sha.slice(0, 7)}  ${commit.subject}`)
}

if (failures.length === 0) {
  console.log(`\nAll ${commits.length} commit subject(s) are conventional.`)
  process.exit(0)
}

console.error(
  [
    '',
    `${failures.length} of ${commits.length} commit subject(s) cannot be read by release-please.`,
    '',
    'Rewrite them as `type(scope): subject` using one of:',
    `  ${TYPES.join(', ')}`,
    '',
    'Examples:',
    '  feat: add a quiet-period override to the panel',
    '  fix(host): refuse an arm whose executable lookup resolved out of order',
    '  docs: explain the Fast Startup caveat',
    '',
    'A breaking change is `type!:` or a `BREAKING CHANGE:` footer.',
    'Amend the commits (git commit --amend / git rebase -i) and force-push.',
  ].join('\n'),
)
process.exit(1)
