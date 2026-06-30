import type { AudioFormat } from './types';

export const AUDIO_FORMATS: AudioFormat[] = [
  {
    id: 'mp3',
    name: 'MP3',
    extension: 'mp3',
    mimeType: 'audio/mpeg',
    defaultBitrate: 192,
    defaultSampleRate: 44100,
    defaultChannels: 2,
    supportsBitrate: true,
    supportsVbr: false,
  },
  {
    id: 'aac',
    name: 'AAC',
    extension: 'm4a',
    mimeType: 'audio/mp4',
    defaultBitrate: 192,
    defaultSampleRate: 44100,
    defaultChannels: 2,
    supportsBitrate: true,
    supportsVbr: false,
  },
  {
    id: 'flac',
    name: 'FLAC',
    extension: 'flac',
    mimeType: 'audio/flac',
    defaultSampleRate: 44100,
    defaultChannels: 2,
    supportsBitrate: false,
    supportsVbr: false,
  },
  {
    id: 'wav',
    name: 'WAV',
    extension: 'wav',
    mimeType: 'audio/wav',
    defaultSampleRate: 44100,
    defaultChannels: 2,
    supportsBitrate: false,
    supportsVbr: false,
  },
  {
    id: 'ogg',
    name: 'OGG Vorbis',
    extension: 'ogg',
    mimeType: 'audio/ogg',
    defaultBitrate: 192,
    defaultSampleRate: 44100,
    defaultChannels: 2,
    supportsBitrate: true,
    supportsVbr: false,
  },
  {
    id: 'opus',
    name: 'Opus',
    extension: 'opus',
    mimeType: 'audio/opus',
    defaultBitrate: 128,
    defaultSampleRate: 48000,
    defaultChannels: 2,
    supportsBitrate: true,
    supportsVbr: true,
  },
  {
    id: 'm4a',
    name: 'M4A (ALAC)',
    extension: 'm4a',
    mimeType: 'audio/mp4',
    defaultSampleRate: 44100,
    defaultChannels: 2,
    supportsBitrate: false,
    supportsVbr: false,
  },
];

export const SUPPORTED_INPUT_EXTENSIONS = [
  'mp3', 'aac', 'flac', 'wav', 'ogg', 'opus', 'm4a', 'wma',
  'aiff', 'au', 'raw', 'oga', 'ogv', 'spx', 'oga'
];

export const BITRATE_PRESETS = [64, 96, 128, 160, 192, 256, 320];

export const SAMPLE_RATES = [22050, 44100, 48000, 96000];

export function getFormatById(id: string): AudioFormat | undefined {
  return AUDIO_FORMATS.find(f => f.id === id);
}
