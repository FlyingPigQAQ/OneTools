import type { ComponentType } from 'react';
import AudioConverter from './components/tools/AudioConverter/AudioConverter';
import AudioSplitter from './components/tools/AudioSplitter/AudioSplitter';
import VoiceRecorder from './components/tools/VoiceRecorder/VoiceRecorder';
import MarkdownPdf from './components/tools/MarkdownPdf/MarkdownPdf';

export interface ToolEntry {
  id: string;
  name: string;
  description: string;
  component: ComponentType;
}

/**
 * The single source of truth for the app's tool list. The sidebar and the
 * content area both render from this registry, so adding a tool is a
 * one-line registration here — no shell edits needed.
 */
export const TOOL_REGISTRY: ToolEntry[] = [
  {
    id: 'audio-converter',
    name: 'Audio Converter',
    description: 'Convert audio files between formats',
    component: AudioConverter,
  },
  {
    id: 'audio-splitter',
    name: 'Audio Splitter',
    description: 'Split audio into parts by size or duration',
    component: AudioSplitter,
  },
  {
    id: 'voice-recorder',
    name: 'Voice Recorder',
    description: 'Record audio from your microphone',
    component: VoiceRecorder,
  },
  {
    id: 'markdown-pdf',
    name: 'Markdown to PDF',
    description: 'Render Markdown documents to PDF',
    component: MarkdownPdf,
  },
];

export function getToolById(id: string): ToolEntry | undefined {
  return TOOL_REGISTRY.find((tool) => tool.id === id);
}
