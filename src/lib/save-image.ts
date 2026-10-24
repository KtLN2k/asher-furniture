/**
 * שמירת תמונה (הדמיה/צילום) אצל המשתמש.
 * בדפדפן: הורדה רגילה. באפליקציית אנדרואיד (Capacitor) ה-WebView לא מוריד קבצים,
 * ולכן הקובץ נכתב לתיקיית המטמון ונפתח גיליון השיתוף של אנדרואיד (שמירה לגלריה,
 * WhatsApp, Drive וכו׳). הפלאגינים נטענים דינמית רק במכשיר.
 */
async function isNative(): Promise<boolean> {
  if (process.env.NEXT_PUBLIC_STATIC_APP !== "1") return false;
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

async function toDataUrl(src: string | Blob): Promise<string> {
  const blob = typeof src === "string" ? (src.startsWith("data:") ? null : await (await fetch(src)).blob()) : src;
  if (!blob) return src as string;
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export async function saveImage(src: string | Blob, filename: string, title = filename): Promise<void> {
  if (await isNative()) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([import("@capacitor/filesystem"), import("@capacitor/share")]);
    const dataUrl = await toDataUrl(src);
    const { uri } = await Filesystem.writeFile({ path: filename, data: dataUrl.split(",")[1] ?? "", directory: Directory.Cache });
    await Share.share({ title, files: [uri] });
    return;
  }
  const a = document.createElement("a");
  a.href = typeof src === "string" ? src : URL.createObjectURL(src);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (typeof src !== "string") URL.revokeObjectURL(a.href);
}
