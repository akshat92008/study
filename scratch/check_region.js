const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function run() {
  const endpoint = `${url}/rest/v1/`;
  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    });
    console.log("Headers:");
    for (const [name, value] of res.headers) {
      console.log(`${name}: ${value}`);
    }
  } catch (err) {
    console.error("Error:", err.message);
  }
}

run();
