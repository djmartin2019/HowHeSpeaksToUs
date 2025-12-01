import { documentToHtmlString } from "@contentful/rich-text-html-renderer";
import type { Document } from "@contentful/rich-text-types";
import { BLOCKS, INLINES, MARKS } from "@contentful/rich-text-types";

/**
 * Render Contentful Rich Text to HTML
 * Handles both Rich Text documents and plain text strings
 */
export function renderRichText(
  document: Document | any,
  customOptions?: any
): string {
  if (!document) {
    return "";
  }

  // If it's a plain text string, format it as HTML with markdown parsing
  if (typeof document === "string") {
    return parseMarkdownToHtml(document);
  }

  // Check if it's a Rich Text document
  const isRichTextDocument =
    document.nodeType === "document" ||
    (document.content &&
      Array.isArray(document.content) &&
      document.content.length > 0);

  if (!isRichTextDocument) {
    console.warn("Content is not a recognized Rich Text document format");
    return "";
  }

  // Default render options for Rich Text
  const defaultRenderNode = {
    [BLOCKS.PARAGRAPH]: (node: any, next: any) => {
      const text = next(node.content);
      // Don't render empty paragraphs
      if (!text || text.trim() === "") {
        return "";
      }
      return `<p class="text-gray-800 mb-4 leading-relaxed">${text}</p>`;
    },
    [BLOCKS.HEADING_1]: (node: any, next: any) =>
      `<h1 class="text-4xl font-bold text-black mt-8 mb-4">${next(
        node.content
      )}</h1>`,
    [BLOCKS.HEADING_2]: (node: any, next: any) =>
      `<h2 class="text-3xl font-bold text-black mt-8 mb-4">${next(
        node.content
      )}</h2>`,
    [BLOCKS.HEADING_3]: (node: any, next: any) =>
      `<h3 class="text-2xl font-bold text-black mt-6 mb-3">${next(
        node.content
      )}</h3>`,
    [BLOCKS.HEADING_4]: (node: any, next: any) =>
      `<h4 class="text-xl font-semibold text-black mt-6 mb-3">${next(
        node.content
      )}</h4>`,
    [BLOCKS.HEADING_5]: (node: any, next: any) =>
      `<h5 class="text-lg font-semibold text-black mt-4 mb-2">${next(
        node.content
      )}</h5>`,
    [BLOCKS.HEADING_6]: (node: any, next: any) =>
      `<h6 class="text-base font-semibold text-black mt-4 mb-2">${next(
        node.content
      )}</h6>`,
    [BLOCKS.UL_LIST]: (node: any, next: any) =>
      `<ul class="list-disc list-inside mb-4 space-y-2 text-gray-800">${next(
        node.content
      )}</ul>`,
    [BLOCKS.OL_LIST]: (node: any, next: any) =>
      `<ol class="list-decimal list-inside mb-4 space-y-2 text-gray-800">${next(
        node.content
      )}</ol>`,
    [BLOCKS.LIST_ITEM]: (node: any, next: any) =>
      `<li class="mb-2">${next(node.content)}</li>`,
    [BLOCKS.QUOTE]: (node: any, next: any) =>
      `<blockquote class="border-l-4 border-black pl-6 py-2 my-6 italic text-gray-800">${next(
        node.content
      )}</blockquote>`,
    [BLOCKS.HR]: () => `<hr class="my-8 border-t-2 border-gray-300">`,
    [BLOCKS.EMBEDDED_ASSET]: (node: any) => {
      const asset = node.data?.target;
      if (asset?.fields?.file) {
        const imageUrl = `https:${asset.fields.file.url}`;
        const alt = asset.fields.title || "";
        return `<img src="${imageUrl}" alt="${alt}" class="w-full h-auto my-6" loading="lazy" />`;
      }
      return "";
    },
    [INLINES.HYPERLINK]: (node: any, next: any) => {
      const url = node.data.uri;
      const text = next(node.content);
      return `<a href="${url}" class="text-black underline hover:no-underline" target="_blank" rel="noopener noreferrer">${text}</a>`;
    },
    [INLINES.ENTRY_HYPERLINK]: (node: any, next: any) => {
      // Handle entry hyperlinks if needed
      return next(node.content);
    },
  };

  const defaultRenderMark = {
    [MARKS.BOLD]: (text: string) =>
      `<strong class="font-bold">${text}</strong>`,
    [MARKS.ITALIC]: (text: string) => `<em class="italic">${text}</em>`,
    [MARKS.UNDERLINE]: (text: string) => `<u>${text}</u>`,
    [MARKS.CODE]: (text: string) =>
      `<code class="bg-gray-100 text-black px-2 py-1 rounded text-sm font-mono">${text}</code>`,
  };

  // Merge custom options with defaults
  const renderOptions = {
    renderNode: {
      ...defaultRenderNode,
      ...(customOptions?.renderNode || {}),
    },
    renderMark: {
      ...defaultRenderMark,
      ...(customOptions?.renderMark || {}),
    },
  };

  try {
    return documentToHtmlString(document, renderOptions);
  } catch (error) {
    console.error("Error rendering rich text:", error);
    return "";
  }
}

