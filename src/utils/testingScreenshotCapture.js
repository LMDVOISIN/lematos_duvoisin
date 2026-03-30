export const TESTING_SCREENSHOT_IGNORE_ATTR = 'data-testing-screenshot-ignore';

const MAX_CAPTURE_WIDTH = 1600;
const MAX_CAPTURE_HEIGHT = 2400;

const canvasToFile = (canvas, fileName) => new Promise((resolve, reject) => {
  canvas.toBlob((blob) => {
    if (!blob) {
      reject(new Error('Impossible de produire la capture automatique.'));
      return;
    }

    resolve(new File([blob], fileName, {
      type: 'image/jpeg',
      lastModified: Date.now()
    }));
  }, 'image/jpeg', 0.82);
});

const resizeCanvasForUpload = (canvas) => {
  const widthScale = MAX_CAPTURE_WIDTH / canvas.width;
  const heightScale = MAX_CAPTURE_HEIGHT / canvas.height;
  const scale = Math.min(1, widthScale, heightScale);

  if (scale >= 1) {
    return canvas;
  }

  const resizedCanvas = document.createElement('canvas');
  resizedCanvas.width = Math.round(canvas.width * scale);
  resizedCanvas.height = Math.round(canvas.height * scale);

  const context = resizedCanvas.getContext('2d');
  if (!context) {
    return canvas;
  }

  context.drawImage(canvas, 0, 0, resizedCanvas.width, resizedCanvas.height);
  return resizedCanvas;
};

export const captureCurrentTestingScreenFile = async ({
  fileNamePrefix = 'test-context'
} = {}) => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('Capture indisponible hors navigateur.');
  }

  const captureRoot = document.getElementById('root') || document.body;
  if (!captureRoot) {
    throw new Error('Zone de capture indisponible.');
  }

  const { default: html2canvas } = await import('html2canvas');

  const canvas = await html2canvas(captureRoot, {
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false,
    scale: 1,
    ignoreElements: (element) => {
      if (!element?.getAttribute) return false;
      return element.getAttribute(TESTING_SCREENSHOT_IGNORE_ATTR) === 'true'
        || Boolean(element.closest?.(`[${TESTING_SCREENSHOT_IGNORE_ATTR}="true"]`));
    }
  });

  const uploadCanvas = resizeCanvasForUpload(canvas);
  return canvasToFile(uploadCanvas, `${fileNamePrefix}-${Date.now()}.jpg`);
};
