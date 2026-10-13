/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_POMINSAC_SUPABASE_URL?: string;
  readonly VITE_POMINSAC_SUPABASE_ANON_KEY?: string;
  readonly VITE_POMINSAC_ATTACHMENT_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

