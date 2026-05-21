const fs = require('fs');
const path = require('path');
const vm = require('vm');

try {
  const htmlPath = path.join(__dirname, '..', 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  
  const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!scriptMatch) {
    console.error('No <script> tag found in index.html');
    process.exit(1);
  }
  
  const jsCode = scriptMatch[1];
  console.log(`Found JS block of size ${jsCode.length} characters.`);
  
  // Attempt to compile the JS code in a script
  new vm.Script(jsCode);
  console.log('SUCCESS: JS Code compiled successfully with no syntax errors!');
} catch (err) {
  console.error('SYNTAX ERROR DETECTED:', err);
  process.exit(1);
}
