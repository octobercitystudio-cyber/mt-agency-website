import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: 'e:/VScode/موقع الشركة/.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function optimizeDBImages() {
  console.log("Fetching website_data...");
  const { data, error } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'website_data')
    .maybeSingle();

  if (error || !data) {
    console.error("Error fetching data:", error);
    return;
  }

  let websiteData;
  try {
    websiteData = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
  } catch (e) {
    console.error("Error parsing JSON:", e);
    return;
  }

  let changesMade = 0;

  // 1. Update Portfolio images
  if (websiteData.portfolio) {
    websiteData.portfolio.forEach(item => {
      if (item.imageUrl) {
        if (item.imageUrl.includes('unsplash.com') && !item.imageUrl.includes('fm=webp')) {
          item.imageUrl += '&fm=webp';
          changesMade++;
        }
        if (item.imageUrl === '/qpshoes.png') {
          item.imageUrl = '/qpshoes_mockup.webp';
          changesMade++;
        }
      }
    });
  }

  // 2. Update Studio images
  if (websiteData.studio) {
    Object.keys(websiteData.studio).forEach(category => {
      websiteData.studio[category].forEach(item => {
        if (item.url && item.url.includes('unsplash.com') && !item.url.includes('fm=webp')) {
          item.url += '&fm=webp';
          changesMade++;
        }
      });
    });
  }

  if (changesMade > 0) {
    console.log(`Made ${changesMade} image optimizations. Updating DB...`);
    const { error: updateError } = await supabase
      .from('app_config')
      .update({ value: JSON.stringify(websiteData) })
      .eq('key', 'website_data');

    if (updateError) {
      console.error("Failed to update DB. Note: Make sure RLS allows this or run it using a service key.", updateError);
    } else {
      console.log("Database updated successfully with optimized WebP URLs!");
    }
  } else {
    console.log("No images needed optimization. They might already be WebP.");
  }
}

optimizeDBImages();
