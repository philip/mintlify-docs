#!/usr/bin/env node

/**
 * Strip /docs/ prefix from internal links in all .mdx files.
 * In Neon's website, internal links use /docs/path but Mintlify serves from root.
 */

const fs = require('fs');
const path = require('path');

const DEST_DIR = path.resolve(__dirname, '..');

let filesFixed = 0;
let linksFixed = 0;

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  const original = content;

  // Fix markdown links: [text](/docs/path) → [text](/path)
  content = content.replace(/\]\(\/docs\//g, '](/');

  // Fix href attributes: href="/docs/path" → href="/path"
  content = content.replace(/href="\/docs\//g, 'href="/');

  // Fix href attributes with single quotes: href='/docs/path'
  content = content.replace(/href='\/docs\//g, "href='/");

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf-8');
    const count = (original.match(/\/docs\//g) || []).length - (content.match(/\/docs\//g) || []).length;
    linksFixed += count;
    filesFixed++;
  }
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', '.git', 'images', 'scripts'].includes(entry.name)) {
        walk(full);
      }
    } else if (entry.name.endsWith('.mdx') || entry.name.endsWith('.md')) {
      fixFile(full);
    }
  }
}

walk(DEST_DIR);
console.log(`Fixed ${linksFixed} links in ${filesFixed} files`);
