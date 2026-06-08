import { useCallback, useRef, useState } from "react";
import { ImagePlus, Trash2, UploadCloud, X } from "lucide-react";
import { Button } from "./ui";
import { cx } from "./uiConfig";

const ACCEPT = "image/jpeg,image/png,image/gif,image/webp";

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DropZone({ onFileSelect, disabled = false, multiple = false }) {
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState(null);
  const [fileInfo, setFileInfo] = useState(null);
  const [multiFiles, setMultiFiles] = useState([]);
  const inputRef = useRef(null);

  const handleFile = useCallback(
    (file) => {
      if (!file || !file.type.startsWith("image/")) return;
      setPreview(URL.createObjectURL(file));
      setFileInfo({ name: file.name, size: formatSize(file.size) });
      onFileSelect?.(file);
    },
    [onFileSelect],
  );

  const handleMultiFiles = useCallback(
    (fileList) => {
      const images = Array.from(fileList).filter((file) => file.type.startsWith("image/"));
      if (!images.length) return;
      setMultiFiles(images);
      onFileSelect?.(images);
    },
    [onFileSelect],
  );

  const handleDrop = useCallback(
    (event) => {
      event.preventDefault();
      setDragOver(false);
      if (disabled) return;
      if (multiple) handleMultiFiles(event.dataTransfer.files);
      else handleFile(event.dataTransfer.files[0]);
    },
    [disabled, handleFile, handleMultiFiles, multiple],
  );

  const handleChange = (event) => {
    if (multiple) handleMultiFiles(event.target.files);
    else handleFile(event.target.files[0]);
  };

  const clearFile = (event) => {
    event.stopPropagation();
    setPreview(null);
    setFileInfo(null);
    setMultiFiles([]);
    onFileSelect?.(multiple ? [] : null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const removeFile = (idx, event) => {
    event.stopPropagation();
    const updated = multiFiles.filter((_, index) => index !== idx);
    setMultiFiles(updated);
    onFileSelect?.(updated);
    if (inputRef.current) inputRef.current.value = "";
  };

  const openPicker = () => {
    if (!disabled) inputRef.current?.click();
  };

  const frameClass = cx(
    "relative rounded-xl border-2 border-dashed bg-slate-50 transition",
    disabled ? "cursor-not-allowed opacity-55" : "cursor-pointer hover:border-sky-300 hover:bg-sky-50/50",
    dragOver ? "border-sky-500 bg-sky-50 ring-4 ring-sky-100" : "border-slate-300",
  );

  if (multiple) {
    return (
      <div
        onClick={openPicker}
        onDrop={handleDrop}
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        className={cx(frameClass, multiFiles.length > 0 ? "p-3" : "p-8")}
      >
        <input ref={inputRef} type="file" accept={ACCEPT} onChange={handleChange} className="hidden" disabled={disabled} multiple />

        {multiFiles.length > 0 ? (
          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-800">
                  {multiFiles.length} image{multiFiles.length !== 1 ? "s" : ""} selected
                </p>
                <p className="text-xs text-slate-500">Review metadata before ingesting this batch.</p>
              </div>
              <Button type="button" variant="ghost" size="sm" icon={Trash2} onClick={clearFile}>
                Clear
              </Button>
            </div>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
              {multiFiles.map((file, index) => (
                <div key={`${file.name}-${index}`} className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                  <img src={URL.createObjectURL(file)} alt={file.name} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={(event) => removeFile(index, event)}
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-md bg-white/90 text-slate-500 opacity-0 shadow-sm transition hover:text-red-600 group-hover:opacity-100"
                    aria-label={`Remove ${file.name}`}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <p className="absolute inset-x-0 bottom-0 bg-slate-950/75 px-1.5 py-1 text-[10px] font-semibold text-white">
                    {formatSize(file.size)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-white text-sky-700 shadow-sm ring-1 ring-slate-200">
              <UploadCloud className="h-6 w-6" aria-hidden="true" />
            </div>
            <p className="mt-3 text-sm font-bold text-slate-800">Drop images here or select files</p>
            <p className="mt-1 text-xs text-slate-500">Multiple images. JPG, PNG, GIF, WEBP.</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      onClick={openPicker}
      onDrop={handleDrop}
      onDragOver={(event) => {
        event.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      className={cx(frameClass, preview ? "p-3" : "p-8")}
    >
      <input ref={inputRef} type="file" accept={ACCEPT} onChange={handleChange} className="hidden" disabled={disabled} />

      {preview ? (
        <div className="flex items-center gap-4">
          <img src={preview} alt="Preview" className="h-24 w-24 rounded-lg border border-slate-200 object-cover shadow-sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-slate-900">{fileInfo?.name}</p>
            <p className="mt-1 text-xs text-slate-500">{fileInfo?.size}</p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={clearFile} aria-label="Clear selected file">
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      ) : (
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-white text-sky-700 shadow-sm ring-1 ring-slate-200">
            <ImagePlus className="h-7 w-7" aria-hidden="true" />
          </div>
          <p className="mt-3 text-sm font-bold text-slate-800">Drop one image here or select a file</p>
          <p className="mt-1 text-xs text-slate-500">JPG, PNG, GIF, WEBP.</p>
        </div>
      )}
    </div>
  );
}
