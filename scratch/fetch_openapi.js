const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function run() {
  if (!url || !key) {
    console.error("Missing Supabase credentials!");
    process.exit(1);
  }

  const endpoint = `${url}/rest/v1/`;
  console.log(`Fetching OpenAPI spec from: ${endpoint}`);

  try {
    const res = await fetch(endpoint, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    });

    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    console.log("Paths exposed in the API:");
    const paths = Object.keys(data.paths);
    console.log(paths.filter(p => p.startsWith('/rpc/')));
  } catch (err) {
    console.error("Error fetching spec:", err.message);
  }
}

run();
