import type { ComponentType } from 'react';
import type { MessageKey } from '@shared/i18n';
import AudioConverter from './components/tools/AudioConverter/AudioConverter';
import AudioSplitter from './components/tools/AudioSplitter/AudioSplitter';
import VoiceRecorder from './components/tools/VoiceRecorder/VoiceRecorder';
import MarkdownPdf from './components/tools/MarkdownPdf/MarkdownPdf';
import JsonFormatter from './components/tools/JsonFormatter/JsonFormatter';

export interface ToolEntry {
  id: string;
  name: MessageKey;
  description: MessageKey;
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
    name: 'tools.audioConverter.name',
    description: 'tools.audioConverter.description',
    component: AudioConverter,
  },
  {
    id: 'audio-splitter',
    name: 'tools.audioSplitter.name',
    description: 'tools.audioSplitter.description',
    component: AudioSplitter,
  },
  {
    id: 'voice-recorder',
    name: 'tools.voiceRecorder.name',
    description: 'tools.voiceRecorder.description',
    component: VoiceRecorder,
  },
  {
    id: 'markdown-pdf',
    name: 'tools.markdownPdf.name',
    description: 'tools.markdownPdf.description',
    component: MarkdownPdf,
  },
  {
    id: 'json-formatter',
    name: 'tools.jsonFormatter.name',
    description: 'tools.jsonFormatter.description',
    component: JsonFormatter,
  },
];

export function getToolById(id: string): ToolEntry | undefined {
  return TOOL_REGISTRY.find((tool) => tool.id === id);
}
