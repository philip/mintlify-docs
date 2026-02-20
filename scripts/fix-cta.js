#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

const files = execSync(
  `rg -l "MIGRATION_FLAG: CTA - Empty CTA" --glob "*.mdx" "${ROOT}"`,
  { encoding: 'utf8' }
).trim().split('\n').filter(Boolean);

console.log(`Found ${files.length} files with empty CTA placeholders`);

const IMPORT_LINE = "import Cta from '/snippets/cta.mdx';";

let changed = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  const original = content;

  // Remove the MIGRATION_FLAG comment + empty Card block
  content = content.replace(
    /\{\/\* MIGRATION_FLAG: CTA - Empty CTA - needs Neon signup card or removal \*\/\}\s*<Card title="">\s*<\/Card>\n?/g,
    '<Cta />\n'
  );

  // Add the import after frontmatter if not already present
  if (!content.includes(IMPORT_LINE)) {
    const frontmatterEnd = content.indexOf('---', content.indexOf('---') + 1);
    if (frontmatterEnd !== -1) {
      const insertPos = content.indexOf('\n', frontmatterEnd) + 1;
      content = content.slice(0, insertPos) + '\n' + IMPORT_LINE + '\n' + content.slice(insertPos);
    }
  }

  if (content !== original) {
    fs.writeFileSync(file, content);
    changed++;
    console.log(`  Fixed: ${path.relative(ROOT, file)}`);
  }
}

console.log(`\nDone: ${changed} files updated`);
