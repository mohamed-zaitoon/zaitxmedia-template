export async function sendOneSignalPush(
  userId: string,
  title: string,
  body: string,
  options?: { url?: string; data?: Record<string, unknown> },
) {
  const appId = process.env.ONESIGNAL_APP_ID
    || process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;
  if (!appId || !apiKey) {
    throw new Error("OneSignal server credentials are not configured");
  }

  const externalId = userId === "admin" ? "zaitxmedia-admin" : userId;
  const response = await fetch("https://api.onesignal.com/notifications", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Key ${apiKey}`,
    },
    body: JSON.stringify({
      app_id: appId,
      include_aliases: { external_id: [externalId] },
      target_channel: "push",
      headings: { en: title, ar: title },
      contents: { en: body, ar: body },
      ...(options?.url ? { url: options.url } : {}),
      ...(options?.data ? { data: options.data } : {}),
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.errors) {
    console.error("[OneSignal] Push rejected", {
      status: response.status,
      errors: result.errors || result,
    });
    throw new Error(`OneSignal rejected push (${response.status})`);
  }
  return result;
}
