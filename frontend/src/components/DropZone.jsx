import { useState, useRef, useCallback } from "react";

const ACCEPT = "image/jpeg,image/png,image/gif,image/webp";

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DropZone({ onFileSelect, accent = "indigo", disabled = false }) {
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState(null);
  const [fileInfo, setFileInfo] = useState(null);
  const inputRef = useRef(null);

  const accentColors = {
    red: {
      border: "border-red-500/40",
      borderHover: "border-red-500/80",
      bg: "bg-red-500/5",
      text: "text-red-400",
    },
    blue: {
      border: "border-blue-500/40",
      borderHover: "border-blue-500/80",
      bg: "bg-blue-500/5",
      text: "text-blue-400",
    },
    indigo: {
      border: "border-indigo-500/40",
      borderHover: "border-indigo-500/80",
      bg: "bg-indigo-500/5",
      text: "text-indigo-400",
    },
  };

  const colors = accentColors[accent] || accentColors.indigo;

  const handleFile = useCallback(
    (file) => {
      if (!file || !file.type.startsWith("image/")) return;
      setPreview(URL.createObjectURL(file));
      setFileInfo({ name: file.name, size: formatSize(file.size) });
      onFileSelect?.(file);
    },
    [onFileSelect]
  );

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleClick = () => {
    if (!disabled) inputRef.current?.click();
  };

  const handleChange = (e) => {
    const file = e.target.files[0];
    handleFile(file);
  };

  const clearFile = (e) => {
    e.stopPropagation();
    setPreview(null);
    setFileInfo(null);
    onFileSelect?.(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div
      onClick={handleClick}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={`
        relative cursor-pointer rounded-xl border-2 border-dashed transition-all duration-200
        ${disabled ? "opacity-50 cursor-not-allowed" : ""}
        ${dragOver ? `${colors.borderHover} ${colors.bg} scale-[1.01]` : `${colors.border} hover:${colors.borderHover}`}
        ${preview ? "p-3" : "p-8"}
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        onChange={handleChange}
        className="hidden"
        disabled={disabled}
      />

      {preview ? (
        <div className="flex items-center gap-4">
          <img
            src={preview}
            alt="Preview"
            className="h-20 w-20 rounded-lg object-cover border border-white/10"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white/90 truncate">{fileInfo?.name}</p>
            <p className="text-xs text-white/40 mt-0.5">{fileInfo?.size}</p>
          </div>
          <button
            onClick={clearFile}
            className="shrink-0 p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/80 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : (
        <div className="text-center">
          <svg
            className={`mx-auto h-10 w-10 ${colors.text} opacity-60`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <p className="mt-3 text-sm text-white/50">
            <span className={`${colors.text} font-medium`}>Click to upload</span> or drag and drop
          </p>
          <p className="mt-1 text-xs text-white/30">JPG, PNG, GIF, WEBP</p>
        </div>
      )}
    </div>
  );
}
