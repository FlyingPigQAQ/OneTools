import { useState, useCallback, useEffect } from 'react';
import { useMarkdownPdf } from '../../../hooks/useMarkdownPdf';
import { useFileDrop } from '../../../hooks/useFileDrop';
import { useI18n } from '../../../hooks/useI18n';
import { MARKDOWN_EXTENSIONS } from '@shared/markdown';
import type { MessageKey } from '@shared/i18n';
import DropZone from '../../common/DropZone';
import FileList from '../../common/FileList';
import MarkdownPdfQueue from './MarkdownPdfQueue';
import type { PdfPageSize, PdfOrientation, PdfMargin, MarkdownTheme } from '@shared/types';
import ToolHeader from '../../common/ToolHeader';
import styles from './MarkdownPdf.module.css';

const PAGE_SIZES: PdfPageSize[] = ['A4', 'Letter', 'Legal'];
const MARGINS: PdfMargin[] = ['normal', 'narrow', 'none'];
const THEMES: MarkdownTheme[] = ['light', 'sepia', 'dark'];

const MARGIN_KEYS: Record<PdfMargin, MessageKey> = {
  normal: 'markdown.marginNormal',
  narrow: 'markdown.marginNarrow',
  none: 'markdown.marginNone',
};

const THEME_KEYS: Record<MarkdownTheme, MessageKey> = {
  light: 'markdown.themeLight',
  sepia: 'markdown.themeSepia',
  dark: 'markdown.themeDark',
};

function MarkdownPdf() {
  const { t } = useI18n();
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
      <ToolHeader
        title={t('tools.markdownPdf.title')}
        subtitle={t('tools.markdownPdf.subtitle')}
        number="04"
      />

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
            label={t('dropzone.markdownLabel')}
            formats={['MD', 'Markdown', 'MDOWN', 'MKD']}
          />

          {jobs.length === 0 && (
            <p className={styles.emptyHint}>{t('files.emptyMarkdown')}</p>
          )}

          <FileList
            files={pendingFiles}
            onRemove={(id) => removeJob(id)}
            onClear={() => jobs.filter((j) => j.status === 'pending').forEach((j) => removeJob(j.id))}
          />

          {jobs.length > 0 && (
            <div className={styles.outputSection}>
              <label>{t('output.directory')}</label>
              <div className={styles.outputDir}>
                <span className={styles.dirPath}>{outputDir || t('output.sameAsInput')}</span>
                <button onClick={handleSelectOutputDir}>{t('output.change')}</button>
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
                ? t('actions.converting')
                : t('actions.convert', {
                    count: jobs.filter((j) => j.status === 'pending').length,
                  })}
            </button>
          )}
        </section>

        <section className={styles.rightPanel}>
          <div className={styles.panel}>
            <label className={styles.sectionLabel}>{t('markdown.page')}</label>

            <div className={styles.group}>
              <label className={styles.label}>{t('markdown.pageSize')}</label>
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
              <label className={styles.label}>{t('markdown.orientation')}</label>
              <div className={styles.chipRow}>
                <button
                  className={`${styles.chip} ${orientation === 'portrait' ? styles.active : ''}`}
                  onClick={() => setOrientation('portrait')}
                >
                  {t('markdown.portrait')}
                </button>
                <button
                  className={`${styles.chip} ${orientation === 'landscape' ? styles.active : ''}`}
                  onClick={() => setOrientation('landscape')}
                >
                  {t('markdown.landscape')}
                </button>
              </div>
            </div>

            <div className={styles.group}>
              <label className={styles.label}>{t('markdown.margins')}</label>
              <div className={styles.chipRow}>
                {MARGINS.map((marginId) => (
                  <button
                    key={marginId}
                    className={`${styles.chip} ${margin === marginId ? styles.active : ''}`}
                    onClick={() => setMargin(marginId)}
                  >
                    {t(MARGIN_KEYS[marginId])}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.panel}>
            <label className={styles.sectionLabel}>{t('markdown.theme')}</label>
            <div className={styles.chipRow}>
              {THEMES.map((themeId) => (
                <button
                  key={themeId}
                  className={`${styles.chip} ${theme === themeId ? styles.active : ''}`}
                  onClick={() => setTheme(themeId)}
                >
                  {t(THEME_KEYS[themeId])}
                </button>
              ))}
            </div>
            <p className={styles.hint}>{t('markdown.themeHint')}</p>
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
