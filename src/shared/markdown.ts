/**
 * Markdown file metadata shared by the renderer (drag-and-drop filtering) and
 * the main process (open-dialog filters). Kept in `shared` so both sides agree
 * on which extensions count as Markdown input.
 */
export const MARKDOWN_EXTENSIONS = ['md', 'markdown', 'mdown', 'mkd', 'mkdn', 'mdwn'];

export const MARKDOWN_DIALOG_FILTERS = [
  { name: 'Markdown Files', extensions: MARKDOWN_EXTENSIONS },
  { name: 'All Files', extensions: ['*'] },
];
