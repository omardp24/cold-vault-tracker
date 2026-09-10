// Service worker mínimo, solo para notificaciones push — no cachea nada ni convierte
// esto en una PWA completa.
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Cold Vault", body: event.data.text() };
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || "Cold Vault", {
      body: payload.body || "",
      data: payload.data || {},
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow("/"));
});
