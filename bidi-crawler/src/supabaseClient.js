import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_KEY in environment variables");
}

export const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Check if a subcontractor already exists by email or website_url
 * @param {string} email - Email address to check
 * @param {string} websiteUrl - Website URL to check
 * @returns {Promise<boolean>} True if exists, false otherwise
 */
export async function subcontractorExists(email, websiteUrl) {
  try {
    // Build the OR query
    let query = supabase.from("subcontractors").select("id");
    
    const conditions = [];
    if (email) conditions.push(`email.eq.${email}`);
    if (websiteUrl) conditions.push(`website_url.eq.${websiteUrl}`);
    
    if (conditions.length === 0) return false;
    
    query = query.or(conditions.join(","));
    const { data, error } = await query;
    
    if (error) {
      console.error("Error checking subcontractor existence:", error);
      return false;
    }
    
    return data && data.length > 0;
  } catch (error) {
    console.error("Exception checking subcontractor existence:", error);
    return false;
  }
}

/**
 * Insert a new subcontractor into the database
 * @param {Object} subcontractorData - Subcontractor data to insert
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function insertSubcontractor(subcontractorData) {
  try {
    const { data, error } = await supabase
      .from("subcontractors")
      .insert(subcontractorData)
      .select();
    
    if (error) {
      console.error("Error inserting subcontractor:", error);
      return { success: false, error: error.message };
    }
    
    return { success: true, data };
  } catch (error) {
    console.error("Exception inserting subcontractor:", error);
    return { success: false, error: error.message };
  }
}

