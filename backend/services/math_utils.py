import re
import logging

logger = logging.getLogger("edxiom.math_utils")


def clean_latex_math(text: str) -> str:
    """
    Sanitize LaTeX math and structure in LLM-generated Markdown notes.
    - Prevents unclosed $$ or $ delimiters from swallowing headers, tables, or sections into red error blobs.
    - Un-mashes Markdown structural elements (separators, headers, tables).
    - Converts raw bracketed environments into valid KaTeX display math.
    - Fixes collapsed row breaks in matrix environments.
    """
    if not text or not isinstance(text, str):
        return text or ""

    cleaned = text

    # 0. Convert HTML <br> tags to standard <br/> for rehype-raw
    cleaned = re.sub(r'<br\s*/?>', '<br/>', cleaned, flags=re.IGNORECASE)

    # 1. Un-mash structural markdown elements glued on single lines (e.g. --- ### Header or Header | Col1 | Col2)
    cleaned = re.sub(r'(---\s*)(#{1,6}\s+)', r'\1\n\n\2', cleaned)
    cleaned = re.sub(r'(#{1,6}\s+[^|\n]+)\s*(\|\s*[^|\n]+\|)', r'\1\n\n\2', cleaned)

    # 2. Replace explicit block math wrapped in brackets: [ \begin{env} ... \end{env} ] => $$\begin{env} ... \end{env}$$
    cleaned = re.sub(
        r'\[\s*(\\begin\{(?:cases|bmatrix|pmatrix|vmatrix|matrix|align|equation|alignat|flalign)\}.*?\\end\{(?:cases|bmatrix|pmatrix|vmatrix|matrix|align|equation|alignat|flalign)\})\s*\]',
        r'\n$$\n\1\n$$\n',
        cleaned,
        flags=re.DOTALL | re.IGNORECASE
    )

    # 3. Replace explicit block math wrapped in parens: ( \begin{env} ... \end{env} ) => $$\begin{env} ... \end{env}$$
    cleaned = re.sub(
        r'\(\s*(\\begin\{(?:cases|bmatrix|pmatrix|vmatrix|matrix|align|equation|alignat|flalign)\}.*?\\end\{(?:cases|bmatrix|pmatrix|vmatrix|matrix|align|equation|alignat|flalign)\})\s*\)',
        r'\n$$\n\1\n$$\n',
        cleaned,
        flags=re.DOTALL | re.IGNORECASE
    )

    # 4. Replace \[ ... \] => $$ ... $$
    cleaned = re.sub(r'\\\[\s*(.*?)\s*\\\]', r'\n$$\n\1\n$$\n', cleaned, flags=re.DOTALL)

    # 5. Fix collapsed single backslashes \\ in matrix environments
    def fix_matrix_rows(match):
        env_text = match.group(0)
        return re.sub(r'(?<=[^\\])\\\s+(?=[a-zA-Z0-9\-\\_\\|\$]|\\(?:dots|vdots|ddots|qquad|quad|a|b|c|x|y|z))', r' \\\\ ', env_text)

    cleaned = re.sub(
        r'\\begin\{(?:cases|bmatrix|pmatrix|vmatrix|matrix|align)\}.*?\\end\{(?:cases|bmatrix|pmatrix|vmatrix|matrix|align)\}',
        fix_matrix_rows,
        cleaned,
        flags=re.DOTALL | re.IGNORECASE
    )

    # 6. CRITICAL SAFETY ISOLATION: Prevent unclosed $$ or $ from leaking across headers, separators, tables, or double newlines!
    paragraphs = cleaned.split('\n\n')
    fixed_paragraphs = []

    for para in paragraphs:
        lines = para.split('\n')
        fixed_lines = []
        in_block_math = False

        for line in lines:
            is_structure_element = (
                line.strip().startswith('#') or 
                line.strip().startswith('---') or 
                line.strip().startswith('|')
            )

            # If a structural header/table line is encountered while block math is open, force-close block math!
            if is_structure_element and in_block_math:
                fixed_lines.append('$$')
                in_block_math = False

            double_dollars = line.count('$$')
            if double_dollars % 2 != 0:
                in_block_math = not in_block_math

            fixed_lines.append(line)

        # If a paragraph ends while block math is still open, force-close it before starting next paragraph!
        if in_block_math:
            fixed_lines.append('$$')
            in_block_math = False

        fixed_paragraphs.append('\n'.join(fixed_lines))

    return '\n\n'.join(fixed_paragraphs)
