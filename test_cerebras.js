const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf-8');
const key = env.split('\n').find(l => l.startsWith('CEREBRAS_API_KEY=')).split('=')[1];

fetch('https://api.cerebras.ai/v1/models', {
  headers: { 'Authorization': `Bearer ${key}` }
})
.then(r => r.json())
.then(d => console.log(d.data.map(m => m.id)))
.catch(console.error);
