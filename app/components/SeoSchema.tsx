export default function SeoSchema() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://zaitxmedia.com/#organization",
        "name": "ZAITX MEDIA",
        "alternateName": ["الدولي استور", "هرم استور", "هرم لشحن تيك توك", "الدولي للشحن", "ZAITX Store"],
        "url": "https://zaitxmedia.com",
        "logo": "https://zaitxmedia.com/zaitx-logo.png",
        "sameAs": [],
        "description": "الموقع الأول والأرخص لشحن عملات تيك توك، شحن ألعاب، وخدمات السوشيال ميديا الموثوقة بأرخص الأسعار في مصر والسعودية والوطن العربي.",
        "contactPoint": {
          "@type": "ContactPoint",
          "contactType": "customer service",
          "availableLanguage": ["Arabic", "English"]
        }
      },
      {
        "@type": "WebSite",
        "@id": "https://zaitxmedia.com/#website",
        "url": "https://zaitxmedia.com",
        "name": "ZAITX MEDIA - شحن عملات تيك توك بأرخص الأسعار",
        "description": "شحن عملات تيك توك، شحن كوينز تيك توك، وشحن ألعاب بأعلى سرعة وأقل تكلفة.",
        "publisher": { "@id": "https://zaitxmedia.com/#organization" },
        "inLanguage": "ar"
      },
      {
        "@type": "Service",
        "name": "شحن عملات تيك توك بأرخص الأسعار",
        "serviceType": "TikTok Coins Top-up",
        "provider": { "@id": "https://zaitxmedia.com/#organization" },
        "areaServed": ["EG", "SA", "AE", "KW", "QA", "OM"],
        "description": "شحن كوينز وعملات تيك توك، شحن فوري بأسعار تنافسية عبر فودافون كاش، انستاباي، وبرق."
      }
    ]
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
