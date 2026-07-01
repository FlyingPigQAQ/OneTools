import type { ToolDefinition } from '@shared/types';

class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  register(tool: ToolDefinition): void {
    this.tools.set(tool.id, tool);
  }

  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  getById(id: string): ToolDefinition | undefined {
    return this.tools.get(id);
  }

  unregister(id: string): boolean {
    return this.tools.delete(id);
  }
}

export const toolRegistry = new ToolRegistry();

// Register built-in tools
toolRegistry.register({
  id: 'audio-converter',
  name: 'Audio Converter',
  icon: 'music',
  description: 'Convert audio files between different formats',
});

toolRegistry.register({
  id: 'audio-splitter',
  name: 'Audio Splitter',
  icon: 'scissors',
  description: 'Split an audio file into parts by size or duration',
});

toolRegistry.register({
  id: 'markdown-pdf',
  name: 'Markdown to PDF',
  icon: 'file-text',
  description: 'Render Markdown documents to styled PDF',
});
