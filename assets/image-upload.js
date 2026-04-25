// Reads an image File chosen by the user, downscales it via canvas, and
// returns a JPEG data URL small enough to live happily in localStorage.
(function () {
  const MAX_DIM = 1100;
  const QUALITY = 0.85;

  const fileToDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = () => reject(new Error('read_failed'));
      fr.readAsDataURL(file);
    });

  const loadImage = (src) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('decode_failed'));
      img.src = src;
    });

  const resizeToJpeg = async (file) => {
    if (!file || !file.type || !file.type.startsWith('image/')) {
      throw new Error('not_an_image');
    }
    // SVGs come through as-is.
    if (file.type === 'image/svg+xml') return await fileToDataUrl(file);

    const dataUrl = await fileToDataUrl(file);
    const img = await loadImage(dataUrl);
    const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    // Paint a solid background so transparent PNGs don't go black on JPEG.
    ctx.fillStyle = '#0a0908';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', QUALITY);
  };

  window.ImageUpload = { resizeToJpeg };
})();
