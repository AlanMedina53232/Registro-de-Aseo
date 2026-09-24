// Configuración y cliente global de Supabase
const SUPABASE_URL = "https://kcuwxtfjqrcnktoxgoke.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjdXd4dGZqcXJjbmt0b3hnb2tlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyMTQ3NDAsImV4cCI6MjEwNTc5MDc0MH0.576qXPUEb1EkNZ232Pm1DliqjutujrMHwoX4jCjbj88";

// Inicializar el cliente global de Supabase
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);