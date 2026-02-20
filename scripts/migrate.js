#!/usr/bin/env node

/**
 * Neon Docs → Mintlify migration script
 * 
 * Reads .md files from ~/git/neon-website/content/docs/,
 * converts frontmatter and MDX components to Mintlify equivalents,
 * and writes .mdx files to the current repo.
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.resolve(process.env.HOME, 'git/neon-website/content/docs');
const DEST_DIR = path.resolve(__dirname, '..');

const SKIP_DIRS = new Set(['unused', 'shared-content', 'images', 'node_modules']);
const SKIP_FILES = new Set(['navigation.yaml', 'sdk-navigation.yaml', 'index.js', '.DS_Store', '.env']);
const SKIP_PREFIXES = ['auth/legacy'];

const stats = {
  filesProcessed: 0,
  filesSkipped: 0,
  flagsInserted: 0,
  componentConversions: {},
  errors: [],
};

function shouldSkip(relPath) {
  if (SKIP_PREFIXES.some(p => relPath.startsWith(p))) return true;
  const parts = relPath.split(path.sep);
  if (parts.some(p => SKIP_DIRS.has(p))) return true;
  if (SKIP_FILES.has(path.basename(relPath))) return true;
  if (!relPath.endsWith('.md')) return true;
  return false;
}

// ─── Frontmatter conversion ────────────────────────────────────────

function convertFrontmatter(content) {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return content;

  let fm = fmMatch[1];
  const body = content.slice(fmMatch[0].length);

  fm = fm.replace(/^summary:\s/m, 'description: ');
  fm = fm.replace(/^summary:\s*>\-?\s*\n/m, 'description: >-\n');

  // Remove fields Mintlify doesn't use
  fm = fm.replace(/^enableTableOfContents:.*\n?/m, '');
  fm = fm.replace(/^updatedOn:.*\n?/m, '');

  // Convert redirectFrom to Mintlify redirect format
  // Keep as-is for now; Mintlify supports redirect_from or we handle in docs.json
  fm = fm.replace(/^redirectFrom:/m, 'redirect_from:');

  // Clean up trailing whitespace/newlines in frontmatter
  fm = fm.replace(/\n{3,}/g, '\n\n').trim();

  return `---\n${fm}\n---${body}`;
}

// ─── Component conversions ────────────────────────────────────────

function trackConversion(name) {
  stats.componentConversions[name] = (stats.componentConversions[name] || 0) + 1;
}

function insertFlag(componentName, reason, originalText) {
  stats.flagsInserted++;
  return `{/* MIGRATION_FLAG: ${componentName} - ${reason} */}\n${originalText}`;
}

function convertAdmonitions(content) {
  const typeMap = {
    'note': 'Note',
    'tip': 'Tip',
    'warning': 'Warning',
    'important': 'Warning',
    'info': 'Info',
    'comingSoon': 'Info',
  };

  // Handle Admonition with title
  content = content.replace(
    /<Admonition\s+type="(\w+)"(?:\s+title="([^"]*)")?\s*>([\s\S]*?)<\/Admonition>/g,
    (match, type, title, children) => {
      const mintComponent = typeMap[type];
      if (!mintComponent) {
        return insertFlag('Admonition', `Unknown type: ${type}`, match);
      }
      trackConversion(`Admonition.${type}`);
      const titleAttr = title ? ` title="${title}"` : '';
      if (type === 'comingSoon' && !title) {
        return `<Info title="Coming Soon">${children}</Info>`;
      }
      return `<${mintComponent}${titleAttr}>${children}</${mintComponent}>`;
    }
  );

  return content;
}

function convertTabs(content) {
  // Convert <Tabs labels={["A", "B"]}> + <TabItem> to Mintlify <Tabs> + <Tab title="A">
  content = content.replace(
    /<Tabs\s+labels=\{(\[[\s\S]*?\])\}>/g,
    (match, labelsStr) => {
      trackConversion('Tabs');
      let labels;
      try {
        labels = JSON.parse(labelsStr.replace(/'/g, '"'));
      } catch {
        return insertFlag('Tabs', 'Could not parse labels', match);
      }
      // We'll store labels for TabItem replacement
      convertTabs._currentLabels = labels;
      convertTabs._labelIndex = 0;
      return '<Tabs>';
    }
  );

  // Replace <TabItem> with <Tab title="...">
  content = content.replace(/<TabItem>/g, () => {
    const labels = convertTabs._currentLabels || [];
    const idx = convertTabs._labelIndex || 0;
    const title = labels[idx] || `Tab ${idx + 1}`;
    convertTabs._labelIndex = idx + 1;
    return `<Tab title="${title}">`;
  });

  content = content.replace(/<\/TabItem>/g, '</Tab>');

  // Handle multiple Tabs blocks - reset for each new <Tabs labels=
  // Already handled by the replace callback above

  return content;
}

function convertCodeTabs(content) {
  // <CodeTabs labels={["npm", "yarn"]}> ... </CodeTabs>
  // → <CodeGroup> with labels added to code fence titles
  content = content.replace(
    /<CodeTabs(?:\s+reverse=\{true\})?\s+labels=\{(\[[\s\S]*?\])\}>/g,
    (match, labelsStr) => {
      trackConversion('CodeTabs');
      let labels;
      try {
        labels = JSON.parse(labelsStr.replace(/'/g, '"'));
      } catch {
        return insertFlag('CodeTabs', 'Could not parse labels', match);
      }
      convertCodeTabs._currentLabels = labels;
      convertCodeTabs._labelIndex = 0;
      return '<CodeGroup>';
    }
  );

  // Also handle reverse before labels
  content = content.replace(
    /<CodeTabs\s+labels=\{(\[[\s\S]*?\])\}(?:\s+reverse=\{true\})?>/g,
    (match, labelsStr) => {
      if (match.includes('<CodeGroup>')) return match; // already converted
      trackConversion('CodeTabs');
      let labels;
      try {
        labels = JSON.parse(labelsStr.replace(/'/g, '"'));
      } catch {
        return insertFlag('CodeTabs', 'Could not parse labels', match);
      }
      convertCodeTabs._currentLabels = labels;
      convertCodeTabs._labelIndex = 0;
      return '<CodeGroup>';
    }
  );

  content = content.replace(/<\/CodeTabs>/g, '</CodeGroup>');

  return content;
}

function convertDetailIconCards(content) {
  // <DetailIconCards withNumbers compact>
  //   <a href="..." description="..." icon="...">Label</a>
  // </DetailIconCards>
  content = content.replace(
    /<DetailIconCards[^>]*>([\s\S]*?)<\/DetailIconCards>/g,
    (match, children) => {
      trackConversion('DetailIconCards');
      // Convert <a> children to <Card>
      const cards = children.replace(
        /<a\s+href="([^"]*)"(?:\s+description="([^"]*)")?(?:\s+icon="([^"]*)")?\s*>([^<]*)<\/a>/g,
        (_, href, desc, icon, label) => {
          const iconAttr = icon ? ` icon="${icon}"` : '';
          const hrefAttr = href ? ` href="${href}"` : '';
          return `  <Card title="${label.trim()}"${iconAttr}${hrefAttr}>\n    ${desc || ''}\n  </Card>`;
        }
      );
      return `<CardGroup>\n${cards}\n</CardGroup>`;
    }
  );

  return content;
}

function convertCTA(content) {
  // Empty CTA
  content = content.replace(/<CTA\s*\/>/g, () => {
    trackConversion('CTA.empty');
    return insertFlag('CTA', 'Empty CTA - needs Neon signup card or removal', '<CTA />');
  });

  // CTA with props (self-closing)
  content = content.replace(
    /<CTA\s+([\s\S]*?)\/>/g,
    (match, attrs) => {
      if (match.includes('MIGRATION_FLAG')) return match;
      trackConversion('CTA.props');
      const title = attrs.match(/title="([^"]*)"/)?.[1] || '';
      const desc = attrs.match(/description="([^"]*)"/)?.[1] || '';
      const btnText = attrs.match(/buttonText="([^"]*)"/)?.[1] || '';
      const btnUrl = attrs.match(/buttonUrl="([^"]*)"/)?.[1] || '';
      const command = attrs.match(/command="([^"]*)"/)?.[1] || '';

      if (command) {
        return `<Card title="${title}">\n${desc}\n\n\`\`\`bash\n${command}\n\`\`\`\n</Card>`;
      }
      if (btnUrl) {
        return `<Card title="${title}" href="${btnUrl}">\n${desc}\n</Card>`;
      }
      return `<Card title="${title}">\n${desc}\n</Card>`;
    }
  );

  // CTA with children (opening + closing tags)
  content = content.replace(
    /<CTA\s+([\s\S]*?)>([\s\S]*?)<\/CTA>/g,
    (match, attrs, children) => {
      if (match.includes('MIGRATION_FLAG')) return match;
      trackConversion('CTA.children');
      const title = attrs.match(/title="([^"]*)"/)?.[1] || '';
      const desc = attrs.match(/description="([^"]*)"/)?.[1] || '';
      return `<Card title="${title}">\n${desc || children.trim()}\n</Card>`;
    }
  );

  return content;
}

