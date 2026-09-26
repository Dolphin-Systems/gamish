(() => {
  "use strict";

  const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
  const MAX_SOURCE_BYTES = 12_000_000;
  const MAX_OUTPUT_BYTES = 1_000_000;

  const loadImage = (file) => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => resolve({ image, url });
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("This image could not be opened"));
    };
    image.src = url;
  });

  const canvasBlob = (canvas, quality) => new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("This image could not be prepared")), "image/jpeg", quality);
  });

  const blobBase64 = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(new Error("This image could not be read"));
    reader.readAsDataURL(blob);
  });

  const prepare = async (file) => {
    if (!file || !ACCEPTED_TYPES.has(file.type)) throw new Error("Choose a JPEG, PNG, or WebP image");
    if (file.size > MAX_SOURCE_BYTES) throw new Error("Choose an image smaller than 12 MB");
    const { image, url } = await loadImage(file);
    try {
      for (const maxEdge of [1600, 1280, 1024, 800]) {
        const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) throw new Error("This browser could not prepare the image");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        for (const quality of [0.84, 0.74, 0.64, 0.56]) {
          const blob = await canvasBlob(canvas, quality);
          if (blob.size <= MAX_OUTPUT_BYTES) {
            const data = await blobBase64(blob);
            return {
              data,
              type: "image/jpeg",
              name: `${String(file.name || "chat-image").replace(/\.[^.]+$/, "").slice(0, 70) || "chat-image"}.jpg`,
              previewUrl: `data:image/jpeg;base64,${data}`,
            };
          }
        }
      }
      throw new Error("This image is too detailed to fit. Choose a smaller image");
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const setupViewer = () => {
    const dialog = document.getElementById("chat-image-viewer");
    if (!dialog || dialog.dataset.ready) return;
    dialog.dataset.ready = "true";
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener("close", () => {
      const image = document.getElementById("chat-image-viewer-photo");
      if (image) image.removeAttribute("src");
    });
  };

  const openViewer = (attachment) => {
    const dialog = document.getElementById("chat-image-viewer");
    const image = document.getElementById("chat-image-viewer-photo");
    const title = document.getElementById("chat-image-viewer-title");
    if (!dialog || !image) return;
    image.src = attachment.url;
    image.alt = attachment.name || "Chat image";
    if (title) title.textContent = attachment.name || "Chat image";
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  };

  const createMessageImage = (attachment) => {
    const button = document.createElement("button");
    const image = document.createElement("img");
    button.type = "button";
    button.className = "chat-photo-button";
    button.setAttribute("aria-label", `Open ${attachment.name || "chat image"}`);
    image.className = "chat-photo";
    image.src = attachment.url;
    image.alt = attachment.name || "Chat image";
    image.loading = "lazy";
    button.append(image);
    button.addEventListener("click", () => openViewer(attachment));
    return button;
  };

  window.GamishChatImages = { prepare, setupViewer, createMessageImage };
})();
