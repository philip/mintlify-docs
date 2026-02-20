const fs = require('fs');
const path = require('path');

const SRC = '/Users/philip.olson/git/neon-website/content/docs';
const DEST = path.resolve(__dirname, '..');

const components = ['NeonAuthUIProvider', 'AuthView', 'UserButton'];

const files = [
  'auth/guides/plugins/email-otp.mdx',
  'auth/guides/password-reset.mdx',
  'auth/quick-start/react-router-components.mdx',
  'auth/quick-start/nextjs.mdx',
  'auth/quick-start/tanstack-router.mdx',
  'auth/reference/ui-components.mdx',
];

for (const relFile of files) {
  const srcFile = path.join(SRC, relFile.replace('.mdx', '.md'));
  const destFile = path.join(DEST, relFile);
  
  if (!fs.existsSync(srcFile)) {
    console.log(`Source not found: ${srcFile}`);
    continue;
  }
  
  const srcLines = fs.readFileSync(srcFile, 'utf8').split('\n');
  let destContent = fs.readFileSync(destFile, 'utf8');
  let changed = false;
  
  for (const comp of components) {
    // Find lines in source that contain the component (with indentation)
    for (const srcLine of srcLines) {
      const trimmed = srcLine.trim();
      if (!trimmed.startsWith(`<${comp}`) && !trimmed.startsWith(`</${comp}`)) continue;
      
      const indent = srcLine.match(/^(\s*)/)[1];
      if (indent.length === 0) continue;
      
      // Check if the unindented version exists in dest
      if (destContent.includes('\n' + trimmed + '\n') || destContent.includes('\n' + trimmed + ';')) {
        // Only fix if the indented version is NOT already present
        if (!destContent.includes('\n' + indent + trimmed)) {
          destContent = destContent.replace('\n' + trimmed, '\n' + indent + trimmed);
          changed = true;
        }
      }
    }
  }
  
  if (changed) {
    fs.writeFileSync(destFile, destContent);
    console.log(`Fixed indentation in: ${relFile}`);
  }
}
