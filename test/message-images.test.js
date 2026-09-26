import assert from "node:assert/strict";
import test from "node:test";
import { MAX_CHAT_IMAGE_BYTES, parseImageAttachment } from "../lib/message-images.js";

const onePixelPng = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z1YQAAAAASUVORK5CYII=";

test("accepts a valid raster chat image", () => {
  const image = parseImageAttachment({ type: "image/png", name: "receipt.png", data: onePixelPng });
  assert.equal(image.type, "image/png");
  assert.equal(image.name, "receipt.png");
  assert.ok(image.size > 0);
});

test("rejects unsupported or spoofed image formats", () => {
  assert.throws(
    () => parseImageAttachment({ type: "image/svg+xml", name: "unsafe.svg", data: onePixelPng }),
    (error) => error.code === "invalid_image_type",
  );
  assert.throws(
    () => parseImageAttachment({ type: "image/jpeg", name: "spoof.jpg", data: onePixelPng }),
    (error) => error.code === "invalid_image_signature",
  );
});

test("rejects images above the stored attachment limit", () => {
  const bytes = Buffer.alloc(MAX_CHAT_IMAGE_BYTES + 1);
  bytes.set(Buffer.from([0xff, 0xd8, 0xff]), 0);
  assert.throws(
    () => parseImageAttachment({ type: "image/jpeg", name: "large.jpg", data: bytes.toString("base64") }),
    (error) => error.code === "image_too_large",
  );
});
