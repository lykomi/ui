/** One user-initiated frame; media tracks never outlive the capture. */
export async function captureView(): Promise<File> {
  if (!navigator.mediaDevices?.getDisplayMedia)
    throw new Error("Screen capture is unavailable in this browser. Attach an image file instead.");
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
  const video = document.createElement("video");
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    video.muted = true;
    video.srcObject = stream;
    await Promise.race([
      (async () => {
        await video.play();
        if (video.requestVideoFrameCallback)
          await new Promise<void>((resolve) => video.requestVideoFrameCallback(() => resolve()));
      })(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("The selected view did not produce an image.")),
          10_000,
        );
      }),
    ]);
    if (!video.videoWidth || !video.videoHeight) throw new Error("No image was captured.");
    const scale = Math.min(1, 1600 / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image capture is unavailable.");
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85),
    );
    if (!blob || blob.size > 2 * 1024 * 1024) throw new Error("The captured image exceeds 2 MB.");
    return new File([blob], `view-${new Date().toISOString().replace(/[:.]/g, "-")}.jpg`, {
      type: "image/jpeg",
    });
  } finally {
    clearTimeout(timeout);
    stream.getTracks().forEach((track) => track.stop());
    video.pause();
    video.srcObject = null;
  }
}
