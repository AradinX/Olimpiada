// === Konfiguracja Supabase ===
// Wartosci skopiuj z dashboardu Supabase: Project Settings -> API.
// Szczegoly w pliku SUPABASE_SETUP.md.
//
// UWAGA: anon key jest publiczny, mozesz go bezpiecznie commitowac.
//        NIGDY nie wklejaj tu service_role key.

window.SUPABASE_CONFIG = {
  url: 'https://agcppabnkcytikwwybgl.supabase.co',       // np. 'https://abcdefgh.supabase.co'
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFnY3BwYWJua2N5dGlrd3d5YmdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2ODE0OTUsImV4cCI6MjA5NjI1NzQ5NX0.HT-qy-hVDJJcILsNAf2mFlM1-u6KK196SNbPP-WVn5k' // dlugi JWT zaczynajacy sie od 'eyJ...'
};
