
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

  const sortedElements = [...elements].sort((a, b) => a.z_order - b.z_order);

  const scaleX = PPTX_WIDTH_INCHES / imageWidth;
  const scaleY = PPTX_HEIGHT_INCHES / imageHeight;

  for (const el of sortedElements) {
    const [ymin, xmin, ymax, xmax] = el.box_2d;
    const x1_px = (xmin / 1000) * imageWidth;
    const y1_px = (ymin / 1000) * imageHeight;
    const x2_px = (xmax / 1000) * imageWidth;
    const y2_px = (ymax / 1000) * imageHeight;

    const detW_px = x2_px - x1_px;
    const detH_px = y2_px - y1_px;

    if (el.type === ElementType.TEXT) {
      if (el.textRuns && el.textRuns.length > 0) {
        // Map our TextRuns to PptxGenJS TextObjects
        const textObjects = el.textRuns.map(run => ({
            text: run.text,
            options: {
                color: run.color.replace('#', ''),
                bold: run.bold,
                italic: run.italic,
                // Sizing is now pre-calculated in geminiService.ts
                fontSize: run.size,
                fontFace: run.font
            }
        }));

        slide.addText(textObjects, {
          x: x1_px * scaleX, 
          y: y1_px * scaleY, 
          w: detW_px * scaleX, 
          h: detH_px * scaleY,
          valign: 'top',
        });
      }
    } else {
      const imgData = el.cleanedImageBase64 || el.originalCropBase64;
      
      if (imgData) {
        const cropX1 = Math.max(0, x1_px - CROP_PADDING);
        const cropY1 = Math.max(0, y1_px - CROP_PADDING);
        const cropX2 = Math.min(imageWidth, x2_px + CROP_PADDING);
        const cropY2 = Math.min(imageHeight, y2_px + CROP_PADDING);

        const cropW_px = cropX2 - cropX1;
        const cropH_px = cropY2 - cropY1;

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
          sizing: { type: 'contain', w: finalW, h: finalH }
        });
      }
    }
  }

  await pptx.writeFile({ fileName: "Reconstructed-Slide.pptx" });
};
