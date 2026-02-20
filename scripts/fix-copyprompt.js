#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const NEON_PROMPTS_DIR = path.resolve(ROOT, '..', '..', 'neon-website', 'public', 'prompts');
const SNIPPETS_DIR = path.resolve(ROOT, 'snippets', 'prompts');

// Ensure snippets/prompts directory exists
fs.mkdirSync(SNIPPETS_DIR, { recursive: true });

// Step 1: Find all CopyPrompt usages and extract metadata
const { execSync } = require('child_process');
const mdxFiles = execSync(
  `rg -l "CopyPrompt" --glob "*.mdx" "${ROOT}"`,
  { encoding: 'utf8' }
).trim().split('\n').filter(Boolean);

console.log(`Found ${mdxFiles.length} files with CopyPrompt\n`);

// Parse each file for CopyPrompt src and description
const usages = [];
for (const file of mdxFiles) {
  const content = fs.readFileSync(file, 'utf8');
  // Match multi-line CopyPrompt tags
  const regex = /<CopyPrompt\s+([^>]*?)\/>/gs;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const attrs = match[0];
    const srcMatch = attrs.match(/src="([^"]+)"/);
    const descMatch = attrs.match(/description="([^"]+)"/);
    if (srcMatch) {
      usages.push({
        file,
        fullMatch: match[0],
        src: srcMatch[1],
        description: descMatch ? descMatch[1] : 'Pre-built AI prompt',
      });
    }
  }
}

console.log(`Found ${usages.length} CopyPrompt usages\n`);

// Step 2: Create snippet files from source prompts
// Map src paths to snippet names
const snippetMap = new Map(); // src -> { snippetName, snippetPath, description }

for (const usage of usages) {
  if (snippetMap.has(usage.src)) continue;

  // /prompts/nextjs-prompt.md -> nextjs-prompt
  const baseName = path.basename(usage.src, '.md');
  const snippetName = baseName; // keep full name for clarity
  const snippetPath = path.join(SNIPPETS_DIR, `${snippetName}.mdx`);

  // Read source prompt from neon-website
  const sourceFile = path.join(NEON_PROMPTS_DIR, path.basename(usage.src));
  if (!fs.existsSync(sourceFile)) {
    console.warn(`  WARNING: Source prompt not found: ${sourceFile}`);
    continue;
  }

  const promptContent = fs.readFileSync(sourceFile, 'utf8').trim();

  // Wrap in Mintlify Prompt component with the description from first usage
  const snippetContent = `<Prompt description="${usage.description}">
${promptContent}
</Prompt>
`;

  fs.writeFileSync(snippetPath, snippetContent);
  snippetMap.set(usage.src, { snippetName, snippetPath, description: usage.description });
  console.log(`  Created snippet: snippets/prompts/${snippetName}.mdx`);
}

console.log(`\nCreated ${snippetMap.size} snippet files\n`);

// Step 3: Update guide pages - replace CopyPrompt with snippet imports
let updatedFiles = 0;

for (const file of mdxFiles) {
  let content = fs.readFileSync(file, 'utf8');
  const original = content;

  // Find all CopyPrompt usages in this file
  const fileUsages = usages.filter(u => u.file === file);

  for (const usage of fileUsages) {
    const snippet = snippetMap.get(usage.src);
    if (!snippet) continue;

    // Build import name from snippet name (camelCase)
    const importName = snippet.snippetName
      .replace(/-([a-z])/g, (_, c) => c.toUpperCase())
      .replace(/^([a-z])/, (_, c) => c.toUpperCase());

    const importLine = `import ${importName} from '/snippets/prompts/${snippet.snippetName}.mdx';`;

    // Remove the MIGRATION_FLAG comment if present (on the line before)
    content = content.replace(
      /\{\/\* MIGRATION_FLAG: CopyPrompt[^*]*\*\/\}\s*\n/g,
      ''
    );

    // Replace the CopyPrompt tag with the snippet component
    // Handle multi-line CopyPrompt tags
    const escapedSrc = usage.src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const copyPromptRegex = new RegExp(
      `<CopyPrompt\\s+[^>]*src="${escapedSrc}"[^>]*/>`,
      'gs'
    );
    content = content.replace(copyPromptRegex, `<${importName} />`);

    // Add import after frontmatter if not already present
    if (!content.includes(importLine)) {
      const frontmatterEnd = content.indexOf('---', content.indexOf('---') + 1);
      if (frontmatterEnd !== -1) {
        const insertPos = content.indexOf('\n', frontmatterEnd) + 1;
        // Check if there are already imports there
        const afterFrontmatter = content.slice(insertPos);
        if (afterFrontmatter.startsWith('\nimport ')) {
          // Add after existing imports
          const lastImportEnd = insertPos + afterFrontmatter.search(/\n(?!import )/);
          content = content.slice(0, lastImportEnd) + '\n' + importLine + content.slice(lastImportEnd);
        } else {
          content = content.slice(0, insertPos) + '\n' + importLine + '\n' + content.slice(insertPos);
        }
      }
    }
  }

  if (content !== original) {
    fs.writeFileSync(file, content);
    updatedFiles++;
    console.log(`  Updated: ${path.relative(ROOT, file)}`);
  }
}

console.log(`\nDone: ${updatedFiles} guide pages updated`);
