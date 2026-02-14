
import PptxGenJS from "pptxgenjs";
import { SlideElement, ElementType, PPTX_HEIGHT_INCHES, PPTX_WIDTH_INCHES } from "../types";
import { CROP_PADDING } from "./imageProcessing";

export const generatePresentation = async (
  elements: SlideElement[], 
  originalImageBase64: string | null,
  imageWidth: number,
  imageHeight: number
) => {
  const pptx = new PptxGenJS();
  const slide = pptx.addSlide();

  // Sort by Z-Index (ascending) so background items render first
  const sortedElements = [...elements].sort((a, b) => a.z_order - b.z_order);

  // Scaling factors: how many inches per pixel
  const scaleX = PPTX_WIDTH_INCHES / imageWidth;
  const scaleY = PPTX_HEIGHT_INCHES / imageHeight;

  for (const el of sortedElements) {
    // 1. Calculate original pixel coordinates from normalized 0-1000
    const [ymin, xmin, ymax, xmax] = el.box_2d;
    const x1_px = (xmin / 1000) * imageWidth;
    const y1_px = (ymin / 1000) * imageHeight;
    const x2_px = (xmax / 1000) * imageWidth;
    const y2_px = (ymax / 1000) * imageHeight;

    const detW_px = x2_px - x1_px;
    const detH_px = y2_px - y1_px;

    if (el.type === ElementType.TEXT) {
      if (el.textContent) {
        slide.addText(el.textContent, {
          x: x1_px * scaleX, 
          y: y1_px * scaleY, 
          w: detW_px * scaleX, 
          h: detH_px * scaleY,
          color: el.textColor ? el.textColor.replace('#', '') : '000000',
          bold: el.isBold,
          fontSize: 12, 
          valign: 'top',
        });
      }
    } else {
      // Visual Elements (Shape, Icon, Image)
      const imgData = el.cleanedImageBase64 || el.originalCropBase64;
      
      if (imgData) {
        // Recalculate crop bounds in pixels exactly as done in imageProcessing.ts
        const cropX1 = Math.max(0, x1_px - CROP_PADDING);
        const cropY1 = Math.max(0, y1_px - CROP_PADDING);
        const cropX2 = Math.min(imageWidth, x2_px + CROP_PADDING);
        const cropY2 = Math.min(imageHeight, y2_px + CROP_PADDING);

        const cropW_px = cropX2 - cropX1;
        const cropH_px = cropY2 - cropY1;

        // Convert crop dimensions and position to inches
        const finalX = cropX1 * scaleX;
        const finalY = cropY1 * scaleY;
        const finalW = cropW_px * scaleX;
        const finalH = cropH_px * scaleY;

        slide.addImage({
          data: imgData,
          x: finalX,
          y: finalY,
          w: finalW,
          h: finalH,
          // Use cover/contain sizing carefully or no sizing if we trust our math
          sizing: { type: 'contain', w: finalW, h: finalH }
        });
      }
    }
  }

  await pptx.writeFile({ fileName: "Reconstructed-Slide.pptx" });
};
