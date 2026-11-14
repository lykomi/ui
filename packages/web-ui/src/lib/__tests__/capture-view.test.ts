import { afterEach, expect, it, vi } from "vitest";
import { captureView } from "../capture-view.ts";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function setup() {
  const stop = vi.fn();
  const getDisplayMedia = vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] });
  vi.stubGlobal("navigator", { mediaDevices: { getDisplayMedia } });
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.spyOn(HTMLVideoElement.prototype, "videoWidth", "get").mockReturnValue(1920);
  vi.spyOn(HTMLVideoElement.prototype, "videoHeight", "get").mockReturnValue(1080);
  return { stop, getDisplayMedia };
}

it("captures only after invocation, requests no audio, scales and releases every track", async () => {
  const { stop, getDisplayMedia } = setup();
  const drawImage = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage,
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) =>
    callback(new Blob(["image"], { type: "image/jpeg" })),
  );
  expect(getDisplayMedia).not.toHaveBeenCalled();
  const file = await captureView();
  expect(getDisplayMedia).toHaveBeenCalledWith({ video: true, audio: false });
  expect(file.type).toBe("image/jpeg");
  expect(drawImage).toHaveBeenCalledWith(expect.any(HTMLVideoElement), 0, 0, 1600, 900);
  expect(stop).toHaveBeenCalledOnce();
});

it("stops capture even when conversion fails", async () => {
  const { stop } = setup();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  await expect(captureView()).rejects.toThrow("Image capture is unavailable");
  expect(stop).toHaveBeenCalledOnce();
});

it("explains the attachment fallback when the browser cannot capture", async () => {
  vi.stubGlobal("navigator", {});
  await expect(captureView()).rejects.toThrow("Attach an image file instead");
});
