import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function getSupabaseServerConfigStatus() {
  return {
    hasUrl: Boolean(supabaseUrl),
    urlSource: process.env.SUPABASE_URL ? "SUPABASE_URL" : process.env.NEXT_PUBLIC_SUPABASE_URL ? "NEXT_PUBLIC_SUPABASE_URL" : null,
    hasServiceRoleKey: Boolean(supabaseServiceRoleKey),
  };
}

export function logSupabaseServerConfigStatus(context = "Supabase") {
  const status = getSupabaseServerConfigStatus();
  console.error(`${context} configuration check failed`, {
    hasUrl: status.hasUrl,
    urlSource: status.urlSource,
    hasServiceRoleKey: status.hasServiceRoleKey,
    missing: [
      !status.hasUrl ? "SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL" : null,
      !status.hasServiceRoleKey ? "SUPABASE_SERVICE_ROLE_KEY" : null,
    ].filter(Boolean),
  });
}

export function getSupabaseServerClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    logSupabaseServerConfigStatus("Supabase server");
    throw new Error("Supabase server environment variables are not configured");
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
