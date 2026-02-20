const fs = require('fs');
const path = require('path');

const neonDir = '/Users/philip.olson/git/neon-website/content/docs';
const mintDir = path.join(__dirname, '..');

const files = [
  'auth/overview',
  'guides/vue',
  'guides/integrations',
  'guides/logical-replication-guide',
  'guides/react',
  'guides/file-storage',
  'community/component-icon-guide',
  'community/component-guide',
  'community/component-architecture',
  'get-started/frameworks',
  'get-started/languages',
  'get-started/orms',
];

let totalFixed = 0;

files.forEach(file => {
  const srcPath = path.join(neonDir, file + '.md');
  const dstPath = path.join(mintDir, file + '.mdx');

  if (!fs.existsSync(srcPath) || !fs.existsSync(dstPath)) {
    console.log(`Skipping ${file} (source or dest missing)`);
    return;
  }

  const src = fs.readFileSync(srcPath, 'utf-8');
  let dst = fs.readFileSync(dstPath, 'utf-8');

  // Extract all <a> elements from <TechCards> blocks in source
  const techCardBlocks = [];
  const tcRegex = /<TechCards[^>]*>([\s\S]*?)<\/TechCards>/g;
  let tcMatch;
  while ((tcMatch = tcRegex.exec(src)) !== null) {
    const block = tcMatch[1];
    const cards = [];
    const aRegex = /<a\s+([^>]+?)><\/a>|<a\s+([^>]+?)\s*\/>/g;
    let aMatch;
    while ((aMatch = aRegex.exec(block)) !== null) {
      const attrs = aMatch[1] || aMatch[2];
      const card = {};
      const hrefMatch = attrs.match(/href="([^"]+)"/);
      const titleMatch = attrs.match(/title="([^"]+)"/);
      const descMatch = attrs.match(/description="([^"]+)"/);
      const iconMatch = attrs.match(/icon="([^"]+)"/);
      if (hrefMatch) card.href = hrefMatch[1].replace('/docs/', '/');
      if (titleMatch) card.title = titleMatch[1];
      if (descMatch) card.description = descMatch[1];
      if (iconMatch) card.icon = iconMatch[1];
      if (card.title) cards.push(card);
    }
    techCardBlocks.push(cards);
  }

  if (techCardBlocks.length === 0) {
    console.log(`No TechCards blocks found in source for ${file}`);
    return;
  }

  // Find corresponding <CardGroup> blocks in destination and replace bare <Card> tags
  let blockIdx = 0;
  let fileFixed = 0;

  const cgRegex = /<CardGroup[^>]*>([\s\S]*?)<\/CardGroup>/g;
  dst = dst.replace(cgRegex, (fullMatch, inner) => {
    // Check if this block contains self-closing Card tags (from TechCards conversion)
    const bareCards = inner.match(/<Card title="[^"]*" \/>/g);
    if (!bareCards || bareCards.length === 0) return fullMatch;

    if (blockIdx >= techCardBlocks.length) {
      console.log(`  Warning: more CardGroup blocks than TechCards blocks in ${file}`);
      return fullMatch;
    }

    const srcCards = techCardBlocks[blockIdx];
    blockIdx++;

    if (srcCards.length !== bareCards.length) {
      console.log(`  Warning: card count mismatch in ${file} block ${blockIdx}: src=${srcCards.length} dst=${bareCards.length}`);
    }

    let cardIdx = 0;
    const result = inner.replace(/<Card title="([^"]*)" \/>/g, (cardMatch, title) => {
      // Find matching source card by title
      let srcCard = srcCards.find(c => c.title === title);
      if (!srcCard && cardIdx < srcCards.length) {
        srcCard = srcCards[cardIdx];
      }
      cardIdx++;

      if (!srcCard) {
        console.log(`  Could not find source card for "${title}" in ${file}`);
        return cardMatch;
      }

      fileFixed++;
      let attrs = `title="${srcCard.title}"`;
      if (srcCard.icon) attrs += ` icon="${srcCard.icon}"`;
      if (srcCard.href) attrs += ` href="${srcCard.href}"`;
      let card = `<Card ${attrs}`;
      if (srcCard.description) {
        card += `>\n    ${srcCard.description}\n  </Card>`;
      } else {
        card += ` />`;
      }
      return card;
    });

    return `<CardGroup>${result}</CardGroup>`;
  });

  if (fileFixed > 0) {
    fs.writeFileSync(dstPath, dst);
    console.log(`Fixed ${fileFixed} cards in ${file}.mdx`);
    totalFixed += fileFixed;
  } else {
    console.log(`No fixes needed for ${file}.mdx`);
  }
});

console.log(`\nTotal: fixed ${totalFixed} cards across all files.`);
