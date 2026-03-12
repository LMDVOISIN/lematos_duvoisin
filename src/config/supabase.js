// Legacy path kept for backward compatibility.
// Re-export the shared singleton client to avoid duplicate auth refresh loops.
export { supabase } from '../lib/supabase';
export { supabase as default } from '../lib/supabase';
