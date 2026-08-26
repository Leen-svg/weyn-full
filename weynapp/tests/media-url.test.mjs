import test from "node:test";
import assert from "node:assert/strict";
import { normalizeHttpUrl, parseUrlList, videoPresentation } from "../lib/media-url.mjs";

test("media URLs must be absolute http(s) URLs without credentials", () => {
  assert.equal(normalizeHttpUrl("javascript:alert(1)"), null);
  assert.equal(normalizeHttpUrl("/relative/image.jpg"), null);
  assert.equal(normalizeHttpUrl("https://user:pass@example.com/a.jpg"), null);
  assert.equal(normalizeHttpUrl(" https://cdn.example.com/a.jpg "), "https://cdn.example.com/a.jpg");
});

test("URL lists remove invalid and duplicate lines", () => {
  assert.deepEqual(parseUrlList("https://a.example/1.jpg\nnope\nhttps://a.example/1.jpg\nhttps://a.example/2.jpg"), [
    "https://a.example/1.jpg",
    "https://a.example/2.jpg",
  ]);
});

test("video links map to playable in-app presentations", () => {
  assert.deepEqual(videoPresentation("https://youtu.be/dQw4w9WgXcQ")?.provider, "YouTube");
  assert.equal(videoPresentation("https://vimeo.com/123456")?.src, "https://player.vimeo.com/video/123456");
  assert.equal(videoPresentation("https://www.tiktok.com/@weyn/video/7412345678901234567")?.provider, "TikTok");
  assert.equal(videoPresentation("https://www.instagram.com/reel/ABC_123/")?.provider, "Instagram");
  assert.equal(videoPresentation("https://cdn.example.com/clip.mp4?x=1")?.kind, "direct");
  assert.equal(videoPresentation("https://video.example.com/watch/abc")?.kind, "embed");
});
