const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf-8');
const key = env.split('\n').find(l => l.startsWith('SAMBANOVA_API_KEY=')).split('=')[1];

fetch('https://api.sambanova.ai/v1/models', {
  headers: { 'Authorization': `Bearer ${key}` }
})
.then(r => r.json())
.then(d => {
  if (d.data) {
    console.log(d.data.map(m => m.id));
  } else {
    console.log(d);
  }
})
.catch(console.error);
