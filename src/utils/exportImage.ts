import { toPng, toJpeg } from "html-to-image";
import { ImageFormat } from "../types";

/**
 * Exports an element to PNG, JPEG, or JPG at 2x crisp retina resolution
 * matching exactly what the user sees on the screen.
 */
export async function exportPlotToImage(
  elementId: string,
  fileName: string,
  format: ImageFormat = "png",
  backgroundColor = "#FFFFFF"
): Promise<void> {
  const container = document.getElementById(elementId);
  if (!container) {
    throw new Error("Chart container element not found for export.");
  }

  // Filter out any buttons or UI controls marked with 'no-export'
  const filter = (node: HTMLElement) => {
    if (node.classList && (node.classList.contains("no-export") || node.tagName === "BUTTON")) {
      return false;
    }
    return true;
  };

  const options = {
    quality: 0.95,
    pixelRatio: 2,
    backgroundColor: backgroundColor || "#FFFFFF",
    filter: filter as any,
    cacheBust: true,
  };

  let dataUrl = "";
  if (format === "png") {
    dataUrl = await toPng(container, options);
  } else {
    dataUrl = await toJpeg(container, options);
  }

  const sanitizedTitle = fileName.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase() || "plot";
  const downloadLink = document.createElement("a");
  downloadLink.download = `${sanitizedTitle}.${format}`;
  downloadLink.href = dataUrl;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
}
