import { useEffect, useRef, useState } from "react";
import SignaturePadLib from "signature_pad";
import { Eraser, ImageUp, PenLine, Undo2 } from "lucide-react";

interface SignaturePadProps {
  // PNG data URL of the signature, or null when there isn't one yet.
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  disabled?: boolean;
}

type Mode = "draw" | "upload";

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
// Uploaded signatures are scaled down to fit this box.
const MAX_WIDTH = 600;
const MAX_HEIGHT = 200;

// Crops a canvas to the area that has ink, with a little padding, so the
// signature sits neatly in its space on the document.
function trimmedDataUrl(source: HTMLCanvasElement): string | null {
  const context = source.getContext("2d");

  if (!context) {
    return null;
  }

  const { width, height } = source;
  const pixels = context.getImageData(0, 0, width, height).data;
  let top = height;
  let left = width;
  let right = -1;
  let bottom = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (pixels[(y * width + x) * 4 + 3] > 0) {
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
        left = Math.min(left, x);
        right = Math.max(right, x);
      }
    }
  }

  if (right < 0) {
    return null;
  }

  const padding = 8;
  const cropX = Math.max(0, left - padding);
  const cropY = Math.max(0, top - padding);
  const cropWidth = Math.min(width, right + padding) - cropX;
  const cropHeight = Math.min(height, bottom + padding) - cropY;
  const output = document.createElement("canvas");

  output.width = cropWidth;
  output.height = cropHeight;
  output.getContext("2d")?.drawImage(source, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

  return output.toDataURL("image/png");
}

// An uploaded photo or scan → a PNG with the paper made transparent.
function imageFileToSignature(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      const scale = Math.min(1, MAX_WIDTH / image.width, MAX_HEIGHT / image.height);
      const canvas = document.createElement("canvas");

      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));

      const context = canvas.getContext("2d");

      if (!context) {
        reject(new Error("Couldn't read that image."));
        return;
      }

      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      // Near-white pixels (the paper) become transparent.
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = imageData.data;

      for (let index = 0; index < pixels.length; index += 4) {
        if (pixels[index] > 225 && pixels[index + 1] > 225 && pixels[index + 2] > 225) {
          pixels[index + 3] = 0;
        }
      }

      context.putImageData(imageData, 0, 0);
      URL.revokeObjectURL(url);

      const trimmed = trimmedDataUrl(canvas);

      if (trimmed) {
        resolve(trimmed);
      } else {
        reject(new Error("No signature could be found in that image. Try a darker, clearer photo."));
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Couldn't read that image. Use a PNG or JPG file."));
    };

    image.src = url;
  });
}

// Draw a signature with a mouse, finger or stylus — or upload an image of
// one. Built on signature_pad (smooth, pressure-like strokes on a canvas).
function SignaturePad({ value, onChange, disabled = false }: SignaturePadProps) {
  const [mode, setMode] = useState<Mode>("draw");
  const [uploadError, setUploadError] = useState("");
  const [hasStrokes, setHasStrokes] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePadLib | null>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Sets the pad up while in Draw mode, and keeps the canvas sharp on
  // high-density screens and after the window is resized.
  useEffect(() => {
    const canvas = canvasRef.current;

    if (mode !== "draw" || !canvas) {
      return;
    }

    const pad = new SignaturePadLib(canvas, {
      penColor: "#0b1f44",
      minWidth: 0.8,
      maxWidth: 2.6,
      backgroundColor: "rgba(0,0,0,0)",
    });
    padRef.current = pad;

    function emit() {
      const empty = pad.isEmpty();
      setHasStrokes(!empty);
      onChangeRef.current(empty || !canvas ? null : trimmedDataUrl(canvas));
    }

    function resize() {
      if (!canvas) {
        return;
      }

      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const strokes = pad.toData();

      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      canvas.getContext("2d")?.scale(ratio, ratio);
      pad.clear();
      pad.fromData(strokes);
    }

    resize();
    pad.addEventListener("endStroke", emit);
    window.addEventListener("resize", resize);

    return () => {
      pad.removeEventListener("endStroke", emit);
      window.removeEventListener("resize", resize);
      pad.off();
      padRef.current = null;
    };
  }, [mode]);

  useEffect(() => {
    if (!padRef.current) {
      return;
    }

    if (disabled) {
      padRef.current.off();
    } else {
      padRef.current.on();
    }
  }, [disabled, mode]);

  function clear() {
    padRef.current?.clear();
    setHasStrokes(false);
    setUploadError("");
    onChange(null);
  }

  function undo() {
    const pad = padRef.current;

    if (!pad) {
      return;
    }

    const strokes = pad.toData();
    strokes.pop();
    pad.fromData(strokes);

    const empty = pad.isEmpty();
    setHasStrokes(!empty);
    onChange(empty || !canvasRef.current ? null : trimmedDataUrl(canvasRef.current));
  }

  function switchMode(next: Mode) {
    if (next === mode) {
      return;
    }

    setMode(next);
    setHasStrokes(false);
    setUploadError("");
    onChange(null);
  }

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
      setUploadError("Use a PNG, JPG or WebP image.");
      return;
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError("That image is larger than 2 MB. Use a smaller one.");
      return;
    }

    try {
      setUploadError("");
      onChange(await imageFileToSignature(file));
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Couldn't read that image.");
    }
  }

  return (
    <div className={disabled ? "signature-pad signature-pad--disabled" : "signature-pad"}>
      <div className="signature-pad_tabs" role="tablist" aria-label="How to add your signature">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "draw"}
          className={mode === "draw" ? "signature-pad_tab signature-pad_tab--active" : "signature-pad_tab"}
          onClick={() => switchMode("draw")}
          disabled={disabled}
        >
          <PenLine size={16} aria-hidden="true" />
          Draw
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={mode === "upload"}
          className={mode === "upload" ? "signature-pad_tab signature-pad_tab--active" : "signature-pad_tab"}
          onClick={() => switchMode("upload")}
          disabled={disabled}
        >
          <ImageUp size={16} aria-hidden="true" />
          Upload
        </button>
      </div>

      {mode === "draw" ? (
        <div className="signature-pad_paper">
          <canvas ref={canvasRef} className="signature-pad_canvas" aria-label="Signature drawing area" />
          {!hasStrokes && <span className="signature-pad_hint">Sign here</span>}
          <span className="signature-pad_line" aria-hidden="true" />
        </div>
      ) : (
        <div className="signature-pad_paper signature-pad_paper--upload">
          {value ? (
            <img src={value} alt="Your uploaded signature" className="signature-pad_preview" />
          ) : (
            <label className="signature-pad_upload">
              <ImageUp size={22} aria-hidden="true" />
              <span>
                <strong>Choose an image of your signature</strong>
                PNG, JPG or WebP, up to 2 MB. A signature on plain white paper works best.
              </span>
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFile} disabled={disabled} />
            </label>
          )}
        </div>
      )}

      {uploadError && (
        <p className="form-error" role="alert">
          {uploadError}
        </p>
      )}

      <div className="signature-pad_actions">
        {mode === "draw" && (
          <button type="button" className="button button--dark" onClick={undo} disabled={disabled || !hasStrokes}>
            <Undo2 size={16} aria-hidden="true" />
            Undo
          </button>
        )}

        <button
          type="button"
          className="button button--dark"
          onClick={clear}
          disabled={disabled || (mode === "draw" ? !hasStrokes : !value)}
        >
          <Eraser size={16} aria-hidden="true" />
          {mode === "draw" ? "Clear" : "Choose another"}
        </button>
      </div>
    </div>
  );
}

export default SignaturePad;
