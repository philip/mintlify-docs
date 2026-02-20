const fs = require('fs');
const path = require('path');

const docsPath = path.join(__dirname, '..', 'docs.json');
const docs = JSON.parse(fs.readFileSync(docsPath, 'utf-8'));

const MIN_GROUPS_FOR_MENU = 4;

const icons = {
  'Why Neon?': 'circle-info',
  'Start with Neon': 'rocket',
  'Migrate to Neon': 'arrow-right-to-bracket',
  'Architecture': 'building',
  'Autoscaling': 'arrows-up-down',
  'Scale to zero': 'power-off',
  'Branching': 'code-branch',
  'Read replicas': 'clone',
  'Logical replication': 'arrows-rotate',
  'Data recovery': 'clock-rotate-left',
  'Data protection': 'shield-halved',
  'High availability': 'server',
  'Connect to Neon': 'plug',
  'Clients & tools': 'wrench',
  'Troubleshooting': 'bug',
  'Frameworks': 'layer-group',
  'Languages': 'code',
  'ORMs': 'database',
  'Data API': 'globe',
  'Neon Auth': 'lock',
  'Postgres RLS': 'user-shield',
  'AI for Agents': 'robot',
  'AI App Starter Kit': 'wand-magic-sparkles',
  'API, CLI & SDKs': 'terminal',
  'Local development': 'laptop-code',
  'Integrations (3rd party)': 'puzzle-piece',
  'Workflows & CI/CD': 'gears',
  'Tools & Workflows': 'toolbox',
  'Access & collaboration': 'users',
  'Projects & resources': 'folder-open',
  'Monitoring & observability': 'chart-line',
  'Operations & maintenance': 'screwdriver-wrench',
  'Plans and billing': 'credit-card',
  'Neon on Azure': 'cloud',
  'Security & compliance': 'lock',
  'Extensions': 'puzzle-piece',
  'Data types': 'table',
  'Functions': 'function',
  'Postgres guides': 'book',
  'Compatibility': 'check-double',
  'Version support': 'code-branch',
  'Upgrade': 'arrow-up',
  'PostgreSQL Tutorial': 'graduation-cap',
};

let converted = 0;

docs.navigation.tabs = docs.navigation.tabs.map(tab => {
  if (!tab.groups || tab.groups.length < MIN_GROUPS_FOR_MENU) {
    return tab;
  }

  const menu = tab.groups.map(group => {
    const item = {
      item: group.group,
    };

    if (icons[group.group]) {
      item.icon = icons[group.group];
    }

    const directPages = (group.pages || []).filter(p => typeof p === 'string');
    const subgroups = (group.pages || []).filter(p => typeof p === 'object' && p.group);

    if (subgroups.length > 0) {
      const groups = [];
      if (directPages.length > 0) {
        groups.push({
          group: group.group,
          pages: directPages,
        });
      }
      subgroups.forEach(sg => {
        groups.push(sg);
      });
      item.groups = groups;
    } else {
      item.pages = directPages;
    }

    return item;
  });

  converted++;
  console.log(`Converted tab "${tab.tab}" (${tab.groups.length} groups → ${menu.length} menu items)`);

  const result = { tab: tab.tab };
  if (tab.icon) result.icon = tab.icon;
  result.menu = menu;
  return result;
});

fs.writeFileSync(docsPath, JSON.stringify(docs, null, 2) + '\n');
console.log(`\nDone. Converted ${converted} tabs to use menus.`);
