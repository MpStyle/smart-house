import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const run = (command, args, directory = '') =>
  execFileSync(command, args, { cwd: resolve(root, directory), stdio: 'inherit' });

run('dotnet', ['build', 'backend/SmartHouse.Api', '--configuration', 'Release', '--nologo', '--verbosity', 'quiet']);
run('dotnet', ['tool', 'restore']);
run('dotnet', ['nswag', 'run', 'sdk/nswag.json']);
run('npm', ['run', 'api:generate'], 'frontend');
