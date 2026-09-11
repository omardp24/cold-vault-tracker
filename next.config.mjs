/** @type {import('next').NextConfig} */
const nextConfig = {
  // Las rutas que generan el PDF del estado de cuenta (statement/pdf y el cron diario, que
  // también lo genera para el reporte mensual) leen las fuentes .ttf del disco con fs.readFileSync
  // — sin esto, el file tracing de Vercel no las incluiría en el bundle de la función serverless
  // y el PDF fallaría en producción (aunque funcione en local, donde sí están en disco).
  //
  // pdfkit (la librería que usa @react-pdf/renderer por dentro) tiene el mismo problema con sus
  // propias fuentes estándar (Helvetica, etc.): las carga con un require() dinámico
  // (via el campo "imports" del package.json de pdfkit) que el tracer automático de Vercel no
  // logra seguir, y @react-pdf/font las necesita SIEMPRE al arrancar (carga Helvetica de entrada
  // aunque el documento use fuentes propias) — así que sin esto el PDF falla en producción con
  // "Cannot find module .../pdfkit/js/standard-fonts/Helvetica.cjs" aunque funcione en local.
  //
  // Ojo con la forma de la clave: tiene que ser un patrón glob (con **), no la ruta exacta de la
  // route — con la ruta literal ("/api/statement/pdf/route") Next simplemente no matchea nada
  // dentro de node_modules (se confirmó probando ambas formas contra el build real).
  experimental: {
    outputFileTracingIncludes: {
      "/api/statement/**": ["./src/lib/fonts/**", "./node_modules/pdfkit/js/standard-fonts/**"],
      "/api/cron/**": ["./src/lib/fonts/**", "./node_modules/pdfkit/js/standard-fonts/**"],
    },
  },
};
export default nextConfig;
