import { MetadataRoute } from "next";

const BASE = "https://zaitxmedia.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    "",
    "/tiktok",
    "/games",
    "/facebook",
    "/instagram",
    "/recharge",
    "/login",
    "/sign-up",
    "/account",
    "/orders",
    "/terms",
    "/privacy",
  ];

  return routes.map((route) => ({
    url: `${BASE}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" || route === "/tiktok" || route === "/games" ? "daily" : "weekly",
    priority: route === "" ? 1.0 : route === "/tiktok" || route === "/games" ? 0.9 : 0.8,
  }));
}
