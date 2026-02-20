#!/usr/bin/env node

/**
 * Convert Neon navigation.yaml → Mintlify docs.json navigation
 */

const fs = require('fs');
const path = require('path');

// Simple YAML parser for this specific structure
// We'll use js-yaml if available, or a manual approach
let yaml;
try {
  yaml = require('js-yaml');
} catch {
  console.error('js-yaml not found. Installing...');
  require('child_process').execSync('npm install js-yaml', { cwd: __dirname });
  yaml = require('js-yaml');
}

const NAV_FILE = path.resolve(process.env.HOME, 'git/neon-website/content/docs/navigation.yaml');
const DOCS_JSON = path.resolve(__dirname, '..', 'docs.json');

const SKIP_SLUGS = new Set([
  'auth/legacy/overview',
  'auth/legacy/database-integration',
]);

function isExternalLink(slug) {
  return slug && (slug.startsWith('http://') || slug.startsWith('https://'));
}

function convertItem(item) {
  // External link
  if (item.slug && isExternalLink(item.slug)) {
    return { "title": item.title, "href": item.slug };
  }

  if (SKIP_SLUGS.has(item.slug)) return null;

  // Simple page (no children)
  if (item.slug && !item.items && !item.section) {
    return item.slug;
  }

  // Section header (group)
  if (item.section) {
    const group = { group: item.section, pages: [] };
    if (item.items) {
      for (const child of item.items) {
        const converted = convertItem(child);
        if (converted !== null) {
          if (Array.isArray(converted)) {
            group.pages.push(...converted);
          } else {
            group.pages.push(converted);
          }
        }
      }
    }
    return group;
  }

  // Page with children (becomes a group)
  if (item.title && item.items) {
    const group = { group: item.title, pages: [] };
    
    // If the item itself has a slug, include it as first page
    if (item.slug && !isExternalLink(item.slug) && !SKIP_SLUGS.has(item.slug)) {
      // Don't add if it duplicates a child
      const childSlugs = new Set();
      function collectSlugs(items) {
        for (const i of items) {
          if (i.slug) childSlugs.add(i.slug);
          if (i.items) collectSlugs(i.items);
        }
      }
      collectSlugs(item.items);
      if (!childSlugs.has(item.slug)) {
        group.pages.push(item.slug);
      }
    }

    for (const child of item.items) {
      const converted = convertItem(child);
      if (converted !== null) {
        if (Array.isArray(converted)) {
          group.pages.push(...converted);
        } else {
          group.pages.push(converted);
        }
      }
    }
    return group;
  }

  // Page with just a slug
  if (item.slug) {
    return item.slug;
  }

  return null;
}

function convertNav(navItem) {
  const tab = {
    tab: navItem.nav,
    groups: [],
  };

  // Handle subnav (creates multiple groups)
  if (navItem.subnav) {
    for (const sub of navItem.subnav) {
      if (sub.section) {
        // Section within subnav - contains sub-items
        if (sub.items) {
          for (const subItem of sub.items) {
            const converted = convertItem(subItem);
            if (converted && typeof converted === 'object' && converted.group) {
              tab.groups.push(converted);
            } else if (converted) {
              // Wrap in a group
              tab.groups.push({ group: sub.section, pages: [converted] });
            }
          }
        }
      } else if (sub.title && sub.items) {
        const group = { group: sub.title, pages: [] };
        
        for (const child of sub.items) {
          const converted = convertItem(child);
          if (converted !== null) {
            if (typeof converted === 'object' && converted.group) {
              // Nested group - flatten into current tab
              tab.groups.push(converted);
            } else if (Array.isArray(converted)) {
              group.pages.push(...converted);
            } else {
              group.pages.push(converted);
            }
          }
        }
        
        if (group.pages.length > 0) {
          tab.groups.push(group);
        }
      } else if (sub.slug) {
        // Simple link in subnav
        if (isExternalLink(sub.slug)) {
          tab.groups.push({ group: sub.title || 'Links', pages: [{ title: sub.title, href: sub.slug }] });
        } else {
          tab.groups.push({ group: sub.title || 'Overview', pages: [sub.slug] });
        }
      }
    }
  }

  // Handle direct items
  if (navItem.items) {
    for (const item of navItem.items) {
      const converted = convertItem(item);
      if (converted && typeof converted === 'object' && converted.group) {
        tab.groups.push(converted);
      } else if (converted) {
        const groupName = navItem.nav;
        let existingGroup = tab.groups.find(g => g.group === groupName);
        if (!existingGroup) {
          existingGroup = { group: groupName, pages: [] };
          tab.groups.push(existingGroup);
        }
        existingGroup.pages.push(converted);
      }
    }
  }

  return tab;
}

// Remove the Legacy (archive) section from auth
function removeLegacySection(tabs) {
  for (const tab of tabs) {
    if (tab.groups) {
      tab.groups = tab.groups.filter(g => {
        if (g.group === 'Legacy (archive)') return false;
        if (g.pages) {
          g.pages = g.pages.filter(p => {
            if (typeof p === 'string' && SKIP_SLUGS.has(p)) return false;
            if (typeof p === 'object' && p.group === 'Legacy (archive)') return false;
            if (typeof p === 'object' && p.group) {
              p.pages = p.pages?.filter(pp => {
                if (typeof pp === 'string' && SKIP_SLUGS.has(pp)) return false;
                return true;
              });
            }
            return true;
          });
        }
        return true;
      });
    }
  }
}

// ─── Main ──────────────────────────────────────

const navYaml = fs.readFileSync(NAV_FILE, 'utf-8');
const navData = yaml.loadAll(navYaml);

// yaml.loadAll returns each document; the file is a single document with multiple items
// Actually, it seems like a single document with a YAML sequence at root
const navItems = navData.flat();

const tabs = navItems.map(convertNav);

removeLegacySection(tabs);

// Read existing docs.json and merge
const docsJson = JSON.parse(fs.readFileSync(DOCS_JSON, 'utf-8'));

// Update navigation
docsJson.navigation = { tabs };

// Update branding for Neon
docsJson.name = "Neon Docs";
docsJson.colors = {
  primary: "#00E599",
  light: "#00E599",
  dark: "#00E599"
};

// Remove old starter content from anchors/topbar
delete docsJson.anchors;

fs.writeFileSync(DOCS_JSON, JSON.stringify(docsJson, null, 2) + '\n', 'utf-8');

console.log(`Navigation converted: ${tabs.length} tabs`);
for (const tab of tabs) {
  const pageCount = tab.groups.reduce((sum, g) => sum + (g.pages?.length || 0), 0);
  console.log(`  "${tab.tab}": ${tab.groups.length} groups, ~${pageCount} pages`);
}