function convertCheckList(content) {
  // <CheckList title="..."><CheckItem title="..." href="...">desc</CheckItem></CheckList>
  content = content.replace(
    /<CheckList[^>]*>([\s\S]*?)<\/CheckList>/g,
    (match, children) => {
      trackConversion('CheckList');
      const items = [];
      children.replace(
        /<CheckItem\s+title="([^"]*)"(?:\s+href="([^"]*)")?\s*>([^<]*)<\/CheckItem>/g,
        (_, title, href, desc) => {
          const link = href ? ` [Learn more](${href})` : '';
          items.push(`- **${title}** — ${desc.trim()}${link}`);
        }
      );
      return items.join('\n');
    }
  );

  return content;
}

function convertDocsList(content) {
  content = content.replace(
    /<DocsList\s+title="([^"]*)"[^>]*>([\s\S]*?)<\/DocsList>/g,
    (match, title, children) => {
      trackConversion('DocsList');
      return `**${title}**\n\n${children.trim()}`;
    }
  );
  return content;
}

function convertSimpleUnwraps(content) {
  // Components that just wrap children — remove the wrapper, keep content
  const unwrapComponents = ['InfoBlock', 'DefinitionList', 'FeatureList', 'TestimonialsWrapper'];
  for (const comp of unwrapComponents) {
    const re = new RegExp(`<${comp}[^>]*>([\\s\\S]*?)<\\/${comp}>`, 'g');
    content = content.replace(re, (match, children) => {
      trackConversion(comp);
      return children.trim();
    });
  }
  return content;
}

