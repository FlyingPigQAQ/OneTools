import { describe, expect, it } from 'vitest';
import { IMAGE_INPUT_EXTENSIONS, resolveImageFormat } from './imageFormats';

describe('IMAGE_INPUT_EXTENSIONS', () => {
  it('accepts the common photo formats', () => {
    for (const ext of ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'tiff']) {
      expect(IMAGE_INPUT_EXTENSIONS).toContain(ext);
    }
    expect(IMAGE_INPUT_EXTENSIONS.every((e) => e === e.toLowerCase())).toBe(true);
  });
});

describe('resolveImageFormat', () => {
  it('honors an explicit format choice', () => {
    expect(resolveImageFormat('photo.png', 'jpg')).toBe('jpg');
    expect(resolveImageFormat('photo.jpg', 'png')).toBe('png');
    expect(resolveImageFormat('photo.png', 'webp')).toBe('webp');
  });

  it('keeps formats we can write when set to auto', () => {
    expect(resolveImageFormat('/tmp/a/photo.JPG', 'auto')).toBe('jpg');
    expect(resolveImageFormat('/tmp/a/photo.jpeg', 'auto')).toBe('jpg');
    expect(resolveImageFormat('/tmp/a/photo.png', 'auto')).toBe('png');
    expect(resolveImageFormat('/tmp/a/photo.webp', 'auto')).toBe('webp');
  });

  it('falls back to JPG for containers we do not write', () => {
    expect(resolveImageFormat('/tmp/a/anim.gif', 'auto')).toBe('jpg');
    expect(resolveImageFormat('/tmp/a/scan.tiff', 'auto')).toBe('jpg');
    expect(resolveImageFormat('/tmp/a/noextension', 'auto')).toBe('jpg');
  });
});
