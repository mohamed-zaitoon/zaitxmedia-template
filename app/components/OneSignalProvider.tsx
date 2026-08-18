"use client";

import { useEffect } from "react";
import OneSignal from "react-onesignal";

export default function OneSignalProvider({ userId }: { userId?: string }) {
  useEffect(() => {
    const initOneSignal = async () => {
      try {
        const mainAppId =
          process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID
          || "0daf00e5-5441-4b6c-a22c-9c1b6223b9a7";
        const isAdminSubdomain =
          typeof window !== "undefined" &&
          window.location.hostname.includes("admin");
        const serviceWorkerPath = "/push/onesignal/OneSignalSDKWorker.js";
        const serviceWorkerScope = "/push/onesignal/";

        if (!(OneSignal as any).initialized) {
          const appId = mainAppId;

          if ("serviceWorker" in navigator) {
            await navigator.serviceWorker.register(serviceWorkerPath, {
              scope: serviceWorkerScope,
            });
            const registration = await navigator.serviceWorker.getRegistration(
              serviceWorkerScope,
            );
            if (!registration) {
              throw new Error("تعذر تسجيل Service Worker الخاص بالإشعارات");
            }
            await registration.update().catch(() => undefined);
          }

          await OneSignal.init({
            appId: appId,
            allowLocalhostAsSecureOrigin: true,
            serviceWorkerPath,
            serviceWorkerParam: { scope: serviceWorkerScope },
            promptOptions: {
              slidedown: {
                prompts: [
                  {
                    type: "push",
                    autoPrompt: true,
                    delay: { pageViews: 1, timeDelay: 3 },
                    text: {
                      actionMessage:
                        "نود إرسال إشعارات لك حول طلباتك وحالتها عبر الهاتف واللابتوب.",
                      acceptButton: "تفعيل الإشعارات",
                      cancelButton: "لاحقاً",
                    },
                  } as any,
                ],
              },
            },
          });
        }

        const externalId = isAdminSubdomain ? "zaitxmedia-admin" : userId;
        if (externalId) {
          await OneSignal.login(externalId);
        } else {
          await OneSignal.logout();
        }
      } catch (e: any) {
        console.error("OneSignal Init Error:", e);
        if (typeof window !== "undefined") {
          (window as any).oneSignalInitError = e.message || String(e);
        }
      }
    };

    initOneSignal();
  }, [userId]);

  return null;
}
