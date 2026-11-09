-- Vigilancia de movimientos cada 5 minutos, desde Supabase (gratis y puntual).
--
-- Por qué: GitHub Actions casi no respeta el cron "*/5": en la práctica corre unas 5 veces al día, así que una
-- operación nueva puede tardar horas en avisarte. Vercel Hobby solo permite un cron diario. Supabase sí puede
-- llamar a la app cada 5 minutos con pg_cron + pg_net (ya tienes el proyecto).
--
-- Cómo usarlo: Supabase → SQL Editor → pega esto, cambia TU_CRON_SECRET por el valor de CRON_SECRET que tienes en
-- Vercel, y ejecuta. No hace falta tocar la app: la ruta ya existe y no avisa dos veces del mismo movimiento,
-- así que puede convivir con el workflow de GitHub.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'cold-vault-watch',
  '*/5 * * * *',
  $$
    select net.http_get(
      url := 'https://cold-vault-tracker.vercel.app/api/cron/watch-movements',
      headers := jsonb_build_object('Authorization', 'Bearer TU_CRON_SECRET'),
      timeout_milliseconds := 55000
    );
  $$
);

-- Comprobar que corre (espera unos minutos):
--   select status, start_time from cron.job_run_details order by start_time desc limit 10;
--   select status_code, created from net._http_response order by created desc limit 5;   -- debe verse 200
-- Detenerlo:
--   select cron.unschedule('cold-vault-watch');
