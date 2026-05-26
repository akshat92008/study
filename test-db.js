const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://example.com";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "key";
console.log("Just checking if the DB is local, but it's okay I will just edit the file.");
