import { useState, useCallback, useEffect } from 'react';
import { useImageProcessor } from '../../../hooks/useImageProcessor';
import { useFileDrop } from '../../../hooks/useFileDrop';
import { useI18n } from '../../../hooks/useI18n';
import {
  IMAGE_FORMAT_CHOICES,
  IMAGE_INPUT_EXTENSIONS,
  type ImageFormatChoice,
} from '@shared/imageFormats';
import type { MessageKey } from '@shared/i18n';
import type { WatermarkMode, WatermarkPosition } from '@shared/types';
import DropZone from '../../common/DropZone';
import FileList from '../../common/FileList';
import ImageQueue from './ImageQueue';
import ToolHeader from '../../common/ToolHeader';
import styles from './ImageProcessor.module.css';

/** 0 = keep the original size. */
const MAX_EDGES = [0, 4096, 2560, 1920, 1280, 800];

const FORMAT_KEYS: Record<ImageFormatChoice, MessageKey> = {
  auto: 'image.formatAuto',
  jpg: 'image.formatJpg',
  png: 'image.formatPng',
  webp: 'image.formatWebp',
};

const WM_MODES: WatermarkMode[] = ['none', 'text', 'image'];
const WM_MODE_KEYS: Record<WatermarkMode, MessageKey> = {
  none: 'image.wmNone',
  text: 'image.wmText',
  image: 'image.wmImage',
};

/** Row-major 3×3 anchor picker — cells map straight to WatermarkPosition. */
const POSITIONS: WatermarkPosition[] = [
  'top-left',
  'top-center',
  'top-right',
  'center-left',
  'center',
  'center-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
];

