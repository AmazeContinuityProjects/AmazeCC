const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const buildInfoPath = path.join(projectRoot, 'src', 'data', 'buildInfo.json');

function runGitCommand(cmd) {
  try {
    return execSync(cmd, { cwd: projectRoot, encoding: 'utf8' }).trim();
  } catch (e) {
    return '';
  }
}

function generate() {
  const commitHash = runGitCommand('git rev-parse --short HEAD') || 'unknown';
  const buildNumber = runGitCommand('git rev-list --count HEAD') || '0';
  const rawCommits = runGitCommand('git log -n 6 --pretty=format:"%s"') || 'Updates and optimizations';
  const commitDate = runGitCommand('git log -1 --format=%cd --date=format:%Y-%m-%d') || new Date().toISOString().split('T')[0];

  // Split commit messages by newlines and filter out empty lines or generic merge noise
  const changes = rawCommits
    .split('\n')
    .map(c => c.trim())
    .filter(c => c.length > 0 && !c.toLowerCase().startsWith('merge branch') && !c.toLowerCase().startsWith('merge pull request'));

  if (changes.length === 0) {
    changes.push('Updates and optimizations');
  }

  const buildInfo = {
    buildNumber,
    commitHash,
    date: commitDate,
    changes: changes.slice(0, 5)
  };

  fs.writeFileSync(buildInfoPath, JSON.stringify(buildInfo, null, 2));
  console.log(`Generated buildInfo.json: Build #${buildNumber} (${commitHash})`);
}

generate();
