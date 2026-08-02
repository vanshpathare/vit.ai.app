import React, { useEffect, useRef, useState } from "react";
import { renderAsync } from "docx-preview";

export default function DocxViewerModal({ fileUrl, title, onClose }) {
  const containerRef = useRef(null);
  const wrapperRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [scale, setScale] = useState(1);
  const [baseScale, setBaseScale] = useState(1);

  const updateScale = () => {
    if (!wrapperRef.current) return;
    const containerWidth = wrapperRef.current.clientWidth - 24;
    const defaultA4Width = 816; // Standard Word A4 pixel width

    if (containerWidth < defaultA4Width) {
      const calculatedScale = containerWidth / defaultA4Width;
      setBaseScale(calculatedScale);
      setScale(calculatedScale);
    } else {
      setBaseScale(1);
      setScale(1);
    }
  };

  useEffect(() => {
    if (fileUrl && containerRef.current) {
      setLoading(true);
      setError(false);

      fetch(fileUrl)
        .then((res) => {
          if (!res.ok) throw new Error("Failed to fetch file");
          return res.arrayBuffer();
        })
        .then((buffer) => {
          if (containerRef.current) {
            containerRef.current.innerHTML = "";
            return renderAsync(buffer, containerRef.current, null, {
              inWrapper: true,
              ignoreWidth: false,
              ignoreHeight: false,
              experimental: true,
            });
          }
        })
        .then(() => {
          setLoading(false);
          setTimeout(updateScale, 100);
        })
        .catch((err) => {
          console.error("Docx preview error:", err);
          setError(true);
          setLoading(false);
        });
    }
  }, [fileUrl]);

  useEffect(() => {
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  const handleZoomIn = () => setScale((prev) => Math.min(prev + 0.15, 2.5));
  const handleZoomOut = () => setScale((prev) => Math.max(prev - 0.15, 0.2));
  const handleResetZoom = () => setScale(baseScale);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-1.5 sm:p-4">
      {/* 🟢 PRECISION OVERRIDES FOR DOCX-PREVIEW ENGINE */}
      <style>{`
        /* 1. Reset library wrapper bounds */
        .docx-wrapper {
          background: transparent !important;
          padding: 0 !important;
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
        }

        /* 2. Standardize Word Document Page Container */
        .docx-wrapper > section.docx {
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1) !important;
          background: #ffffff !important;
          border: 1px solid #cbd5e1 !important;
          border-radius: 4px !important;
          margin-bottom: 2rem !important;
          box-sizing: border-box !important;
          width: 816px !important; /* Force true standard A4 canvas width */
          max-width: 816px !important;
          overflow-x: hidden !important; /* Lock page edges */
        }

        /* 3. Fix Tables & Images Clipping Off Right Edge */
        .docx-wrapper section.docx table {
          max-width: 100% !important;
          table-layout: fixed !important;
          word-wrap: break-word !important;
        }

        .docx-wrapper section.docx img {
          max-width: 100% !important;
          height: auto !important;
          object-fit: contain !important;
        }

        /* 4. Fix Code Blocks & Terminal Screenshots Overflow */
        .docx-wrapper section.docx p, 
        .docx-wrapper section.docx div {
          word-break: break-word !important;
          overflow-wrap: break-word !important;
        }
      `}</style>

      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-4xl h-[94vh] sm:h-[88vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-3 py-2.5 sm:px-4 sm:py-3 border-b border-slate-100 bg-slate-50 gap-2 shrink-0 z-10">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className="text-sm shrink-0">📄</span>
            <h3 className="text-xs sm:text-sm font-bold text-slate-800 truncate">
              {title || "Document Preview"}
            </h3>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Zoom Controls */}
            <div className="flex items-center bg-white border border-slate-200 rounded-lg shadow-sm p-0.5">
              <button
                onClick={handleZoomOut}
                className="w-6 h-6 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded text-xs font-bold"
                title="Zoom Out"
              >
                −
              </button>
              <button
                onClick={handleResetZoom}
                className="px-1.5 text-[10px] font-bold text-slate-500 hover:text-slate-800"
                title="Reset Fit"
              >
                {Math.round((scale / baseScale) * 100)}%
              </button>
              <button
                onClick={handleZoomIn}
                className="w-6 h-6 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded text-xs font-bold"
                title="Zoom In"
              >
                +
              </button>
            </div>

            {/* Download */}
            <a
              href={fileUrl}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-600 border border-orange-200 text-[11px] sm:text-xs font-bold rounded-lg transition-colors flex items-center gap-1 shadow-sm shrink-0"
              title="Download Document"
            >
              <span className="hidden sm:inline">Download</span>
              <span className="text-[10px]">⬇️</span>
            </a>

            {/* Close */}
            <button
              onClick={onClose}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center text-xs sm:text-sm font-bold shadow-sm transition-colors shrink-0"
              title="Close Preview"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 🟢 Outer Scroll Window */}
        <div
          ref={wrapperRef}
          className="flex-1 overflow-auto bg-slate-100/80 p-3 sm:p-6 flex justify-center items-start w-full"
        >
          {loading && (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-xs text-slate-400 font-medium my-auto">
              <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
              <span>Rendering Print View...</span>
            </div>
          )}

          {error && (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-2 p-6 my-auto">
              <p className="text-xs font-bold text-red-600">
                Could not render preview
              </p>
              <a
                href={fileUrl}
                download
                className="inline-block px-3 py-1.5 bg-orange-50 text-orange-600 font-bold text-xs rounded-lg border border-orange-200"
              >
                Download File Directly
              </a>
            </div>
          )}

          {/* 🟢 Perfectly Scaled Page Container */}
          <div
            style={{
              zoom: scale,
            }}
            className={`transition-all duration-150 ${
              loading || error ? "hidden" : "block"
            }`}
          >
            <div ref={containerRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
