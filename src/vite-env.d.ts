/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_S3_BUCKET: string
  readonly VITE_S3_REGION: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
