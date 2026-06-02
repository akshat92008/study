const fs = require('fs');
const code = fs.readFileSync('app/api/ai/chat/route.ts', 'utf8');
const lines = code.split('\n');

let stack = [];
let balance = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Very simplistic parsing
  let inString = false;
  let inStringChar = '';
  
  for (let j = 0; j < line.length; j++) {
    const char = line[j];
    
    if (inString) {
      if (char === '\\') {
         j++; // skip next char
         continue;
      }
      if (char === inStringChar) {
        inString = false;
      }
      continue;
    }
    
    if (char === "'" || char === '"' || char === '`') {
      inString = true;
      inStringChar = char;
      continue;
    }
    
    if (char === '/' && line[j+1] === '/') {
      break; // ignore comment
    }
    
    if (char === '{') {
      stack.push(i + 1);
      balance++;
    } else if (char === '}') {
      const openedAt = stack.pop();
      balance--;
      if (balance < 0) {
        console.log(`EXTRA } found at line ${i + 1}: ${line}`);
        balance = 0;
      }
    }
  }
}

console.log("Remaining unclosed { at lines:", stack);
