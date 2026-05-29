const fs = require('fs');
const lines = fs.readFileSync('index.html', 'utf8').split('\n');
lines.forEach((line, idx) => {
  if (line.includes('id="view-exam"') || line.includes("id='view-exam'")) {
    console.log(`FOUND EXAM VIEW AT LINE ${idx + 1}:`);
    for (let i = Math.max(0, idx - 10); i < Math.min(lines.length, idx + 40); i++) {
      console.log(`${i + 1}: ${lines[i]}`);
    }
  }
});
