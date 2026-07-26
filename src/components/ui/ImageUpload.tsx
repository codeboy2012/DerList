'use client';

/**
 * ImageUpload — Reusable image upload component.
 *
 * Features:
 * - Click to browse files
 * - Drag and drop
 * - Instant preview
 * - Upload progress indication
 * - Replace existing image
 * - Remove image
 * - Format/size validation (client + server)
 */
import { useCallback, useRef, useState } from 'react';
import { Loader2, Trash2, Upload, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/Button';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
const MAX_SIZE_MB = 10;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

export interface ImageUploadProps {
  /** Current image URL (for preview) */
  value: string | null;
  /** Called with the new URL after successful upload, or null on remove */
  onChange: (url: string | null) => void;
  /** Upload purpose sent to the API (e.g. "avatar", "wishlist_icon") */
  purpose?: string;
  /** Shape of the preview */
  shape?: 'circle' | 'rounded';
  /** Size of the drop zone */
  size?: 'sm' | 'md' | 'lg';
  /** Placeholder text */
  placeholder?: string;
  /** Optional class name */
  className?: string;
  /** Disable interaction */
  disabled?: boolean;
}

export function ImageUpload({
  value,
  onChange,
  purpose = 'general',
  shape = 'rounded',
  size = 'md',
  placeholder = 'Upload image',
  className,
  disabled = false,
}: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const sizeClasses = {
    sm: 'h-16 w-16',
    md: 'h-24 w-24',
    lg: 'h-32 w-32',
  };

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);

      // Client-side validation
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError('Unsupported format. Use PNG, JPG, WebP, GIF, or SVG.');
        return;
      }
      if (file.size > MAX_SIZE_BYTES) {
        setError(
          `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max ${MAX_SIZE_MB}MB.`
        );
        return;
      }

      setIsUploading(true);

      try {
        const formData = new FormData();
        formData.set('file', file);
        formData.set('purpose', purpose);

        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        const data = await res.json();

        if (!res.ok || data.error) {
          setError(data.error || 'Upload failed');
          return;
        }

        onChange(data.url);
      } catch {
        setError('Upload failed. Please try again.');
      } finally {
        setIsUploading(false);
      }
    },
    [purpose, onChange]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset so same file can be re-selected
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled || isUploading) return;
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled && !isUploading) setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleRemove = () => {
    onChange(null);
    setError(null);
  };

  return (
    <div className={cn('flex items-center gap-4', className)}>
      {/* Preview / Drop zone */}
      <button
        type="button"
        onClick={() => !disabled && !isUploading && inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        disabled={disabled || isUploading}
        className={cn(
          'relative flex shrink-0 items-center justify-center overflow-hidden border-2 border-dashed transition-all',
          sizeClasses[size],
          shape === 'circle' ? 'rounded-full' : 'rounded-xl',
          isDragging
            ? 'border-accent bg-accent/10'
            : value
              ? 'border-transparent'
              : 'border-border hover:border-accent/50 hover:bg-surface/50',
          disabled && 'cursor-not-allowed opacity-50'
        )}
      >
        {isUploading ? (
          <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
        ) : value ? (
          <img src={value} alt="" className="h-full w-full object-cover" />
        ) : (
          <Upload className="text-muted-foreground h-5 w-5" />
        )}
      </button>

      {/* Controls */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || isUploading}
          >
            {isUploading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Upload className="h-3 w-3" />
            )}
            {value ? 'Replace' : placeholder}
          </Button>
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-danger gap-1.5 text-xs"
              onClick={handleRemove}
              disabled={disabled || isUploading}
            >
              <Trash2 className="h-3 w-3" />
              Remove
            </Button>
          )}
        </div>
        <p className="text-muted-foreground text-[10px]">
          PNG, JPG, WebP, GIF, SVG. Max {MAX_SIZE_MB}MB.
        </p>
        {error && (
          <p className="text-danger flex items-center gap-1 text-xs">
            <X className="h-3 w-3" />
            {error}
          </p>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        onChange={handleInputChange}
        className="hidden"
        aria-hidden
      />
    </div>
  );
}
