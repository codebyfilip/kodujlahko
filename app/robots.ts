import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/app/profile", "/app/group/create"],
    },
    sitemap: "https://www.kodujlahko.sk/sitemap.xml",
  };
}
