export const IPC = {
  // File dialogs
  SELECT_INPUT_FILES: 'dialog:selectInputFiles',
  SELECT_OUTPUT_DIR: 'dialog:selectOutputDir',

  // Conversion
  START_CONVERSION: 'converter:start',
  CANCEL_CONVERSION: 'converter:cancel',

  // Splitting
  START_SPLIT: 'splitter:start',
  CANCEL_SPLIT: 'splitter:cancel',

  // Markdown → PDF
  START_MD_PDF: 'mdpdf:start',
  CANCEL_MD_PDF: 'mdpdf:cancel',

  // App info
  GET_APP_VERSION: 'app:getVersion',
  GET_PLATFORM_INFO: 'app:getPlatformInfo',

  // FFmpeg
  CHECK_FFMPEG: 'ffmpeg:check',
  GET_FFMPEG_VERSION: 'ffmpeg:getVersion',

  // Filesystem helpers
  REVEAL_IN_FINDER: 'fs:revealInFinder',
  FILE_EXISTS: 'fs:fileExists',
  SHOW_ITEM_IN_FOLDER: 'fs:showItemInFolder',
} as const;

export const IPC_EVENTS = {
  CONVERSION_PROGRESS: 'converter:progress',
  CONVERSION_COMPLETE: 'converter:complete',
  CONVERSION_ERROR: 'converter:error',
  SPLIT_PROGRESS: 'splitter:progress',
  SPLIT_COMPLETE: 'splitter:complete',
  SPLIT_ERROR: 'splitter:error',
  MD_PDF_PROGRESS: 'mdpdf:progress',
  MD_PDF_COMPLETE: 'mdpdf:complete',
  MD_PDF_ERROR: 'mdpdf:error',
} as const;
