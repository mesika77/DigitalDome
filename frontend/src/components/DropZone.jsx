import { useState, useRef, useCallback } from "react";

const ACCEPT = "image/jpeg,image/png,image/gif,image/webp";

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DropZone({ onFileSelect, variant = "dark", disabled = false, multiple = false }) {
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState(null);
  const [fileInfo, setFileInfo] = useState(null);
  const [multiFiles, setMultiFiles] = useState([]);
  const inputRef = useRef(null);

  const isInstagram = variant === "instagram";

  const handleFile = useCallback(
    (file) => {
      if (!file || !file.type.startsWith("image/")) return;
      setPreview(URL.createObjectURL(file));
      setFileInfo({ name: file.name, size: formatSize(file.size) });
      onFileSelect?.(file);
    },
    [onFileSelect]
  );

  const handleMultiFiles = useCallback(
    (fileList) => {
      const images = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
      if (!images.length) return;
      setMultiFiles(images);
      onFileSelect?.(images);
    },
    [onFileSelect]
  );

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragOver(false);
      if (multiple) {
        handleMultiFiles(e.dataTransfer.files);
      } else {
        handleFile(e.dataTransfer.files[0]);
      }
    },
    [handleFile, handleMultiFiles, multiple]
  );

  const handleDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);
  const handleClick = () => { if (!disabled) inputRef.current?.click(); };

  const handleChange = (e) => {
    if (multiple) {
      handleMultiFiles(e.target.files);
    } else {
      handleFile(e.target.files[0]);
    }
  };

  const clearFile = (e) => {
    e.stopPropagation();
    setPreview(null);
    setFileInfo(null);
    setMultiFiles([]);
    onFileSelect?.(multiple ? [] : null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const removeFile = (idx, e) => {
    e.stopPropagation();
    const updated = multiFiles.filter((_, i) => i !== idx);
    setMultiFiles(updated);
    onFileSelect?.(updated);
    if (inputRef.current) inputRef.current.value = "";
  };

  if (multiple) {
    return (
      <div
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          relative cursor-pointer rounded-xl border-2 border-dashed transition-all duration-200
          ${disabled ? "opacity-50 cursor-not-allowed" : ""}
          ${dragOver ? "border-red-500/80 bg-red-500/5 scale-[1.01]" : "border-white/10 hover:border-white/20"}
          ${multiFiles.length > 0 ? "p-3" : "p-8"}
        `}
      >
        <input ref={inputRef} type="file" accept={ACCEPT} onChange={handleChange} className="hidden" disabled={disabled} multiple />

        {multiFiles.length > 0 ? (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-white/70 font-medium">
                {multiFiles.length} image{multiFiles.length !== 1 ? "s" : ""} selected
              </p>
              <button onClick={clearFile} className="text-xs text-white/30 hover:text-red-400 transition-colors">
                Clear all
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {multiFiles.map((f, i) => (
                <div key={i} className="relative group aspect-square">
                  <img
                    src={URL.createObjectURL(f)}
                    alt={f.name}
                    className="h-full w-full rounded-lg object-cover border border-white/10"
                  />
                  <button
                    onClick={(e) => removeFile(i, e)}
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[10px]"
                  >
                    &times;
                  </button>
                  <p className="absolute bottom-0 left-0 right-0 bg-black/60 text-[8px] text-white/60 px-1 py-0.5 rounded-b-lg truncate">
                    {formatSize(f.size)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center">
            <svg className="mx-auto h-10 w-10 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="mt-3 text-sm text-white/50">
              <span className="text-red-400 font-medium">Click to upload</span> or drag and drop
            </p>
            <p className="mt-1 text-xs text-white/30">Multiple images &middot; JPG, PNG, GIF, WEBP</p>
          </div>
        )}
      </div>
    );
  }

  if (isInstagram) {
    return (
      <div
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          relative cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-300
          ${disabled ? "opacity-50 cursor-not-allowed" : ""}
          ${dragOver
            ? "border-[#0095f6] bg-[#0095f6]/5 scale-[1.01]"
            : "border-gray-600/40 hover:border-gray-500/60"
          }
          ${preview ? "p-0 border-0" : "p-12"}
        `}
      >
        <input ref={inputRef} type="file" accept={ACCEPT} onChange={handleChange} className="hidden" disabled={disabled} />

        {preview ? (
          <div className="relative group">
            <img src={preview} alt="Preview" className="w-full max-h-[400px] object-contain rounded-2xl" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors rounded-2xl flex items-center justify-center">
              <button
                onClick={clearFile}
                className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 hover:bg-black/80 text-white rounded-full p-2.5"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="absolute bottom-3 left-3 right-3 bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 flex items-center gap-2">
              <p className="text-xs text-white/80 truncate flex-1">{fileInfo?.name}</p>
              <p className="text-[10px] text-white/50 shrink-0">{fileInfo?.size}</p>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <svg className="h-8 w-8 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-base text-white/70 font-medium">Drag photos here</p>
            <p className="text-sm text-white/30 mt-1.5 mb-4">JPG, PNG, GIF, WEBP</p>
            <button
              type="button"
              className="px-6 py-2 rounded-lg bg-[#0095f6] hover:bg-[#1877f2] text-white text-sm font-semibold transition-colors"
              onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
            >
              Select from computer
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      onClick={handleClick}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={`
        relative cursor-pointer rounded-xl border-2 border-dashed transition-all duration-200
        ${disabled ? "opacity-50 cursor-not-allowed" : ""}
        ${dragOver ? "border-red-500/80 bg-red-500/5 scale-[1.01]" : "border-white/10 hover:border-white/20"}
        ${preview ? "p-3" : "p-8"}
      `}
    >
      <input ref={inputRef} type="file" accept={ACCEPT} onChange={handleChange} className="hidden" disabled={disabled} />

      {preview ? (
        <div className="flex items-center gap-4">
          <img src={preview} alt="Preview" className="h-20 w-20 rounded-lg object-cover border border-white/10" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white/90 truncate">{fileInfo?.name}</p>
            <p className="text-xs text-white/40 mt-0.5">{fileInfo?.size}</p>
          </div>
          <button onClick={clearFile} className="shrink-0 p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/80 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : (
        <div className="text-center">
          <svg className="mx-auto h-10 w-10 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="mt-3 text-sm text-white/50">
            <span className="text-red-400 font-medium">Click to upload</span> or drag and drop
          </p>
          <p className="mt-1 text-xs text-white/30">JPG, PNG, GIF, WEBP</p>
        </div>
      )}
    </div>
  );
}
