import test from "node:test";
import assert from "node:assert/strict";
import { imageExtension } from "../lib/community-media.mjs";

test("image validation requires MIME and matching magic bytes", () => {
  assert.equal(imageExtension(Uint8Array.from([0xff, 0xd8, 0xff, 0x00]), "image/jpeg"), "jpg");
  assert.equal(imageExtension(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "image/png"), "png");
  assert.equal(imageExtension(Uint8Array.from([0xff, 0xd8, 0xff]), "image/png"), null);
  assert.equal(imageExtension(new Uint8Array(), "image/jpeg"), null);
});