function convertQuotes(content) {
  // <QuoteBlock> and <Testimonial>
  content = content.replace(
    /<(?:QuoteBlock|Testimonial)[^>]*>([\s\S]*?)<\/(?:QuoteBlock|Testimonial)>/g,
    (match, children) => {
      trackConversion('QuoteBlock');
      const lines = children.trim().split('\n').map(l => `> ${l}`).join('\n');
      return lines;
    }
  );
  return content;
}

function convertTechCards(content) {
  content = content.replace(
    /<TechCards[^>]*>([\s\S]*?)<\/TechCards>/g,
    (match, children) => {
      trackConversion('TechCards');
      const cards = children.replace(
        /<a\s+(?:[\s\S]*?)title="([^"]*)"(?:[\s\S]*?)(?:href="([^"]*)")?[^>]*>[^<]*<\/a>/g,
        (_, title, href) => {
          return href ? `  <Card title="${title}" href="${href}" />` : `  <Card title="${title}" />`;
        }
      );
      return `<CardGroup>\n${cards}\n</CardGroup>`;
    }
  );
  return content;
}

function convertCommunityBanner(content) {
  content = content.replace(
    /<CommunityBanner[^>]*>([\s\S]*?)<\/CommunityBanner>/g,
    (match, children) => {
      trackConversion('CommunityBanner');
      return `<Note>\n${children.trim()}\n</Note>`;
    }
  );
  return content;
}

