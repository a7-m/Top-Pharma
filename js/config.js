// ===== BACKEND CONFIGURATION =====
const BACKEND_URL = "backend-production-de98.up.railway.app";

// ===== SUPABASE PUBLIC CONFIGURATION =====
// These keys are safe for frontend use - they only allow authentication
// All database operations are protected by RLS (Row Level Security) policies
const SUPABASE_URL = "https://fwuszbtvlokkvjaylnaw.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ3dXN6YnR2bG9ra3ZqYXlsbmF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3Mjc0OTksImV4cCI6MjA4NDMwMzQ5OX0.l-cbEC7BFTA1mVd-LivPXC4UIbK-W-2azxbPnsKsihE";

// ===== UI CONFIGURATION =====
const MAX_UPLOAD_SIZE_MB = 100;
const ALLOWED_VIDEO_FORMATS = ['mp4', 'webm', 'ogg', 'mov', 'avi'];
const ALLOWED_FILE_FORMATS = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'];
const ALLOWED_IMAGE_FORMATS = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
