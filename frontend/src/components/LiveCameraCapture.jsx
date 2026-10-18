import React, { useRef, useState, useEffect } from "react";
import { Camera, X } from "lucide-react";

function LiveCameraCapture({ onCapture, maxPages = 5 }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [capturedImages, setCapturedImages] = useState([]);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  // Start camera stream
  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      setStream(mediaStream);
      setIsCameraActive(true);
      setTorchOn(false); // Reset torch state on open
    } catch (err) {
      console.error("Camera access error:", err);
      alert(
        "Could not access camera. Please check camera permissions in your browser settings.",
      );
    }
  };

  // Reactive stream attachment
  useEffect(() => {
    if (isCameraActive && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch((err) => {
        console.warn("Video play error:", err);
      });
    }
  }, [isCameraActive, stream]);

  // Toggle Flashlight (Torch)
  const toggleTorch = async () => {
    if (!stream) return;
    const videoTrack = stream.getVideoTracks()[0];
    try {
      const capabilities = videoTrack.getCapabilities();
      if (capabilities.torch) {
        await videoTrack.applyConstraints({
          advanced: [{ torch: !torchOn }],
        });
        setTorchOn(!torchOn);
      } else {
        alert("Flashlight (torch) is not supported on this device/browser.");
      }
    } catch (err) {
      console.error("Error toggling torch:", err);
    }
  };

  // Stop camera stream
  const stopCamera = () => {
    if (stream) {
      // Turn off torch before stopping if active
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack
          .applyConstraints({ advanced: [{ torch: false }] })
          .catch(() => {});
      }
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setIsCameraActive(false);
    setTorchOn(false);
  };

  // Capture frame from video feed safely with fallback dimensions
  const captureSnapshot = () => {
    if (capturedImages.length >= maxPages) {
      alert(`Maximum allowed pages (${maxPages}) reached.`);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas) {
      canvas.width = video.videoWidth || video.clientWidth || 1280;
      canvas.height = video.videoHeight || video.clientHeight || 720;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size < 100) {
            alert("Capture failed: video frame was empty. Please try again.");
            return;
          }
          const file = new File([blob], `capture_${Date.now()}.jpg`, {
            type: "image/jpeg",
          });
          const newImages = [
            ...capturedImages,
            { file, preview: URL.createObjectURL(blob) },
          ];
          setCapturedImages(newImages);
          onCapture(newImages.map((img) => img.file));
          stopCamera(); // Close camera overlay after successful snap
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
      stopCamera();
    };
  }, []);

  return (
    <div className="space-y-4">
      {/* Trigger Button Card */}
      <div className="text-center p-6 border-2 border-dashed border-orange-300 bg-orange-50/50 rounded-2xl">
        <Camera className="w-10 h-10 text-orange-600 mx-auto mb-2" />
        <h4 className="text-sm font-bold text-slate-800">
          Live Camera Capture Required
        </h4>
        <p className="text-xs text-slate-500 mb-4">
          Gallery uploads are disabled. Snap your work live (
          {capturedImages.length}/{maxPages} pages).
        </p>
        <button
          onClick={startCamera}
          className="px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl shadow transition-all cursor-pointer"
        >
          Open Full-Screen Camera 📷
        </button>
      </div>

      {/* FULL-SCREEN OVERLAY MODAL FOR CAMERA VIEW */}
      {isCameraActive && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-between p-4 overflow-hidden">
          {/* Top Bar */}
          <div className="w-full flex items-center justify-between text-white py-2 px-4 z-10">
            <span className="text-xs font-bold tracking-wider uppercase bg-white/20 px-3 py-1 rounded-full">
              Live Viewfinder ({capturedImages.length}/{maxPages})
            </span>
            <button
              onClick={stopCamera}
              className="p-2.5 bg-white/20 hover:bg-white/30 rounded-full text-white cursor-pointer"
              title="Close Camera"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Full Screen Video Stream */}
          <div className="relative flex-1 w-full flex items-center justify-center my-2">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-contain"
            />
          </div>

          {/* Bottom Floating Shutter & Flash Controls */}
          <div className="w-full py-6 flex items-center justify-center gap-4 z-10 bg-gradient-to-t from-black/80 to-transparent">
            {/* Flashlight Toggle Button */}
            <button
              onClick={toggleTorch}
              className={`p-4 rounded-full font-bold text-sm shadow-2xl flex items-center justify-center transition-all cursor-pointer ${
                torchOn
                  ? "bg-amber-400 text-slate-900 shadow-amber-400/50"
                  : "bg-white/20 text-white"
              }`}
              title="Toggle Flash"
            >
              ⚡
            </button>

            <button
              onClick={captureSnapshot}
              className="px-8 py-4 bg-white text-slate-900 rounded-full font-extrabold text-sm shadow-2xl flex items-center gap-3 hover:bg-orange-50 active:scale-95 transition-all cursor-pointer"
            >
              <Camera className="w-5 h-5 text-orange-600" /> Snap Photo 📸
            </button>
          </div>

          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}

      {/* Captured Previews Grid */}
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
                  className="text-red-600 hover:underline cursor-pointer"
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