/**
 * Parse markdown-like text to HTML
 */
function parseMarkdownToHtml(text: string): string {
  if (!text) return "";

  try {
    const lines = text.split("\n");
    const result: string[] = [];
    let inList = false;
    let listType: "ul" | "ol" | null = null;
    let listItems: string[] = [];
    let scriptureBuffer: string[] = [];

    function closeList() {
      if (inList && listItems.length > 0) {
        const tag = listType === "ol" ? "ol" : "ul";
        const listClass =
          tag === "ol"
            ? "list-decimal list-inside mb-4 space-y-2 text-gray-800"
            : "list-disc list-inside mb-4 space-y-2 text-gray-800";
        const itemsHtml = listItems
          .map(
            (item) => `<li class="mb-2">${processInlineFormatting(item)}</li>`
          )
          .join("");
        result.push(`<${tag} class="${listClass}">${itemsHtml}</${tag}>`);
        listItems = [];
        inList = false;
        listType = null;
      }
    }

    function flushScripture() {
      if (scriptureBuffer.length > 0) {
        const scriptureText = scriptureBuffer.join(" ");
        result.push(
          `<blockquote class="border-l-4 border-black pl-6 py-2 my-6 italic text-gray-800"><p class="mb-0">${processInlineFormatting(
            scriptureText
          )}</p></blockquote>`
        );
        scriptureBuffer = [];
      }
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const nextLine = i < lines.length - 1 ? lines[i + 1].trim() : "";

      // Check for headings wrapped in __ (like __🌟 God's Invitation__)
      if (line.startsWith("__") && line.endsWith("__")) {
        closeList();
        flushScripture();
        const headingText = line.slice(2, -2).trim();
        // Remove bold markers but keep content
        const cleanHeading = headingText.replace(/^__|__$/g, "");
        result.push(
          `<h2 class="text-3xl font-bold text-black mt-8 mb-4">${processInlineFormatting(
            cleanHeading,
            false
          )}</h2>`
        );
        continue;
      }

      // Check for markdown headings (check ### before ## before # to avoid conflicts)
      if (line.startsWith("### ")) {
        closeList();
        flushScripture();
        result.push(
          `<h3 class="text-2xl font-bold text-black mt-6 mb-3">${processInlineFormatting(
            line.replace(/^###\s+/, ""),
            false
          )}</h3>`
        );
        continue;
      }
      if (line.startsWith("## ")) {
        closeList();
        flushScripture();
        result.push(
          `<h2 class="text-3xl font-bold text-black mt-8 mb-4">${processInlineFormatting(
            line.replace(/^##\s+/, ""),
            false
          )}</h2>`
        );
        continue;
      }
      // Check for single # heading (H1) - must be exactly "# " not "## " or "### "
      // Since we've already checked for ### and ## above, we just need to check it starts with "# "
      if (line.startsWith("# ") && !line.startsWith("##")) {
        closeList();
        flushScripture();
        result.push(
          `<h1 class="text-4xl font-bold text-black mt-8 mb-6">${processInlineFormatting(
            line.replace(/^#\s+/, ""),
            false
          )}</h1>`
        );
        continue;
      }

      // Check for all caps headings (like SCRIPTURAL REFERENCES:)
      // Only match if it's NOT already a markdown heading and ends with colon
      if (
        !line.startsWith("#") &&
        line.match(/^[A-Z\s:]+$/) &&
        line.endsWith(":")
      ) {
        closeList();
        flushScripture();
        result.push(
          `<h3 class="text-2xl font-bold text-black mt-8 mb-4">${processInlineFormatting(
            line,
            false
          )}</h3>`
        );
        continue;
      }

      // Check for scripture references (quotes followed by citations)
      // Scripture typically starts with a quote and has a citation with em dash
      // Handle both regular quotes (") and smart quotes ("")
      const hasQuote =
        line.startsWith('"') || line.startsWith('"') || line.startsWith('"');
      const hasCitation =
        (line.includes("—") || line.includes("–") || line.includes("-")) &&
        line.match(/[A-Za-z]+\s+\d+:\s*\d+/);
      const isCitationLine = line.match(/^[—–-]\s*[A-Za-z]+\s+\d+:/);

      if (hasQuote || hasCitation || isCitationLine) {
        closeList();
        scriptureBuffer.push(line);

        // If this line has a citation, we're done with this scripture
        if (hasCitation || isCitationLine) {
          flushScripture();
        }
        // If next line is a citation, wait for it
        else if (
          nextLine &&
          (nextLine.match(/^[—–-]\s*[A-Za-z]+\s+\d+:/) ||
            nextLine.match(/^[—–-]/) ||
            (nextLine.match(/^—/) && nextLine.match(/[A-Za-z]+\s+\d+:/)))
        ) {
          // Continue to collect citation on next line
        }
        // Otherwise, flush if we have content
        else {
          flushScripture();
        }
        continue;
      }

      // If we're collecting scripture and this might be a continuation
      if (scriptureBuffer.length > 0) {
        if (
          isCitationLine ||
          line.match(/^[—–-]/) ||
          (line.startsWith('"') && !line.match(/^[A-Z]/))
        ) {
          scriptureBuffer.push(line);
          flushScripture();
          continue;
        } else {
          // Not a continuation, flush what we have
          flushScripture();
        }
      }

      // Skip empty lines
      if (!line) {
        closeList();
        flushScripture();
        continue;
      }

      // Check for numbered lists (1. 2. 3.)
      const numberedMatch = line.match(/^(\d+)\.\s+(.+)$/);
      if (numberedMatch) {
        flushScripture();
        if (!inList || listType !== "ol") {
          closeList();
          inList = true;
          listType = "ol";
        }
        listItems.push(numberedMatch[2]);
        continue;
      }

      // Check for bullet lists (-, *, •)
      const bulletMatch = line.match(/^[-*•]\s+(.+)$/);
      if (bulletMatch) {
        flushScripture();
        if (!inList || listType !== "ul") {
          closeList();
          inList = true;
          listType = "ul";
        }
        listItems.push(bulletMatch[1]);
        continue;
      }

      // Regular paragraph
      closeList();
      flushScripture();
      result.push(
        `<p class="text-gray-800 mb-4 leading-relaxed">${processInlineFormatting(
          line
        )}</p>`
      );
    }

    // Close any remaining list or scripture
    closeList();
    flushScripture();

    return result.join("");
  } catch (error) {
    console.error("Error parsing markdown:", error);
    // Return escaped text as fallback
    return `<div class="p-4 bg-yellow-50 border border-yellow-200 rounded">
      <p class="text-yellow-800">Error parsing content. Showing raw text:</p>
      <pre class="mt-2 text-sm text-yellow-700 whitespace-pre-wrap">${escapeHtml(
        text
      )}</pre>
    </div>`;
  }
}

/**
 * Process inline formatting (bold, italic, etc.)
 */
function processInlineFormatting(
  text: string,
  processBold: boolean = true
): string {
  if (typeof text !== "string") return "";

  let html = escapeHtml(text);

  if (processBold) {
    // Handle bold: __text__ or **text**
    // Match __text__ but be careful with headings that already use __
    html = html.replace(
      /__([^_\n]+?)__/g,
      '<strong class="font-bold">$1</strong>'
    );
    html = html.replace(
      /\*\*([^*\n]+?)\*\*/g,
      '<strong class="font-bold">$1</strong>'
    );
  }

  // Handle italic: _text_ or *text* (but not if it's part of bold)
  // Only match single underscores/asterisks that aren't part of double ones
  html = html.replace(/(?<!_)_([^_\n]+?)_(?!_)/g, '<em class="italic">$1</em>');
  html = html.replace(
    /(?<!\*)\*([^*\n]+?)\*(?!\*)/g,
    '<em class="italic">$1</em>'
  );

  return html;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  if (typeof text !== "string") return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
