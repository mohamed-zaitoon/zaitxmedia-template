import { MetadataRoute } from "next";
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/api/", "/v3/", "/auth/", "/_next/"],
    },
    sitemap: "https://zaitxmedia.com/sitemap.xml",
  };
}
