/**
 * Pre-processes markdown text containing LaTeX math equations to ensure clean KaTeX rendering.
 * Prevents unclosed $$ or $ delimiters from swallowing headers, tables, or sections into red error blobs.
 */
export const cleanLatexMath = (text) => {
  if (!text || typeof text !== 'string') return '';

  let cleaned = text;

  // 0. Convert HTML <br> tags to standard <br/> for rehype-raw
  cleaned = cleaned.replace(/<br\s*\/?>/gi, '<br/>');

  // 1. Un-mash structural markdown elements glued on single lines (e.g. --- ### Header or Header | Col1 | Col2)
  cleaned = cleaned.replace(/(---\s*)(#{1,6}\s+)/g, '$1\n\n$2');
  cleaned = cleaned.replace(/(#{1,6}\s+[^|\n]+)\s*(\|\s*[^|\n]+\|)/g, '$1\n\n$2');

  // 2. Replace explicit block math wrapped in brackets: [ \begin{env} ... \end{env} ] => $$\begin{env} ... \end{env}$$
  cleaned = cleaned.replace(
    /\[\s*(\\begin\{(?:cases|bmatrix|pmatrix|vmatrix|matrix|align|equation|alignat|flalign)\}[\s\S]*?\\end\{(?:cases|bmatrix|pmatrix|vmatrix|matrix|align|equation|alignat|flalign)\})\s*\]/gi,
    '\n$$\n$1\n$$\n'
  );

  // 3. Replace explicit block math wrapped in parens: ( \begin{env} ... \end{env} ) => $$\begin{env} ... \end{env}$$
  cleaned = cleaned.replace(
    /\(\s*(\\begin\{(?:cases|bmatrix|pmatrix|vmatrix|matrix|align|equation|alignat|flalign)\}[\s\S]*?\\end\{(?:cases|bmatrix|pmatrix|vmatrix|matrix|align|equation|alignat|flalign)\})\s*\)/gi,
    '\n$$\n$1\n$$\n'
  );

  // 4. Replace \[ ... \] => $$ ... $$
  cleaned = cleaned.replace(/\\\[\s*([\s\S]*?)\s*\\\]/g, '\n$$\n$1\n$$\n');

  // 5. Fix collapsed single backslashes \\ in matrix environments
  cleaned = cleaned.replace(
    /(\\begin\{(?:cases|bmatrix|pmatrix|vmatrix|matrix|align)\}[\s\S]*?\\end\{(?:cases|bmatrix|pmatrix|vmatrix|matrix|align)\})/gi,
    (match) => {
      return match.replace(/(?<=[^\\])\\\s+(?=[a-zA-Z0-9\-\\_\\|\$]|\\(?:dots|vdots|ddots|qquad|quad|a|b|c|x|y|z))/g, ' \\\\ ');
    }
  );

  // 6. CRITICAL SAFETY ISOLATION: Prevent unclosed $$ or $ from leaking across headers, separators, tables, or double newlines!
  const paragraphs = cleaned.split('\n\n');
  const fixedParagraphs = [];

  for (const para of paragraphs) {
    const lines = para.split('\n');
    const fixedLines = [];
    let inBlockMath = false;

    for (const line of lines) {
      const trimmed = line.trim();
      const isStructureElement = trimmed.startsWith('#') || trimmed.startsWith('---') || trimmed.startsWith('|');

      if (isStructureElement && inBlockMath) {
        fixedLines.push('$$');
        inBlockMath = false;
      }

      const doubleDollars = (line.match(/\$\$/g) || []).length;
      if (doubleDollars % 2 !== 0) {
        inBlockMath = !inBlockMath;
      }

      fixedLines.push(line);
    }

    if (inBlockMath) {
      fixedLines.push('$$');
      inBlockMath = false;
    }

    fixedParagraphs.push(fixedLines.join('\n'));
  }

  return fixedParagraphs.join('\n\n');
};
