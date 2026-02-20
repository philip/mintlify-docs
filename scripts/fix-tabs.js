#!/usr/bin/env node

/**
 * Fix Tab labels that fell back to generic "Tab N" names.
 * 
 * The original migration script used a global counter that broke with multiple
 * Tabs blocks per file. This script re-processes each file by correctly pairing
 * <Tabs labels={...}> blocks with their child <Tab> elements.
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.resolve(process.env.HOME, 'git/neon-website/content/docs');
const DEST_DIR = path.resolve(__dirname, '..');

let filesFixed = 0;
let tabsFixed = 0;

function fixTabsInFile(content) {
  // Find all Tabs blocks and rebuild them
  // Pattern: the original source has <Tabs labels={[...]}>...<TabItem>...<TabItem>...</Tabs>
  // Our conversion turned them into <Tabs>...<Tab title="...">...</Tab>...</Tabs>
  // But the labels may be wrong for 2nd+ Tabs block in a file.
  
  // Strategy: Find each <Tabs> block with its </Tabs>, count Tab children,
  // and re-read the source labels from the corresponding source file.
  
  // Actually, simpler approach: re-convert from scratch within the already-converted content
  // We know the converted pattern is <Tabs>\n<Tab title="...">
  
  // Better approach: Find all files that have misassigned labels and fix them.
  // The issue is we can't know the correct labels from the converted file alone.
  // We need to re-read the source.
  
  return content; // Placeholder - we'll use a different approach
}

function processFile(srcPath, destPath) {
  if (!fs.existsSync(srcPath) || !fs.existsSync(destPath)) return;
  
  const srcContent = fs.readFileSync(srcPath, 'utf-8');
  let destContent = fs.readFileSync(destPath, 'utf-8');
  
  // Extract all Tabs labels from source
  const tabsRegex = /<Tabs\s+labels=\{(\[[\s\S]*?\])\}/g;
  const sourceLabels = [];
  let match;
  while ((match = tabsRegex.exec(srcContent)) !== null) {
    try {
      const labels = JSON.parse(match[1].replace(/'/g, '"'));
      sourceLabels.push(labels);
    } catch {
      sourceLabels.push(null);
    }
  }
  
  if (sourceLabels.length === 0) return;
  
  // Now find all <Tabs> blocks in destination and reassign labels
  let tabsBlockIndex = 0;
  let tabIndexInBlock = 0;
  let inTabsBlock = false;
  
  const lines = destContent.split('\n');
  let modified = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.trim() === '<Tabs>') {
      inTabsBlock = true;
      tabIndexInBlock = 0;
      continue;
    }
    
    if (line.trim() === '</Tabs>') {
      if (inTabsBlock) {
        tabsBlockIndex++;
      }
      inTabsBlock = false;
      continue;
    }
    
    if (inTabsBlock) {
      const tabMatch = line.match(/^(\s*)<Tab title="([^"]*)">/);
      if (tabMatch) {
        const labels = sourceLabels[tabsBlockIndex];
        if (labels && tabIndexInBlock < labels.length) {
          const correctLabel = labels[tabIndexInBlock];
          if (tabMatch[2] !== correctLabel) {
            lines[i] = line.replace(`<Tab title="${tabMatch[2]}">`, `<Tab title="${correctLabel}">`);
            modified = true;
            tabsFixed++;
          }
        }
        tabIndexInBlock++;
      }
    }
  }
  
  if (modified) {
    fs.writeFileSync(destPath, lines.join('\n'), 'utf-8');
    filesFixed++;
  }
}

function walkAndFix(srcDir, destDir) {
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcFull = path.join(srcDir, entry.name);
    if (entry.isDirectory()) {
      const destFull = path.join(destDir, entry.name);
      if (fs.existsSync(destFull)) {
        walkAndFix(srcFull, destFull);
      }
    } else if (entry.name.endsWith('.md')) {
      const destName = entry.name.replace(/\.md$/, '.mdx');
      const destFull = path.join(destDir, destName);
      processFile(srcFull, destFull);
    }
  }
}

walkAndFix(SRC_DIR, DEST_DIR);
console.log(`Fixed ${tabsFixed} tab labels in ${filesFixed} files`);