function ImageProcessor() {
  const { t } = useI18n();
  const {
    jobs,
    isProcessing,
    ffmpegReady,
    addFiles,
    startProcessing,
    retryJob,
    cancelJob,
    removeJob,
    revealInFinder,
    buildOptions,
  } = useImageProcessor();

  const [format, setFormat] = useState<ImageFormatChoice>('auto');
  const [quality, setQuality] = useState(85);
  const [maxEdge, setMaxEdge] = useState(0);

  const [wmMode, setWmMode] = useState<WatermarkMode>('none');
  const [wmText, setWmText] = useState('');
  const [fontSize, setFontSize] = useState(48);
  const [color, setColor] = useState('#ffffff');
  const [logoPath, setLogoPath] = useState('');
  const [logoScale, setLogoScale] = useState(0.25);
  const [position, setPosition] = useState<WatermarkPosition>('bottom-right');
  const [margin, setMargin] = useState(20);
  const [opacity, setOpacity] = useState(0.8);

  const [outputDir, setOutputDir] = useState('');

  const buildCurrentOptions = useCallback(
    () =>
      buildOptions(
        format,
        quality,
        maxEdge,
        {
          mode: wmMode,
          text: wmText,
          imagePath: logoPath,
          scale: logoScale,
          fontSize,
          color,
          position,
          margin,
          opacity,
        },
        outputDir || ''
      ),
    [
      buildOptions,
      format,
      quality,
      maxEdge,
      wmMode,
      wmText,
      logoPath,
      logoScale,
      fontSize,
      color,
      position,
      margin,
      opacity,
      outputDir,
    ]
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
    const files = await window.electronAPI.selectInputFiles('image');
    if (files.length > 0) {
      await addFiles(files, buildCurrentOptions());
    }
  }, [addFiles, buildCurrentOptions]);

  const handleSelectOutputDir = useCallback(async () => {
    const dir = await window.electronAPI.selectOutputDir();
    if (dir) setOutputDir(dir);
  }, []);

  const handleChooseLogo = useCallback(async () => {
    const files = await window.electronAPI.selectInputFiles('image');
    if (files[0]) setLogoPath(files[0]);
  }, []);

  const handleProcess = useCallback(() => {
    startProcessing(buildCurrentOptions());
  }, [startProcessing, buildCurrentOptions]);

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
    IMAGE_INPUT_EXTENSIONS
  );

  const pendingFiles = jobs
    .filter((j) => j.status === 'pending')
    .map((j) => ({ id: j.id, name: j.fileName }));

  const pendingCount = jobs.filter((j) => j.status === 'pending').length;
  const hasPending = pendingCount > 0;
  const hasActivity = jobs.some(
    (j) => j.status === 'converting' || j.status === 'completed' || j.status === 'error'
  );
  const qualityIgnored = format === 'png';

  return (
    <div className={styles.container}>
      <ToolHeader
        title={t('tools.imageProcessor.title')}
        subtitle={t('tools.imageProcessor.subtitle')}
        number="06"
      />

      {ffmpegReady === false && (
        <div className={styles.warning}>{t('warnings.ffmpegMissing')}</div>
      )}

      <div className={styles.content}>
        <section className={styles.leftPanel}>
          <DropZone
            isDragging={isDragging}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleBrowse}
            disabled={isProcessing}
            icon="🖼"
            label={t('dropzone.imageLabel')}
            formats={['JPG', 'PNG', 'WebP', 'GIF', 'BMP', 'TIFF']}
          />

          {jobs.length === 0 && <p className={styles.emptyHint}>{t('files.emptyImage')}</p>}

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
            <button className={styles.convertBtn} onClick={handleProcess} disabled={isProcessing}>
              {isProcessing ? t('actions.processing') : t('actions.process', { count: pendingCount })}
            </button>
          )}
        </section>

        <section className={styles.rightPanel}>
          <div className={styles.panel}>
            <label className={styles.sectionLabel}>{t('parameters.title')}</label>

            <div className={styles.group}>
              <label className={styles.label}>{t('image.format')}</label>
              <div className={styles.chipRow}>
                {IMAGE_FORMAT_CHOICES.map((choice) => (
                  <button
                    key={choice}
                    className={`${styles.chip} ${format === choice ? styles.active : ''}`}
                    onClick={() => setFormat(choice)}
                  >
                    {t(FORMAT_KEYS[choice])}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.group}>
              <label className={styles.label}>{t('image.quality')}</label>
              <input
                type="range"
                min={1}
                max={100}
                value={quality}
                disabled={qualityIgnored}
                onChange={(e) => setQuality(Number(e.target.value))}
                className={styles.slider}
              />
              <p className={styles.value}>{quality}</p>
              <p className={styles.hint}>
                {qualityIgnored ? t('image.losslessHint') : t('image.qualityHint')}
              </p>
            </div>

            <div className={styles.group}>
              <label className={styles.label}>{t('image.resize')}</label>
              <div className={styles.chipRow}>
                {MAX_EDGES.map((edge) => (
                  <button
                    key={edge}
                    className={`${styles.chip} ${maxEdge === edge ? styles.active : ''}`}
                    onClick={() => setMaxEdge(edge)}
                  >
                    {edge === 0 ? t('image.edgeOriginal') : `${edge} ${t('image.edgeSuffix')}`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.panel}>
            <label className={styles.sectionLabel}>{t('image.watermark')}</label>

            <div className={styles.chipRow}>
              {WM_MODES.map((mode) => (
                <button
                  key={mode}
                  className={`${styles.chip} ${wmMode === mode ? styles.active : ''}`}
                  onClick={() => setWmMode(mode)}
                >
                  {t(WM_MODE_KEYS[mode])}
                </button>
              ))}
            </div>

            {wmMode === 'text' && (
              <div className={styles.group}>
                <label className={styles.label}>{t('image.textLabel')}</label>
                <input
                  type="text"
                  className={styles.textInput}
                  value={wmText}
                  placeholder={t('image.textPlaceholder')}
                  onChange={(e) => setWmText(e.target.value)}
                />
                <div className={styles.row}>
                  <div className={styles.field}>
                    <label className={styles.label}>{t('image.fontSize')}</label>
                    <input
                      type="number"
                      min={12}
                      max={400}
                      className={styles.numberInput}
                      value={fontSize}
                      onChange={(e) => setFontSize(Number(e.target.value) || 12)}
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>{t('image.color')}</label>
                    <input
                      type="color"
                      className={styles.colorInput}
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {wmMode === 'image' && (
              <div className={styles.group}>
                <label className={styles.label}>{t('image.logoLabel')}</label>
                <div className={styles.logoRow}>
                  <span className={styles.logoName}>
                    {logoPath ? logoPath.split('/').pop() : t('output.noneSelected')}
                  </span>
                  <button onClick={handleChooseLogo}>{t('image.chooseLogo')}</button>
                </div>
                <label className={styles.label}>{t('image.logoScale')}</label>
                <input
                  type="range"
                  min={5}
                  max={100}
                  value={Math.round(logoScale * 100)}
                  onChange={(e) => setLogoScale(Number(e.target.value) / 100)}
                  className={styles.slider}
                />
                <p className={styles.hint}>
                  {t('image.logoScaleValue', { n: Math.round(logoScale * 100) })}
                </p>
              </div>
            )}

            {wmMode !== 'none' && (
              <>
                <div className={styles.group}>
                  <label className={styles.label}>{t('image.position')}</label>
                  <div className={styles.posGrid}>
                    {POSITIONS.map((pos) => (
                      <button
                        key={pos}
                        aria-label={pos}
                        className={`${styles.posCell} ${position === pos ? styles.active : ''}`}
                        onClick={() => setPosition(pos)}
                      />
                    ))}
                  </div>
                </div>

                <div className={styles.row}>
                  <div className={styles.field}>
                    <label className={styles.label}>{t('image.margin')}</label>
                    <input
                      type="number"
                      min={0}
                      max={500}
                      className={styles.numberInput}
                      value={margin}
                      onChange={(e) => setMargin(Math.max(0, Number(e.target.value) || 0))}
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>{t('image.opacity')}</label>
                    <input
                      type="range"
                      min={10}
                      max={100}
                      value={Math.round(opacity * 100)}
                      onChange={(e) => setOpacity(Number(e.target.value) / 100)}
                      className={styles.slider}
                    />
                    <p className={styles.value}>{Math.round(opacity * 100)}%</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      </div>

      {hasActivity && (
        <ImageQueue
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

export default ImageProcessor;
