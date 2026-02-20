#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

const files = execSync(
  `rg -l "\\*\\*What you" --glob "*.mdx" "${ROOT}"`,
  { encoding: 'utf8' }
).trim().split('\n').filter(Boolean);

console.log(`Found ${files.length} files with InfoBlock pattern\n`);

let changed = 0;

for (const file of files) {
  const relPath = path.relative(ROOT, file);
  let content = fs.readFileSync(file, 'utf8');
  const original = content;

  // Find the InfoBlock region: starts with **What you...** (various phrasings)
  // and ends before the next paragraph of regular text or ## heading
  const infoBlockRegex = /(\*\*What you[^*]+\*\*\s*\n)([\s\S]*?)(?=\n[A-Z\[]|\n##|\n<(?!a |p>))/;
  const match = content.match(infoBlockRegex);

  if (!match) {
    console.log(`  WARNING: Could not parse InfoBlock in ${relPath}`);
    continue;
  }

  const fullBlock = match[0];

  // Parse sections from the block
  // Split on bold headers: **Header**
  const sections = [];
  const sectionRegex = /\*\*([^*]+)\*\*\s*\n([\s\S]*?)(?=\*\*[^*]+\*\*|$)/g;
  let sectionMatch;

  while ((sectionMatch = sectionRegex.exec(fullBlock)) !== null) {
    const title = sectionMatch[1].replace(/:$/, '').trim();
    const body = sectionMatch[2].trim();
    sections.push({ title, body });
  }

  if (sections.length === 0) {
    console.log(`  WARNING: No sections found in ${relPath}`);
    continue;
  }

  // Convert each section
  const cards = [];

  for (const section of sections) {
    const items = [];

    // Extract <p> items (for "What you will learn") - allow inline markdown
    const pRegex = /<p>(.*?)<\/p>/g;
    let pMatch;
    while ((pMatch = pRegex.exec(section.body)) !== null) {
      items.push(`- ${pMatch[1].trim()}`);
    }

    // Extract <a> links (for related/source sections)
    const aRegex = /<a href="([^"]+)">([^<]+)<\/a>/g;
    let aMatch;
    while ((aMatch = aRegex.exec(section.body)) !== null) {
      items.push(`- [${aMatch[2].trim()}](${aMatch[1].trim()})`);
    }

    if (items.length > 0) {
      cards.push({ title: section.title, items });
    }
  }

  if (cards.length === 0) {
    console.log(`  WARNING: No valid cards built for ${relPath}`);
    continue;
  }

  // Build replacement: first card is "What you will learn", rest are combined into second card
  let replacement;

  if (cards.length === 1) {
    // Single section - just use a Card
    replacement = `<Card title="${cards[0].title}">\n${cards[0].items.join('\n')}\n</Card>\n`;
  } else if (cards.length === 2) {
    // Two sections - use CardGroup cols={2}
    replacement = `<CardGroup cols={2}>\n<Card title="${cards[0].title}">\n${cards[0].items.join('\n')}\n</Card>\n<Card title="${cards[1].title}">\n${cards[1].items.join('\n')}\n</Card>\n</CardGroup>\n`;
  } else {
    // 3+ sections - first card + combined right card
    const rightItems = cards.slice(1).map(card => {
      if (cards.indexOf(card) > 1) {
        return `\n**${card.title}**\n${card.items.join('\n')}`;
      }
      return card.items.join('\n');
    });

    replacement = `<CardGroup cols={2}>\n<Card title="${cards[0].title}">\n${cards[0].items.join('\n')}\n</Card>\n<Card title="${cards[1].title}">\n${rightItems.join('\n')}\n</Card>\n</CardGroup>\n`;
  }

  content = content.replace(fullBlock, replacement);

  if (content !== original) {
    fs.writeFileSync(file, content);
    changed++;
    console.log(`  Fixed: ${relPath} (${cards.length} sections)`);
  }
}

console.log(`\nDone: ${changed} files updated`);
