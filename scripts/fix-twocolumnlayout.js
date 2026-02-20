const fs = require('fs');
const path = require('path');

const files = [
  'auth/quick-start/tanstack-router.mdx',
  'auth/quick-start/nextjs.mdx',
  'auth/quick-start/react-router-components.mdx',
  'auth/quick-start/react.mdx',
  'auth/quick-start/nextjs-api-only.mdx',
  'reference/javascript-sdk.mdx',
  'auth/reference/nextjs-server.mdx',
];

const rootDir = path.join(__dirname, '..');

let totalFiles = 0;
let totalReplacements = 0;

for (const file of files) {
  const filePath = path.join(rootDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  // Remove all MIGRATION_FLAG comments for TwoColumnLayout
  content = content.replace(/\{\/\*\s*MIGRATION_FLAG:\s*TwoColumnLayout[^*]*\*\/\}\n?/g, '');

  // Determine if this file uses .Step or .Item pattern
  const hasSteps = content.includes('<TwoColumnLayout.Step');
  const hasItems = content.includes('<TwoColumnLayout.Item');

  if (hasSteps) {
    // Convert TwoColumnLayout with Steps to Mintlify <Steps>/<Step>

    // Replace opening <TwoColumnLayout> with <Steps>
    content = content.replace(/<TwoColumnLayout>\s*\n?/g, '<Steps>\n\n');

    // Replace closing </TwoColumnLayout> with </Steps>
    content = content.replace(/<\/TwoColumnLayout>\s*\n?/g, '</Steps>\n\n');

    // Convert <TwoColumnLayout.Step title="..."> to <Step title="...">
    content = content.replace(/<TwoColumnLayout\.Step\s+title="([^"]*)">/g, '<Step title="$1">');

    // Convert </TwoColumnLayout.Step> to </Step>
    content = content.replace(/<\/TwoColumnLayout\.Step>/g, '</Step>');

    // Remove <TwoColumnLayout.Block> and <TwoColumnLayout.Block label="..."> tags
    content = content.replace(/<TwoColumnLayout\.Block(?:\s+label="[^"]*")?>\s*\n?/g, '');

    // Remove </TwoColumnLayout.Block> tags
    content = content.replace(/<\/TwoColumnLayout\.Block>\s*\n?/g, '');
  }

  if (hasItems) {
    // Convert TwoColumnLayout with Items to heading-based sections

    // Remove opening <TwoColumnLayout> wrapper
    content = content.replace(/<TwoColumnLayout>\s*\n?/g, '');

    // Remove closing </TwoColumnLayout>
    content = content.replace(/<\/TwoColumnLayout>\s*\n?/g, '');

    // Convert <TwoColumnLayout.Item title="..." method="..." id="..."> to ## heading
    content = content.replace(
      /<TwoColumnLayout\.Item\s+title="([^"]*)"\s+method="([^"]*)"\s+id="([^"]*)">/g,
      (match, title, method, id) => {
        return `## ${title} {#${id}}\n\n\`${method}\`\n`;
      }
    );

    // Convert <TwoColumnLayout.Item title="..." id="..."> (no method) to ## heading
    content = content.replace(
      /<TwoColumnLayout\.Item\s+title="([^"]*)"\s+id="([^"]*)">/g,
      (match, title, id) => {
        return `## ${title} {#${id}}\n`;
      }
    );

    // Convert </TwoColumnLayout.Item> to empty (section ends naturally)
    content = content.replace(/<\/TwoColumnLayout\.Item>\s*\n?/g, '\n');

    // Remove <TwoColumnLayout.Block> and <TwoColumnLayout.Block label="..."> tags
    content = content.replace(/<TwoColumnLayout\.Block(?:\s+label="[^"]*")?>\s*\n?/g, '');

    // Remove </TwoColumnLayout.Block> tags
    content = content.replace(/<\/TwoColumnLayout\.Block>\s*\n?/g, '');
  }

  // Remove layout: wide from frontmatter (no longer needed without two-column layout)
  content = content.replace(/^(---\n[\s\S]*?)layout:\s*wide\n([\s\S]*?---)/m, '$1$2');

  // Clean up excessive blank lines (3+ newlines -> 2)
  content = content.replace(/\n{3,}/g, '\n\n');

  if (content !== original) {
    fs.writeFileSync(filePath, content);
    totalFiles++;
    const removedLines = original.split('\n').length - content.split('\n').length;
    console.log(`Fixed: ${file} (removed ~${removedLines} lines of TwoColumnLayout markup)`);
    totalReplacements++;
  } else {
    console.log(`No changes: ${file}`);
  }
}

console.log(`\nTotal files modified: ${totalFiles}`);