function convertYoutube(content) {
  content = content.replace(
    /<YoutubeIframe\s+src="([^"]*)"[^>]*\/?>/g,
    (match, src) => {
      trackConversion('YoutubeIframe');
      return `<Frame>\n  <iframe src="${src}" width="100%" height="400" />\n</Frame>`;
    }
  );
  return content;
}

function convertLinkPreview(content) {
  content = content.replace(
    /<LinkPreview\s+url="([^"]*)"[^>]*\/?>/g,
    (match, url) => {
      trackConversion('LinkPreview');
      return `<Card title="Link" href="${url}">\n${url}\n</Card>`;
    }
  );
  return content;
}

// ─── Shared content → Mintlify snippets ─────────────────────────

const PARAMETERLESS_SHARED = new Set([
  'FeatureBeta', 'MCPTools', 'LinkAPIKey', 'LRNotice', 'ComingSoon',
  'PrivatePreview', 'PrivatePreviewEnquire', 'PublicPreview', 'LRBeta',
  'MigrationAssistant', 'NextSteps', 'NewPricing', 'EarlyAccess',
]);

function convertSharedContent(content) {
  // Parameterless: <ComponentName /> or <ComponentName/>
  for (const comp of PARAMETERLESS_SHARED) {
    const re = new RegExp(`<${comp}\\s*/>`, 'g');
    content = content.replace(re, () => {
      trackConversion(`SharedContent.${comp}`);
      const snippetName = comp.replace(/([A-Z])/g, (m, c, i) => i === 0 ? c.toLowerCase() : `-${c.toLowerCase()}`);
      return `<Snippet file="${snippetName}.mdx" />`;
    });
  }

  // NeedHelp - very common, convert to snippet
  content = content.replace(/<NeedHelp\s*\/?>/g, () => {
    trackConversion('NeedHelp');
    return `<Snippet file="need-help.mdx" />`;
  });

  return content;
}

// ─── Flag unconvertible components ──────────────────────────────

const FLAG_COMPONENTS = [
  'CopyPrompt', 'Video', 'ExternalCode', 'PromptCards',
  'ProgramForm', 'SqlToRestConverter', 'ComputeCalculator',
  'UserButton', 'NeonAuthUIProvider', 'AuthView',
  'RequestForm', 'LogosSection', 'UseCaseContext',
  'TwoColumnLayout', 'GetStarted', 'SdkOverview',
  'SdkStackApp', 'SdkUseStackApp', 'SdkUseUser',
  'SdkUser', 'SdkTeam', 'SdkTeamUser', 'SdkTeamProfile',
  'SdkProject', 'SdkTeamPermission', 'SdkApiKey', 'SdkContactChannel',
  'NeonRLSDeprecation',
];

const PARAMETERIZED_SHARED = ['FeatureBetaProps', 'AIRule', 'EarlyAccessProps'];

