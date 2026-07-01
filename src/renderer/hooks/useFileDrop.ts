import { useCallback, useState } from 'react';
import { SUPPORTED_INPUT_EXTENSIONS } from '@shared/audioFormats';

export interface DroppedFile {
  path: string;
  name: string;
}

/**
 * @param extensions Extensions (lowercase, no dot) accepted by the drop zone.
 *   Defaults to the audio tool's set so existing audio callers are unaffected.
 */
export function useFileDrop(
  onFilesDrop: (files: DroppedFile[]) => void,
  extensions: string[] = SUPPORTED_INPUT_EXTENSIONS
) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const items = e.dataTransfer.files;
      const files: DroppedFile[] = [];

      for (let i = 0; i < items.length; i++) {
        const file = items[i];
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        if (extensions.includes(ext)) {
          // webUtils.getPathForFile resolves the real absolute path from the
          // dropped File object (replaces the deprecated File.path property).
          const path = window.electronAPI.getPathForFile(file) || file.name;
          files.push({
            path,
            name: file.name,
          });
        }
      }

      if (files.length > 0) {
        onFilesDrop(files);
      }
    },
    [onFilesDrop, extensions]
  );

  return {
    isDragging,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  };
}
