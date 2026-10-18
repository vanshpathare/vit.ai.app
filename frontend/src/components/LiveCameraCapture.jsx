import React, { useRef, useState, useEffect } from "react";
import { Camera, RefreshCw, Check, X } from "lucide-react";

function LiveCameraCapture({ onCapture, maxPages = 5 }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [capturedImages, setCapturedImages] = useState([]);
  const [isCameraActive, setIsCameraActive] = useState(false);

  // Start camera stream
  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }, // Prefers rear camera on mobile
        audio: false,
      });
      setStream(mediaStream);
      setIsCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error("Camera access error:", err);
      alert("Could not access camera. Please check camera permissions.");
    }
  };

  // Stop camera stream
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setIsCameraActive(false);
  };

  // Capture frame from video feed
  const captureSnapshot = () => {
    if (capturedImages.length >= maxPages) {
      alert(`Maximum allowed pages (${maxPages}) reached.`);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        (blob) => {
          const file = new File([blob], `capture_${Date.now()}.jpg`, {
            type: "image/jpeg",
          });
          const newImages = [
            ...capturedImages,
            { file, preview: URL.createObjectURL(blob) },
          ];
          setCapturedImages(newImages);
          onCapture(newImages.map((img) => img.file)); // Pass files back to parent workspace
        },
        "image/jpeg",
        0.85,
      );
    }
  };

  const removeImage = (index) => {
    const updated = capturedImages.filter((_, i) => i !== index);
    setCapturedImages(updated);
    onCapture(updated.map((img) => img.file));
  };

  useEffect(() => {
    return () => {
      stopCamera(); // Clean up stream on unmount
    };
  }, []);

  return (
    <div className="space-y-4">
      {!isCameraActive ? (
        <div className="text-center p-6 border-2 border-dashed border-orange-300 bg-orange-50/50 rounded-2xl">
          <Camera className="w-10 h-10 text-orange-600 mx-auto mb-2" />
          <h4 className="text-sm font-bold text-slate-800">
            Live Camera Capture Required
          </h4>
          <p className="text-xs text-slate-500 mb-4">
            Gallery uploads are disabled for this assignment.
          </p>
          <button
            onClick={startCamera}
            className="px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl shadow transition-all"
          >
            Open Live Camera 📷
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative bg-black rounded-2xl overflow-hidden shadow-inner aspect-[4/3] max-w-md mx-auto">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-4 inset-x-0 flex justify-center gap-4">
              <button
                onClick={captureSnapshot}
                className="px-6 py-3 bg-white text-slate-900 rounded-full font-bold text-xs shadow-lg flex items-center gap-2 hover:bg-slate-100"
              >
                <Camera className="w-4 h-4 text-orange-600" /> Capture Photo (
                {capturedImages.length}/{maxPages})
              </button>
              <button
                onClick={stopCamera}
                className="p-3 bg-red-600 text-white rounded-full shadow-lg hover:bg-red-700"
                title="Close Camera"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}

      {/* Captured Previews */}
      {capturedImages.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
          {capturedImages.map((img, idx) => (
            <div
              key={idx}
              className="relative bg-white border border-slate-200 rounded-xl p-2 shadow-sm"
            >
              <img
                src={img.preview}
                alt={`Page ${idx + 1}`}
                className="w-full h-24 object-cover rounded-lg mb-1"
              />
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                <span>Page {idx + 1}</span>
                <button
                  onClick={() => removeImage(idx)}
                  className="text-red-600 hover:underline"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default LiveCameraCapture;