function flagUnconvertible(content) {
  for (const comp of FLAG_COMPONENTS) {
    // Self-closing
    const selfClose = new RegExp(`(<${comp}[^>]*/>)`, 'g');
    content = content.replace(selfClose, (match) => {
      stats.flagsInserted++;
      return `{/* MIGRATION_FLAG: ${comp} - No Mintlify equivalent */}\n${match}`;
    });

    // Opening + closing (but avoid double-flagging)
    const openClose = new RegExp(`(<${comp}(?:\\.[A-Za-z]+)?[^>]*>[\\s\\S]*?<\\/${comp}(?:\\.[A-Za-z]+)?>)`, 'g');
    content = content.replace(openClose, (match) => {
      if (match.includes('MIGRATION_FLAG')) return match;
      stats.flagsInserted++;
      return `{/* MIGRATION_FLAG: ${comp} - No Mintlify equivalent */}\n${match}`;
    });
  }

  // TwoColumnLayout.* variants
  const tclRe = /(<TwoColumnLayout\.[A-Za-z]+[\s\S]*?<\/TwoColumnLayout\.[A-Za-z]+>)/g;
  content = content.replace(tclRe, (match) => {
    if (match.includes('MIGRATION_FLAG')) return match;
    stats.flagsInserted++;
    return `{/* MIGRATION_FLAG: TwoColumnLayout - No Mintlify equivalent */}\n${match}`;
  });

  // Parameterized shared content
  for (const comp of PARAMETERIZED_SHARED) {
    const re = new RegExp(`(<${comp}[^>]*\\/?>)`, 'g');
    content = content.replace(re, (match) => {
      if (match.includes('MIGRATION_FLAG')) return match;
      stats.flagsInserted++;
      return `{/* MIGRATION_FLAG: ${comp} - Parameterized shared content, Mintlify snippets don't support props */}\n${match}`;
    });
  }

  return content;
}

// ─── Image path conversion ──────────────────────────────────────

function convertImagePaths(content) {
  // /docs/manage/settings_page.png → /images/docs/manage/settings_page.png
  content = content.replace(
    /(\!\[[^\]]*\]\()\/docs\//g,
    '$1/images/docs/'
  );
  // Also in HTML img tags
  content = content.replace(
    /src="\/docs\//g,
    'src="/images/docs/'
  );
  return content;
}

// ─── Main pipeline ──────────────────────────────────────────────

function processFile(content) {
  content = convertFrontmatter(content);
  content = convertAdmonitions(content);
  content = convertTabs(content);
  content = convertCodeTabs(content);
  content = convertDetailIconCards(content);
  content = convertCTA(content);
  content = convertCheckList(content);
  content = convertDocsList(content);
  content = convertSimpleUnwraps(content);
  content = convertQuotes(content);
  content = convertTechCards(content);
  content = convertCommunityBanner(content);
  content = convertYoutube(content);
  content = convertLinkPreview(content);
  content = convertSharedContent(content);
  content = flagUnconvertible(content);
  content = convertImagePaths(content);
  return content;
}

function walkDir(dir, baseDir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(baseDir, fullPath);

    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name) && !SKIP_PREFIXES.some(p => relPath.startsWith(p))) {
        walkDir(fullPath, baseDir);
      }
      continue;
    }

    if (shouldSkip(relPath)) {
      stats.filesSkipped++;
      continue;
    }

    try {
      const content = fs.readFileSync(fullPath, 'utf-8');
      const converted = processFile(content);

      const destRelPath = relPath.replace(/\.md$/, '.mdx');
      const destPath = path.join(DEST_DIR, destRelPath);

      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.writeFileSync(destPath, converted, 'utf-8');
      stats.filesProcessed++;
    } catch (err) {
      stats.errors.push({ file: relPath, error: err.message });
    }
  }
}

// ─── Run ────────────────────────────────────────────────────────

console.log(`Source: ${SRC_DIR}`);
console.log(`Dest:   ${DEST_DIR}`);
console.log('');

walkDir(SRC_DIR, SRC_DIR);

console.log('=== Migration complete ===');
console.log(`Files processed: ${stats.filesProcessed}`);
console.log(`Files skipped:   ${stats.filesSkipped}`);
console.log(`Flags inserted:  ${stats.flagsInserted}`);
console.log('');
console.log('Component conversions:');
for (const [name, count] of Object.entries(stats.componentConversions).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${name}: ${count}`);
}
if (stats.errors.length > 0) {
  console.log('');
  console.log('Errors:');
  for (const { file, error } of stats.errors) {
    console.log(`  ${file}: ${error}`);
  }
}
