#!/usr/bin/env node

/**
 * Add labels to code blocks inside <CodeGroup> based on the original <CodeTabs> labels.
 * Re-reads source files to get the correct labels.
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.resolve(process.env.HOME, 'git/neon-website/content/docs');
const DEST_DIR = path.resolve(__dirname, '..');

let filesFixed = 0;
let labelsAdded = 0;

function processFile(srcPath, destPath) {
  if (!fs.existsSync(srcPath) || !fs.existsSync(destPath)) return;

  const srcContent = fs.readFileSync(srcPath, 'utf-8');
  let destContent = fs.readFileSync(destPath, 'utf-8');

  // Extract CodeTabs labels from source (in order)
  const codeTabsRegex = /<CodeTabs(?:\s+reverse=\{true\})?\s+labels=\{(\[[\s\S]*?\])\}(?:\s+reverse=\{true\})?>/g;
  const allLabels = [];
  let match;
  while ((match = codeTabsRegex.exec(srcContent)) !== null) {
    try {
      const labels = JSON.parse(match[1].replace(/'/g, '"'));
      allLabels.push(labels);
    } catch {
      allLabels.push(null);
    }
  }

  if (allLabels.length === 0) return;

  // Find CodeGroup blocks in dest and add labels to code fences
  let codeGroupIdx = 0;
  let modified = false;

  destContent = destContent.replace(
    /<CodeGroup>([\s\S]*?)<\/CodeGroup>/g,
    (cgMatch, inner) => {
      const labels = allLabels[codeGroupIdx++];
      if (!labels) return cgMatch;

      let codeBlockIdx = 0;
      const newInner = inner.replace(
        /```(\w+)([^\n]*)/g,
        (fenceMatch, lang, rest) => {
          if (codeBlockIdx < labels.length) {
            const label = labels[codeBlockIdx++];
            // Don't add if there's already a title/filename
            if (rest.trim() && !rest.includes('filename=')) {
              return fenceMatch;
            }
            if (rest.includes('filename=')) {
              return fenceMatch;
            }
            labelsAdded++;
            modified = true;
            return `\`\`\`${lang} ${label}`;
          }
          return fenceMatch;
        }
      );
      return `<CodeGroup>${newInner}</CodeGroup>`;
    }
  );

  if (modified) {
    fs.writeFileSync(destPath, destContent, 'utf-8');
    filesFixed++;
  }
}

function walk(srcDir, destDir) {
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcFull = path.join(srcDir, entry.name);
    if (entry.isDirectory()) {
      const destFull = path.join(destDir, entry.name);
      if (fs.existsSync(destFull)) {
        walk(srcFull, destFull);
      }
    } else if (entry.name.endsWith('.md')) {
      const destName = entry.name.replace(/\.md$/, '.mdx');
      const destFull = path.join(destDir, destName);
      processFile(srcFull, destFull);
    }
  }
}

walk(SRC_DIR, DEST_DIR);
console.log(`Added ${labelsAdded} code block labels in ${filesFixed} files`);
