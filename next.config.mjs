/** @type {import('next').NextConfig} */
const nextConfig = {
  // Las rutas que generan el PDF del estado de cuenta (statement/pdf y el cron diario, que
  // también lo genera para el reporte mensual) leen las fuentes .ttf del disco con fs.readFileSync
  // — sin esto, el file tracing de Vercel no las incluiría en el bundle de la función serverless
  // y el PDF fallaría en producción (aunque funcione en local, donde sí están en disco).
  experimental: {
    outputFileTracingIncludes: {
      "/api/statement/pdf/route": ["./src/lib/fonts/**"],
      "/api/cron/daily-sync/route": ["./src/lib/fonts/**"],
    },
  },
};
export default nextConfig;
