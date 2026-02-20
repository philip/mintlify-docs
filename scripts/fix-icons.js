const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TECH_LOGOS_DIR = path.join(ROOT, 'images', 'technology-logos');
const DETAIL_ICONS_DIR = path.join(ROOT, 'images', 'icons');

// Build lookup sets from the actual SVG files on disk
function buildIconLookup(dir, stripDarkSuffix = false) {
  const names = new Set();
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.svg')) continue;
    if (stripDarkSuffix && file.endsWith('-dark.svg')) continue;
    names.add(file.replace('.svg', ''));
  }
  return names;
}

const techLogos = buildIconLookup(TECH_LOGOS_DIR, true);
const detailIcons = buildIconLookup(DETAIL_ICONS_DIR);

console.log(`TechCards logos: ${techLogos.size}`);
console.log(`DetailIconCards icons: ${detailIcons.size}`);

// Find all MDX files
function findMdxFiles(dir) {
  let results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && !['node_modules', '.git', 'scripts'].includes(entry.name)) {
      results = results.concat(findMdxFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.mdx')) {
      results.push(full);
    }
  }
  return results;
}

const files = findMdxFiles(ROOT);
let totalReplacements = 0;
let filesChanged = 0;
const unmapped = new Set();

for (const file of files) {
  let content = fs.readFileSync(file, 'utf-8');
  let changed = false;

  // First, fix duplicate icon attributes: icon="x" icon="x" -> icon="x"
  const dupRegex = /icon="([^"]+)"\s+icon="\1"/g;
  if (dupRegex.test(content)) {
    content = content.replace(/icon="([^"]+)"\s+icon="\1"/g, 'icon="$1"');
    changed = true;
  }

  // Replace icon="name" with icon="/images/.../name.svg"
  const iconRegex = /icon="([a-z][a-z0-9-]*)"/g;
  const newContent = content.replace(iconRegex, (match, name) => {
    // Already a path reference
    if (name.startsWith('/') || name.includes('.')) return match;

    if (techLogos.has(name)) {
      totalReplacements++;
      return `icon="/images/technology-logos/${name}.svg"`;
    }
    if (detailIcons.has(name)) {
      totalReplacements++;
      return `icon="/images/icons/${name}.svg"`;
    }

    unmapped.add(name);
    return match;
  });

  if (newContent !== content) {
    fs.writeFileSync(file, newContent, 'utf-8');
    filesChanged++;
    console.log(`  Updated: ${path.relative(ROOT, file)}`);
  }
}

console.log(`\nDone: ${totalReplacements} replacements in ${filesChanged} files`);
if (unmapped.size > 0) {
  console.log(`Unmapped icons: ${[...unmapped].sort().join(', ')}`);
}
