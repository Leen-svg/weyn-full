import test from "node:test";
import assert from "node:assert/strict";
import { extractInstagramPostUrl, instagramEmbedUrl } from "../lib/instagram-embed.mjs";

test("normalizes an Instagram carousel URL and removes tracking parameters", () => {
  assert.equal(
    extractInstagramPostUrl("https://www.instagram.com/p/DcgfbGDDBp9/?img_index=1"),
    "https://www.instagram.com/p/DcgfbGDDBp9/",
  );
});

test("extracts the permalink from copied Instagram embed code", () => {
  const code = '<blockquote data-instgrm-permalink="https://www.instagram.com/p/DcgfbGDDBp9/?utm_source=ig_embed&amp;utm_campaign=loading"></blockquote><script src="https://www.instagram.com/embed.js"></script>';
  assert.equal(extractInstagramPostUrl(code), "https://www.instagram.com/p/DcgfbGDDBp9/");
  assert.equal(instagramEmbedUrl(code), "https://www.instagram.com/p/DcgfbGDDBp9/embed/captioned/");
});

test("rejects arbitrary embed HTML and lookalike hosts", () => {
  assert.equal(extractInstagramPostUrl('<script>alert("x")</script>'), null);
  assert.equal(extractInstagramPostUrl("https://instagram.com.evil.test/p/DcgfbGDDBp9/"), null);
});
