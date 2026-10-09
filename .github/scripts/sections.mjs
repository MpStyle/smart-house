import { execFileSync } from 'node:child_process';

export const ciWorkflows = {
  frontend: 'ci-frontend.yml',
  backend: 'ci-backend.yml',
  infrastructure: 'ci-infrastructure.yml',
};

export function changedSections(paths) {
  const sections = { frontend: false, backend: false, infrastructure: false };
  for (const path of paths) {
    if (/^readme/i.test(path.split('/').at(-1))) continue;
    if (path.startsWith('.github/actions/') || path.startsWith('.github/scripts/') || path === '.github/workflows/deploy.yml') {
      for (const section of Object.keys(sections)) sections[section] = true;
    }
    if (path.startsWith('frontend/') || ['.github/workflows/ci-frontend.yml', '.github/workflows/deploy-frontend.yml'].includes(path))
      sections.frontend = true;
    if (path.startsWith('backend/') || ['global.json', 'SmartHouse.sln', '.github/workflows/ci-backend.yml', '.github/workflows/deploy-backend.yml'].includes(path))
      sections.backend = true;
    if (path.startsWith('infra/') || ['.github/workflows/ci-infrastructure.yml', '.github/workflows/deploy-infrastructure.yml'].includes(path))
      sections.infrastructure = true;
  }
  return sections;
}

export function changedFiles(before, after) {
  const args = !before || /^0+$/.test(before)
    ? ['ls-tree', '-r', '--name-only', '-z', after]
    : ['diff', '--no-renames', '--name-only', '-z', before, after];
  return execFileSync('git', args, { encoding: 'utf8' }).split('\0').filter(Boolean);
}

export async function waitForCi({ github, owner, repo, sha, sections, log = () => {},
  timeoutMs = 25 * 60_000, now = Date.now, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
  const pending = new Set(sections);
  const runs = {};
  const deadline = now() + timeoutMs;
  while (pending.size > 0) {
    for (const section of pending) {
      const { data } = await github.rest.actions.listWorkflowRuns({
        owner, repo, workflow_id: ciWorkflows[section], head_sha: sha, branch: 'main', per_page: 30,
      });
      const run = data.workflow_runs.filter(run => run.head_sha === sha && run.head_branch === 'main'
        && ['push', 'workflow_dispatch'].includes(run.event)
        && run.head_repository?.full_name === `${owner}/${repo}`).sort((a, b) => b.id - a.id)[0];
      if (!run || run.status !== 'completed') continue;
      if (run.conclusion !== 'success') throw new Error(`${ciWorkflows[section]} for ${sha} ended with ${run.conclusion}. Deployment stopped.`);
      runs[section] = run.id;
      pending.delete(section);
      log(`${section}: successful CI run ${run.id} for ${sha}.`);
    }
    if (pending.size === 0) return runs;
    if (now() >= deadline) throw new Error(`Timed out waiting for CI for ${sha}: ${[...pending].join(', ')}.`);
    await sleep(15_000);
  }
  return runs;
}
