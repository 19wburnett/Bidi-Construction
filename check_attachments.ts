
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; 

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkAttachments() {
  console.log('Checking bid_attachments table...');
  
  // 1. List all attachments
  const { data: attachments, error } = await supabase
    .from('bid_attachments')
    .select('*')
    .limit(10);

  if (error) {
    console.error('Error fetching attachments:', error);
  } else {
    console.log('Attachments found:', attachments?.length);
    if (attachments && attachments.length > 0) {
        console.log('Sample attachment:', attachments[0]);
    }
  }

  // 2. List all bids with attachments
  const { data: bids, error: bidsError } = await supabase
    .from('bids')
    .select('id, bid_attachments(*)')
    .not('bid_attachments', 'is', null)
    .limit(5);
    
   if (bidsError) {
       console.log('Error fetching bids with attachments relation:', bidsError);
   } else {
       console.log('Bids queried:', bids?.length);
       const bidsWithAttachments = bids?.filter(b => b.bid_attachments && b.bid_attachments.length > 0);
       console.log('Bids with attachments:', bidsWithAttachments?.length);
       if (bidsWithAttachments && bidsWithAttachments.length > 0) {
           console.log('Sample bid with attachment:', JSON.stringify(bidsWithAttachments[0], null, 2));
       }
   }
}

checkAttachments();





