const SITE_URL = "https://www.goweyn.com";
const OG_IMAGE = {
  url: "/og.png",
  width: 800,
  height: 420,
  alt: "Weyn - three curated Abu Dhabi places and one quick group vote.",
};

export function pageMetadata({ title, description, path }) {
  return {
    title,
    description,
    alternates: { canonical: path },
    robots: { index: true, follow: true, "max-image-preview": "large" },
    openGraph: {
      type: "website",
      siteName: "Weyn",
      locale: "en_AE",
      url: new URL(path, SITE_URL).toString(),
      title: title + " · Weyn",
      description,
      images: [OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: title + " · Weyn",
      description,
      images: ["/og.png"],
    },
  };
}

export function privatePageMetadata({ title, description }) {
  return {
    title,
    description,
    robots: { index: false, follow: false, nocache: true },
  };
}

