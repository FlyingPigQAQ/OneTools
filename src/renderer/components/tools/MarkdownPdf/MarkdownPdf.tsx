import { useState, useCallback, useEffect } from 'react';
import { useMarkdownPdf } from '../../../hooks/useMarkdownPdf';
import { useFileDrop } from '../../../hooks/useFileDrop';
import { MARKDOWN_EXTENSIONS } from '@shared/markdown';
import DropZone from '../../common/DropZone';
import FileList from '../../common/FileList';
import MarkdownPdfQueue from './MarkdownPdfQueue';
import type { PdfPageSize, PdfOrientation, PdfMargin, MarkdownTheme } from '@shared/types';
import styles from './MarkdownPdf.module.css';

const PAGE_SIZES: PdfPageSize[] = ['A4', 'Letter', 'Legal'];
const MARGINS: PdfMargin[] = ['normal', 'narrow', 'none'];
const THEMES: { id: MarkdownTheme; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'sepia', label: 'Sepia' },
  { id: 'dark', label: 'Dark' },
];

function MarkdownPdf() {
  const {
    jobs,
    isConverting,
    addFiles,
    startConversion,
    retryJob,
    cancelJob,
    removeJob,
    revealInFinder,
    buildOptions,
  } = useMarkdownPdf();

  const [pageSize, setPageSize] = useState<PdfPageSize>('A4');
  const [orientation, setOrientation] = useState<PdfOrientation>('portrait');
  const [margin, setMargin] = useState<PdfMargin>('normal');
  const [theme, setTheme] = useState<MarkdownTheme>('light');
  const [outputDir, setOutputDir] = useState('');

  const buildCurrentOptions = useCallback(
    () => buildOptions(pageSize, orientation, margin, theme, outputDir || ''),
    [buildOptions, pageSize, orientation, margin, theme, outputDir]
  );

  const handleFilesDrop = useCallback(
    async (droppedFiles: { path: string; name: string }[]) => {
      await addFiles(
        droppedFiles.map((f) => f.path),
        buildCurrentOptions()
      );
    },
    [addFiles, buildCurrentOptions]
  );

  const handleBrowse = useCallback(async () => {
    const files = await window.electronAPI.selectInputFiles('markdown');
    if (files.length > 0) {
      await addFiles(files, buildCurrentOptions());
    }
  }, [addFiles, buildCurrentOptions]);

  const handleSelectOutputDir = useCallback(async () => {
    const dir = await window.electronAPI.selectOutputDir();
    if (dir) setOutputDir(dir);
  }, []);

  const handleConvert = useCallback(() => {
    startConversion(buildCurrentOptions());
  }, [startConversion, buildCurrentOptions]);

  // Menu accelerators (scoped to this tool).
  useEffect(() => {
    const onOpenFiles = () => handleBrowse();
    const onRevealOutput = () => {
      const done = jobs.find((j) => j.status === 'completed');
      if (done) revealInFinder(done.id);
    };
    const onPreferences = () => {
      console.log('Preferences: not implemented');
    };
    window.electronAPI.onMenu?.('menu:openFiles', onOpenFiles);
    window.electronAPI.onMenu?.('menu:revealOutput', onRevealOutput);
    window.electronAPI.onMenu?.('menu:preferences', onPreferences);
    return () => {
      window.electronAPI.offMenu?.('menu:openFiles', onOpenFiles);
      window.electronAPI.offMenu?.('menu:revealOutput', onRevealOutput);
      window.electronAPI.offMenu?.('menu:preferences', onPreferences);
    };
  }, [handleBrowse, jobs, revealInFinder]);

  const { isDragging, handleDragOver, handleDragLeave, handleDrop } = useFileDrop(
    handleFilesDrop,
    MARKDOWN_EXTENSIONS
  );

  const pendingFiles = jobs
    .filter((j) => j.status === 'pending')
    .map((j) => ({ id: j.id, name: j.fileName }));

  const hasPending = jobs.some((j) => j.status === 'pending');
  const hasActivity = jobs.some(
    (j) => j.status === 'converting' || j.status === 'completed' || j.status === 'error'
  );

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h2>Markdown to PDF</h2>
        <p>Render Markdown documents to a styled PDF — no external binary required.</p>
      </header>

      <div className={styles.content}>
        <section className={styles.leftPanel}>
          <DropZone
            isDragging={isDragging}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleBrowse}
            disabled={isConverting}
            icon="📄"
            label="Drag & drop Markdown files here"
            formats={['MD', 'Markdown', 'MDOWN', 'MKD']}
          />

          {jobs.length === 0 && (
            <p className={styles.emptyHint}>
              No files added yet. Drag Markdown files above or click to browse.
            </p>
          )}

          <FileList
            files={pendingFiles}
            onRemove={(id) => removeJob(id)}
            onClear={() => jobs.filter((j) => j.status === 'pending').forEach((j) => removeJob(j.id))}
          />

          {jobs.length > 0 && (
            <div className={styles.outputSection}>
              <label>Output Directory</label>
              <div className={styles.outputDir}>
                <span className={styles.dirPath}>{outputDir || 'Same as input'}</span>
                <button onClick={handleSelectOutputDir}>Change</button>
              </div>
            </div>
          )}

          {hasPending && (
            <button
              className={styles.convertBtn}
              onClick={handleConvert}
              disabled={isConverting}
            >
              {isConverting
                ? 'Converting...'
                : `Convert ${jobs.filter((j) => j.status === 'pending').length} file(s)`}
            </button>
          )}
        </section>

        <section className={styles.rightPanel}>
          <div className={styles.panel}>
            <label className={styles.sectionLabel}>Page</label>

            <div className={styles.group}>
              <label className={styles.label}>Page size</label>
              <div className={styles.chipRow}>
                {PAGE_SIZES.map((s) => (
                  <button
                    key={s}
                    className={`${styles.chip} ${pageSize === s ? styles.active : ''}`}
                    onClick={() => setPageSize(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.group}>
              <label className={styles.label}>Orientation</label>
              <div className={styles.chipRow}>
                <button
                  className={`${styles.chip} ${orientation === 'portrait' ? styles.active : ''}`}
                  onClick={() => setOrientation('portrait')}
                >
                  Portrait
                </button>
                <button
                  className={`${styles.chip} ${orientation === 'landscape' ? styles.active : ''}`}
                  onClick={() => setOrientation('landscape')}
                >
                  Landscape
                </button>
              </div>
            </div>

            <div className={styles.group}>
              <label className={styles.label}>Margins</label>
              <div className={styles.chipRow}>
                {MARGINS.map((m) => (
                  <button
                    key={m}
                    className={`${styles.chip} ${margin === m ? styles.active : ''}`}
                    onClick={() => setMargin(m)}
                  >
                    {m.charAt(0).toUpperCase() + m.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.panel}>
            <label className={styles.sectionLabel}>Theme</label>
            <div className={styles.chipRow}>
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  className={`${styles.chip} ${theme === t.id ? styles.active : ''}`}
                  onClick={() => setTheme(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <p className={styles.hint}>
              The theme sets the page background, text, and code colors. Backgrounds are
              preserved in the PDF.
            </p>
          </div>
        </section>
      </div>

      {hasActivity && (
        <MarkdownPdfQueue
          jobs={jobs}
          onCancel={cancelJob}
          onRemove={removeJob}
          onRetry={retryJob}
          onReveal={revealInFinder}
        />
      )}
    </div>
  );
}

export default MarkdownPdf;
