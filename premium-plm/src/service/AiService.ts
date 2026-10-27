// "Generate with AI" for a document's Description (PID / FRD / BRD / SWR).
//
// Writes a first draft from what's already known: the initiative, the BDO's
// discovery notes and the document's Overview (author, sponsor, user group,
// product manager, introduction). The PM then edits it like any other text.
//
// Two ways to reach the model:
//   1. The backend (preferred): POST api/ai/generate-document-content, which
//      keeps the Gemini key on the server (gaps file M19). Switch on with
//      AI_BACKEND_AVAILABLE once it exists.
//   2. Until then, for development only: straight to Google's Gemini API with
//      VITE_GEMINI_API_KEY from .env. Anything in a VITE_ variable is built
//      into the JavaScript the browser downloads, so anyone using the site
//      could read the key — never set it on Netlify or any shared build.

import DOMPurify from "dompurify";

import { apiClient } from "../apicalls/apiClient";
import { getToken } from "../apicalls/authStorage";
import { DOCUMENT_META } from "../types/documentTypes";
import type { DocumentOverview, DocumentType } from "../types/documentTypes";
import { unwrapData, readString, isRecord } from "../utils/apiShape";

const AI_BACKEND_AVAILABLE = false;

const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
const GEMINI_MODEL = (import.meta.env.VITE_GEMINI_MODEL as string | undefined) || "gemini-2.5-flash";

export interface DocumentAiContext {
  type: DocumentType;
  initiative: {
    projectName: string;
    description: string;
    priority: string;
    timelineDays: number | null;
  };
  discovery: {
    businessLogic: string;
    userFlow: string;
  } | null;
  overview: DocumentOverview;
}

export function isAiAvailable(): boolean {
  return AI_BACKEND_AVAILABLE || Boolean(GEMINI_KEY);
}

// The sections each document is expected to have.
const OUTLINES: Record<DocumentType, string[]> = {
  PID: [
    "Purpose and background",
    "Objectives",
    "Scope (in scope and out of scope)",
    "Deliverables",
    "Stakeholders and roles",
    "Timeline and milestones",
    "Risks, assumptions and dependencies",
    "Success criteria",
  ],
  FRD: [
    "Overview",
    "User roles",
    "Functional requirements (numbered FR-1, FR-2, …)",
    "User flows",
    "Business rules and validations",
    "Data requirements",
    "Integrations",
    "Non-functional requirements",
    "Acceptance criteria",
  ],
  BRD: [
    "Executive summary",
    "Business problem",
    "Business objectives",
    "Project scope (in scope and out of scope)",
    "Stakeholders",
    "Business requirements (numbered BR-1, BR-2, …)",
    "Assumptions and constraints",
    "Risks",
    "Success measures",
  ],
  SWR: [
    "Work overview",
    "Standards and guidelines to follow",
    "Work items",
    "Roles and responsibilities",
    "Quality checks",
    "Deliverables and acceptance",
    "Timeline",
  ],
};

const SYSTEM_INSTRUCTION = [
  "You write formal product documentation for PremiumTrust Bank, a Nigerian commercial bank.",
  "Write clear, specific, professional content grounded only in the details provided. Where a detail is missing, write a sensible placeholder in square brackets, e.g. [confirm the go-live date], rather than inventing facts, figures, names or dates.",
  "Return only an HTML fragment: use <h2> for the document title, <h3> for numbered section headings, and <p>, <ul>, <ol>, <li>, <strong>, <em> and <table> (with <tr>, <th>, <td>) where useful.",
  "Do not use Markdown, code fences, <html>, <head>, <body>, <style>, scripts, images or links.",
].join(" ");

function buildPrompt(context: DocumentAiContext): string {
  const { type, initiative, discovery, overview } = context;
  const name = DOCUMENT_META[type].name;
  const line = (label: string, value: string | number | null | undefined) =>
    `${label}: ${value === null || value === undefined || value === "" ? "(not provided)" : value}`;

  return [
    `Write the Description section of a ${name} (${type}).`,
    "",
    "Initiative",
    line("Project name", initiative.projectName),
    line("Description", initiative.description),
    line("Priority", initiative.priority),
    line("Timeline (days)", initiative.timelineDays),
    "",
    "Business Development Officer's discovery notes",
    line("Description", discovery?.businessLogic),
    line("User flow", discovery?.userFlow),
    "",
    `${type} overview`,
    line("Author", overview.author),
    line("Sponsor", overview.sponsor),
    line("User group", overview.userGroup),
    line("Product manager", overview.productManager),
    line("Introduction", overview.introduction),
    "",
    `Start with <h2>${name} (${type})</h2>, then cover these sections in order, numbered:`,
    ...OUTLINES[type].map((section, index) => `${index + 1}. ${section}`),
  ].join("\n");
}

// Removes ```html fences the model sometimes adds anyway, and anything that
// isn't plain formatted text.
function cleanHtml(raw: string): string {
  const unfenced = raw.replace(/^\s*```(?:html)?\s*/i, "").replace(/\s*```\s*$/, "");

  return DOMPurify.sanitize(unfenced, {
    ALLOWED_TAGS: ["h1", "h2", "h3", "h4", "p", "ul", "ol", "li", "strong", "em", "b", "i", "u", "br", "table", "thead", "tbody", "tr", "th", "td", "blockquote"],
    ALLOWED_ATTR: ["colspan", "rowspan"],
  }).trim();
}

async function generateWithBackend(context: DocumentAiContext): Promise<string> {
  const body = await apiClient<unknown>("api/ai/generate-document-content", {
    method: "POST",
    token: getToken() ?? undefined,
    body: JSON.stringify(context),
  });

  const data = unwrapData(body);
  const html = typeof data === "string" ? data : isRecord(data) ? readString(data, "html", "contentHtml", "content") : null;

  if (!html) {
    throw new Error("The AI service didn't return any text.");
  }

  return html;
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  error?: { message?: string };
}

async function generateWithGemini(context: DocumentAiContext): Promise<string> {
  let response: Response;

  try {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_KEY as string },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents: [{ role: "user", parts: [{ text: buildPrompt(context) }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 8192 },
      }),
    });
  } catch {
    throw new Error("Couldn't reach the AI service. Check your connection and try again.");
  }

  const result = (await response.json().catch(() => ({}))) as GeminiResponse;

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error("The AI service is busy or the free quota is used up. Try again in a minute.");
    }

    throw new Error(result.error?.message || `The AI service returned an error (${response.status}).`);
  }

  if (result.promptFeedback?.blockReason) {
    throw new Error("The AI service declined to write this. Adjust the Overview and try again.");
  }

  const text = result.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";

  if (!text.trim()) {
    throw new Error("The AI service didn't return any text. Try again.");
  }

  return text;
}

// The generated Description, as HTML ready for the editor.
export async function generateDocumentDescription(context: DocumentAiContext): Promise<string> {
  if (!isAiAvailable()) {
    throw new Error("Generate with AI isn't set up yet.");
  }

  const raw = AI_BACKEND_AVAILABLE ? await generateWithBackend(context) : await generateWithGemini(context);
  const html = cleanHtml(raw);

  if (!html) {
    throw new Error("The AI service didn't return usable text. Try again.");
  }

  return html;
}
