import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { changedFiles, changedSections, waitForCi } from './sections.mjs';

test('frontend changes never select backend or infrastructure', () => {
  assert.deepEqual(changedSections(['frontend/src/App.tsx', 'frontend/package-lock.json', '.github/workflows/deploy-frontend.yml']),
    { frontend: true, backend: false, infrastructure: false });
});
test('backend changes never select frontend or infrastructure', () => {
  assert.deepEqual(changedSections(['backend/SmartHouse.Api/Program.cs', 'global.json', 'SmartHouse.sln']),
    { frontend: false, backend: true, infrastructure: false });
});
test('infrastructure and its parameters select only infrastructure', () => {
  assert.deepEqual(changedSections(['infra/main.bicep', 'infra/main.bicepparam', '.github/workflows/ci-infrastructure.yml']),
    { frontend: false, backend: false, infrastructure: true });
});
test('all README changes and unrelated files are excluded', () => {
  assert.deepEqual(changedSections(['README.md', 'frontend/README.md', 'backend/README.md', 'infra/README.md',
    '.github/README.md', '.github/actions/azure-targets/README.md', 'frontend/readme.md', 'infra/ReadMe.it.md', '.gitignore']),
  { frontend: false, backend: false, infrastructure: false });
});
test('shared pipeline implementation selects every affected section', () => {
  for (const path of ['.github/workflows/deploy.yml', '.github/scripts/sections.mjs', '.github/actions/azure-targets/action.yml'])
    assert.deepEqual(changedSections([path]), { frontend: true, backend: true, infrastructure: true });
});
test('multiple changes select exactly their sections', () => {
  assert.deepEqual(changedSections(['frontend/vite.config.ts', 'backend/SmartHouse.Api.Tests/ApiTests.cs']),
    { frontend: true, backend: true, infrastructure: false });
});
test('git comparison handles initial pushes, multi-commit pushes and deletions', () => {
  const directory = mkdtempSync(join(tmpdir(), 'smart-house-workflows-'));
  const git = (...args) => execFileSync('git', args, { cwd: directory, encoding: 'utf8' }).trim();
  try {
    git('init', '--quiet');
    git('config', 'user.name', 'Workflow test');
    git('config', 'user.email', 'workflow-test@example.invalid');
    writeFileSync(join(directory, 'first.txt'), 'first');
    git('add', '.');
    git('commit', '--quiet', '-m', 'Initial');
    const first = git('rev-parse', 'HEAD');
    git('rm', '--quiet', 'first.txt');
    git('commit', '--quiet', '-m', 'Remove');
    writeFileSync(join(directory, 'second.txt'), 'second');
    git('add', '.');
    git('commit', '--quiet', '-m', 'Add');
    const original = process.cwd();
    process.chdir(directory);
    try {
      assert.deepEqual(changedFiles('0'.repeat(40), first), ['first.txt']);
      assert.deepEqual(changedFiles(first, git('rev-parse', 'HEAD')), ['first.txt', 'second.txt']);
      const beforeRename = git('rev-parse', 'HEAD');
      mkdirSync(join(directory, 'frontend'));
      git('mv', 'second.txt', 'frontend/second.txt');
      git('commit', '--quiet', '-m', 'Move across sections');
      assert.deepEqual(changedFiles(beforeRename, git('rev-parse', 'HEAD')), ['frontend/second.txt', 'second.txt']);
    } finally { process.chdir(original); }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

const run = (overrides = {}) => ({
  id: 10, head_sha: 'expected-sha', head_branch: 'main', event: 'push',
  head_repository: { full_name: 'owner/repo' }, status: 'completed', conclusion: 'success', ...overrides,
});
const github = runs => ({ rest: { actions: { listWorkflowRuns: async request => ({ data: {
  workflow_runs: typeof runs === 'function' ? runs(request) : runs,
} }) } } });
const options = { owner: 'owner', repo: 'repo', sha: 'expected-sha', sections: ['frontend'], timeoutMs: 0 };
test('CI gate waits only for selected sections and accepts only the exact commit', async () => {
  const requested = [];
  const result = await waitForCi({ ...options, sections: ['frontend', 'infrastructure'], github: github(request => {
    requested.push(request.workflow_id);
    return [run({ id: 50, head_sha: 'other-sha' }), run()];
  }) });
  assert.deepEqual(result, { frontend: 10, infrastructure: 10 });
  assert.deepEqual(requested, ['ci-frontend.yml', 'ci-infrastructure.yml']);
});
test('failed, skipped and canceled CI block deployment', async () => {
  for (const conclusion of ['failure', 'cancelled', 'skipped'])
    await assert.rejects(waitForCi({ ...options, github: github([run({ conclusion })]) }), /Deployment stopped/);
});
test('foreign, PR and stale runs never authorize a deployment', async () => {
  await assert.rejects(waitForCi({ ...options, github: github([
    run({ head_repository: { full_name: 'someone/fork' } }), run({ event: 'pull_request' }),
    run({ head_branch: 'feature' }), run({ head_sha: 'other-sha' }),
  ]) }), /Timed out/);
});
test('a failed newer run is not hidden by an older successful run', async () => {
  await assert.rejects(waitForCi({ ...options, github: github([run(), run({ id: 11, conclusion: 'failure' })]) }), /Deployment stopped/);
});
test('queued CI is awaited, but a missing run times out explicitly', async () => {
  let requests = 0;
  const result = await waitForCi({ ...options, timeoutMs: 100, now: () => 0, sleep: async () => {},
    github: github(() => [run({ status: ++requests === 1 ? 'queued' : 'completed' })]) });
  assert.deepEqual(result, { frontend: 10 });
  await assert.rejects(waitForCi({ ...options, github: github([]) }), /Timed out/);
});
