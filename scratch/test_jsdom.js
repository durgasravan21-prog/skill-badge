const fs = require('fs');
const path = require('path');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

console.log('--- Headless Browser JS Runtime Verification ---');

const htmlPath = path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

// Set up virtual console
const virtualConsole = new jsdom.VirtualConsole();
virtualConsole.on('log', (msg) => console.log('[LOG]', msg));
virtualConsole.on('error', (msg) => console.error('[ERROR]', msg));
virtualConsole.on('warn', (msg) => console.warn('[WARN]', msg));

try {
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    resources: 'usable',
    url: 'https://skill-badge-scanner.vercel.app/',
    virtualConsole
  });

  // Wait a bit to let DOMContentLoaded and initial setTimeout events run
  setTimeout(() => {
    console.log('Theme toggle display styles verification:');
    const sun = dom.window.document.querySelector('.sun-icon');
    const moon = dom.window.document.querySelector('.moon-icon');
    console.log('  Sun icon style display:', sun ? sun.style.display : 'NOT FOUND');
    console.log('  Moon icon style display:', moon ? moon.style.display : 'NOT FOUND');

    console.log('Testing landing button clicks...');
    const loginBtn = dom.window.document.getElementById('nav-login-btn');
    if (loginBtn) {
      console.log('  Found Log in button. Simulating click...');
      loginBtn.click();
      
      const authView = dom.window.document.getElementById('view-auth');
      console.log('  Is Auth view active after click?', authView ? authView.classList.contains('active') : 'NOT FOUND');
    } else {
      console.error('  Log in button NOT FOUND in DOM!');
    }

    process.exit(0);
  }, 2000);
} catch (err) {
  console.error('JSDOM startup failure:', err);
  process.exit(1);
}
