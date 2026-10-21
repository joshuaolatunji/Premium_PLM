import { sanitizeRichText } from "../../utils/richText";

interface RichTextContentProps {
  html: string;
  emptyText?: string;
}

// Shows text written in RichTextEditor, read-only. The HTML is sanitised
// first, so nothing typed or pasted into a document can run as code here.
function RichTextContent({ html, emptyText = "—" }: RichTextContentProps) {
  const clean = sanitizeRichText(html);

  if (!clean.trim()) {
    return <div className="rich-text-content rich-text-content--empty">{emptyText}</div>;
  }

  return <div className="rich-text-content" dangerouslySetInnerHTML={{ __html: clean }} />;
}

export default RichTextContent;
