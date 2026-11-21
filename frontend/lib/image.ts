/* Shrinks a photo in the browser before it is uploaded: at most `max` pixels on the longest side, as a JPEG, which also
   drops hidden data such as the place a photo was taken. GIFs are sent as they are (they would stop moving), and anything
   the browser cannot read is sent unchanged for Connect to accept or refuse. */
export async function shrinkImage(file: File, max = 1280): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const g = c.getContext("2d");
    if (!g) { bmp.close?.(); return file; }
    g.fillStyle = "#fff"; // a see-through PNG would turn black as a JPEG
    g.fillRect(0, 0, w, h);
    g.drawImage(bmp, 0, 0, w, h);
    bmp.close?.();
    const blob = await new Promise<Blob | null>((done) => c.toBlob(done, "image/jpeg", 0.88));
    if (!blob) return file;
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "") || "photo"}.jpg`, { type: "image/jpeg" });
  } catch { return file; }
}
