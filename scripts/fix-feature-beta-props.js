const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function findMdxFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && !['node_modules', '.git', 'scripts'].includes(entry.name)) {
      results.push(...findMdxFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.mdx')) {
      results.push(full);
    }
  }
  return results;
}

let totalFixed = 0;
let totalFlagsCleaned = 0;

for (const file of findMdxFiles(ROOT)) {
  let content = fs.readFileSync(file, 'utf8');
  const relPath = path.relative(ROOT, file);
  let changed = false;

  // Skip component-guide.mdx which documents these components
  if (relPath === 'community/component-guide.mdx') continue;

  // 1. Replace FeatureBetaProps with inline <Note>
  const betaRegex = /\{\/\* MIGRATION_FLAG: FeatureBetaProps[^*]*\*\/\}\n<FeatureBetaProps\s+feature_name="([^"]+)"\s*\/>/g;
  const newContent = content.replace(betaRegex, (match, featureName) => {
    totalFixed++;
    return `<Note title="Beta">\nThe **${featureName}** is in Beta. Share your feedback on [Discord](https://discord.gg/92vNTzKDGp) or via the [Neon Console](https://console.neon.tech/app/projects?modal=feedback).\n</Note>`;
  });

  if (newContent !== content) {
    content = newContent;
    changed = true;
  }

  // 2. Remove MIGRATION_FLAG comments that are inside code blocks
  // These are JSX comments like {/* MIGRATION_FLAG: ComponentName - No Mintlify equivalent */}
  // that were incorrectly inserted into code examples
  const lines = content.split('\n');
  const cleanedLines = [];
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trimStart().startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
      } else {
        inCodeBlock = false;
      }
      cleanedLines.push(line);
      continue;
    }

    if (inCodeBlock && /^\s*\{\/\* MIGRATION_FLAG:.*\*\/\}$/.test(line.trim())) {
      totalFlagsCleaned++;
      changed = true;
      continue;
    }

    // Also fix lines like: return {/* MIGRATION_FLAG: ... */}
    // These should become: return <ComponentName ... />
    // The flag replaced the actual component - need to check the next line
    if (inCodeBlock && /\{\/\* MIGRATION_FLAG:.*\*\/\}/.test(line)) {
      const cleaned = line.replace(/\s*\{\/\* MIGRATION_FLAG:[^}]*\*\/\}\s*/, ' ');
      cleanedLines.push(cleaned.trimEnd() === '' ? undefined : cleaned);
      totalFlagsCleaned++;
      changed = true;
      continue;
    }

    cleanedLines.push(line);
  }

  if (changed) {
    const finalContent = cleanedLines.filter(l => l !== undefined).join('\n');
    fs.writeFileSync(file, finalContent, 'utf8');
    console.log(`Fixed: ${relPath}`);
  }
}

console.log(`\nTotal FeatureBetaProps replaced: ${totalFixed}`);
console.log(`Total MIGRATION_FLAG comments cleaned from code blocks: ${totalFlagsCleaned}`);
