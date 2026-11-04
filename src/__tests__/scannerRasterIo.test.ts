import { afterEach, afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  captureFrame,
  decodeToRaster,
  encodeJpeg,
  encodePng,
  makeThumbnail,
  rasterToDataUrl,
  ScannerDomError,
} from "../lib/scanner/rasterIO";
import type { Raster } from "../lib/scanner/types";

/** A solid `width × height` RGBA raster. */
function testRaster(width: number, height: number, fill = 200): Raster {
  return { width, height, data: new Uint8ClampedArray(width * height * 4).fill(fill) };
}

interface CanvasCall {
  kind: "toBlob" | "toDataURL";
  type: string | undefined;
  quality: number | undefined;
  width: number;
  height: number;
}

interface PutCall {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

/**
 * Replace the canvas surface with a recording fake.
 *
 * The environment actually ships a working `canvas` package, so tests drive
 * the plumbing (dimensions, pixel hand-off, encoder arguments) explicitly
 * instead of depending on which native path happens to resolve.
 */
function installFakeCanvas(): { calls: CanvasCall[]; puts: PutCall[]; restore: () => void } {
  const proto = HTMLCanvasElement.prototype as {
    getContext: HTMLCanvasElement["getContext"];
    toBlob?: HTMLCanvasElement["toBlob"];
    toDataURL: HTMLCanvasElement["toDataURL"];
  };
  const original = { getContext: proto.getContext, toBlob: proto.toBlob, toDataURL: proto.toDataURL };
  const calls: CanvasCall[] = [];
  const puts: PutCall[] = [];
  const stored = new WeakMap<HTMLCanvasElement, PutCall>();

  const state = (canvas: HTMLCanvasElement): PutCall => {
    let s = stored.get(canvas);
    if (!s) {
      s = { width: canvas.width, height: canvas.height, data: new Uint8ClampedArray(canvas.width * canvas.height * 4) };
      stored.set(canvas, s);
    }
    return s;
  };

  proto.getContext = function getContext(this: HTMLCanvasElement) {
    const canvas = this;
    const ctx = {
      canvas,
      createImageData: (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
      putImageData: (img: PutCall) => {
        puts.push({ width: img.width, height: img.height, data: img.data });
        stored.set(canvas, { width: img.width, height: img.height, data: img.data });
      },
      getImageData: (_x: number, _y: number, w: number, h: number) => {
        const s = state(canvas);
        return { width: w, height: h, data: s.data.slice(0, w * h * 4) };
      },
      drawImage: () => state(canvas).data.fill(128), // decode/capture paint "known" pixels
    };
    return ctx as unknown as CanvasRenderingContext2D;
  } as unknown as HTMLCanvasElement["getContext"];

  proto.toBlob = function toBlob(this: HTMLCanvasElement, callback: BlobCallback, type?: string, quality?: number) {
    calls.push({ kind: "toBlob", type, quality, width: this.width, height: this.height });
    callback(new Blob([new Uint8Array([137, 80, 78, 71])], { type: type ?? "application/octet-stream" }));
  };
  proto.toDataURL = function toDataURL(this: HTMLCanvasElement, type?: string, quality?: number) {
    calls.push({ kind: "toDataURL", type, quality, width: this.width, height: this.height });
    return `data:${type ?? "image/png"};base64,AA==`;
  };

  return {
    calls,
    puts,
    restore() {
      proto.getContext = original.getContext;
      proto.toDataURL = original.toDataURL;
      if (original.toBlob) proto.toBlob = original.toBlob;
      else delete proto.toBlob;
    },
  };
}

/**
 * Swap in a fake `URL` with working (or rejecting) object-URL methods.
 *
 * `vi.stubGlobal` rather than patching the real class: the environment's
 * `URL` may carry its own `createObjectURL`, and deleting/restoring it by
 * hand is exactly the kind of test bleed that shows up three suites later.
 */
function stubObjectUrl(mode: "ok" | "fail"): { created: string[]; revoked: string[] } {
  const created: string[] = [];
  const revoked: string[] = [];
  class StubURL {
    static createObjectURL(_blob: Blob): string {
      if (mode === "fail") throw new TypeError('The "obj" argument must be an instance of Blob');
      created.push("blob:fake");
      return "blob:fake";
    }
    static revokeObjectURL(handle: string): void {
      revoked.push(handle);
    }
  }
  vi.stubGlobal("URL", StubURL);
  return { created, revoked };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("scanner rasterIO: guards", () => {
  it("fails typed when the 2D context is missing", () => {
    const proto = HTMLCanvasElement.prototype as { getContext?: HTMLCanvasElement["getContext"] };
    const original = proto.getContext;
    proto.getContext = (() => null) as HTMLCanvasElement["getContext"];
    try {
      expect(() => encodePng(testRaster(2, 2))).toThrow(ScannerDomError);
      expect(() => encodePng(testRaster(2, 2))).toThrow(/canvas 2d context/);
    } finally {
      proto.getContext = original;
    }
  });

  it("fails typed outside a browser (no document)", () => {
    const video = document.createElement("video");
    Object.defineProperty(video, "videoWidth", { value: 640 });
    Object.defineProperty(video, "videoHeight", { value: 480 });
    vi.stubGlobal("document", undefined);
    expect(() => rasterToDataUrl(testRaster(2, 2))).toThrow(/no document/);
    expect(() => captureFrame(video)).toThrow(/no document/);
  });

  it("rejects rasters whose buffer does not match their size", () => {
    expect(() => encodePng({ width: 2, height: 2, data: new Uint8ClampedArray(3) })).toThrow(/expected 16/);
    expect(() => rasterToDataUrl({ width: 0, height: 5, data: new Uint8ClampedArray(0) })).toThrow(/raster is/);
  });

  it("throws before touching canvas when a camera frame has no dimensions", () => {
    const video = document.createElement("video");
    expect(() => captureFrame(video)).toThrow(/no dimensions yet/);
  });
});

describe("scanner rasterIO: canvas plumbing", () => {
  let fake: ReturnType<typeof installFakeCanvas>;

  beforeAll(() => {
    fake = installFakeCanvas();
  });
  afterAll(() => {
    fake.restore();
  });

  it("encodes PNG with the raster's exact pixels and dimensions", async () => {
    const blob = await encodePng(testRaster(4, 3, 200));
    expect(blob.type).toBe("image/png");
    expect(fake.calls.at(-1)).toMatchObject({ kind: "toBlob", type: "image/png", width: 4, height: 3 });

    const put = fake.puts.at(-1);
    expect(put).toMatchObject({ width: 4, height: 3 });
    expect(put?.data).toHaveLength(48);
    expect(put?.data[0]).toBe(200);
  });

  it("passes JPEG quality through to the encoder", async () => {
    await encodeJpeg(testRaster(8, 8), 0.6);
    expect(fake.calls.at(-1)).toMatchObject({ kind: "toBlob", type: "image/jpeg", quality: 0.6, width: 8 });
  });

  it("builds synchronous data URLs for jspdf", () => {
    const url = rasterToDataUrl(testRaster(4, 2), "image/jpeg", 0.9);
    expect(url).toBe("data:image/jpeg;base64,AA==");
    expect(fake.calls.at(-1)).toMatchObject({
      kind: "toDataURL",
      type: "image/jpeg",
      quality: 0.9,
      width: 4,
      height: 2,
    });
  });

  it("caps thumbnails on the long edge and encodes them as small JPEGs", async () => {
    const blob = await makeThumbnail(testRaster(1000, 500));
    expect(blob.type).toBe("image/jpeg");
    expect(fake.calls.at(-1)).toMatchObject({ type: "image/jpeg", quality: 0.72, width: 320, height: 160 });
  });

  it("leaves already-small rasters alone for thumbnails", async () => {
    await makeThumbnail(testRaster(200, 100));
    expect(fake.calls.at(-1)).toMatchObject({ width: 200, height: 100 });
  });

  it("decodes through createImageBitmap when available", async () => {
    const close = vi.fn();
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ width: 6, height: 4, close })),
    );

    const raster = await decodeToRaster(new Blob([new Uint8Array([1, 2, 3])]));
    expect(raster).toMatchObject({ width: 6, height: 4 });
    expect(raster.data).toHaveLength(6 * 4 * 4);
    expect(raster.data[0]).toBe(128); // pixels painted by the fake drawImage
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("falls back to <img> + object URL when createImageBitmap is missing", async () => {
    vi.stubGlobal("createImageBitmap", undefined);
    vi.stubGlobal(
      "Image",
      class {
        naturalWidth = 8;
        naturalHeight = 5;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        set src(_value: string) {
          queueMicrotask(() => this.onload?.());
        }
      },
    );
    const { created, revoked } = stubObjectUrl("ok");

    const raster = await decodeToRaster(new Blob());
    expect(raster).toMatchObject({ width: 8, height: 5 });
    expect(raster.data).toHaveLength(8 * 5 * 4);
    expect(created).toEqual(["blob:fake"]);
    expect(revoked).toEqual(["blob:fake"]); // object URL never leaks
  });

  it("reports a decode failure instead of returning an empty raster", async () => {
    vi.stubGlobal("createImageBitmap", undefined);
    vi.stubGlobal(
      "Image",
      class {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        set src(_value: string) {
          queueMicrotask(() => this.onerror?.());
        }
      },
    );
    const { revoked } = stubObjectUrl("ok");

    await expect(decodeToRaster(new Blob())).rejects.toThrow(/image failed to load/);
    await expect(decodeToRaster(new Blob())).rejects.toBeInstanceOf(ScannerDomError);
    expect(revoked).toEqual(["blob:fake", "blob:fake"]); // URL released on failure too
  });

  it("fails typed when neither decode path exists", async () => {
    vi.stubGlobal("createImageBitmap", undefined);
    vi.stubGlobal("URL", class {}); // no createObjectURL at all
    await expect(decodeToRaster(new Blob())).rejects.toBeInstanceOf(ScannerDomError);
    await expect(decodeToRaster(new Blob())).rejects.toThrow(/both missing/);
  });

  it("fails typed when createObjectURL itself throws", async () => {
    vi.stubGlobal("createImageBitmap", undefined);
    stubObjectUrl("fail"); // e.g. Node's URL rejecting jsdom's Blob realm
    await expect(decodeToRaster(new Blob())).rejects.toBeInstanceOf(ScannerDomError);
    await expect(decodeToRaster(new Blob())).rejects.toThrow(/instance of Blob/);
  });

  it("captures a live camera frame at the video's dimensions", () => {
    const video = document.createElement("video");
    Object.defineProperty(video, "videoWidth", { value: 640 });
    Object.defineProperty(video, "videoHeight", { value: 480 });

    const raster = captureFrame(video);
    expect(raster).toMatchObject({ width: 640, height: 480 });
    expect(raster.data).toHaveLength(640 * 480 * 4);
    expect(raster.data[0]).toBe(128);
  });
});
