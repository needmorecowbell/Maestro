/**
 * wizardPrompts.ts
 *
 * System prompts and structured output parsing for the onboarding wizard's
 * AI-driven project discovery conversation.
 */

import { getRandomInitialQuestion } from './fillerPhrases';

/**
 * Structured response format expected from the agent
 */
export interface StructuredAgentResponse {
  /** Confidence level (0-100) indicating how well the agent understands the project */
  confidence: number;
  /** Whether the agent feels ready to proceed with document generation */
  ready: boolean;
  /** The agent's message to display to the user */
  message: string;
}

/**
 * Result of parsing an agent response
 */
export interface ParsedResponse {
  /** The parsed structured response, or null if parsing failed */
  structured: StructuredAgentResponse | null;
  /** The raw response text (for fallback display) */
  rawText: string;
  /** Whether parsing was successful */
  parseSuccess: boolean;
  /** Error message if parsing failed */
  parseError?: string;
}

/**
 * Existing document from a previous wizard session
 */
export interface ExistingDocument {
  /** Document filename */
  filename: string;
  /** Document content */
  content: string;
}

/**
 * Configuration for generating the system prompt
 */
export interface SystemPromptConfig {
  /** Agent/project name provided by the user */
  agentName: string;
  /** Directory path where the agent will work */
  agentPath: string;
  /** Existing Auto Run documents (when continuing from previous session) */
  existingDocs?: ExistingDocument[];
}

/**
 * JSON schema for structured output (for documentation and validation)
 */
export const STRUCTURED_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    confidence: {
      type: 'number',
      minimum: 0,
      maximum: 100,
      description: 'Confidence level (0-100) indicating how well you understand the project goals and requirements',
    },
    ready: {
      type: 'boolean',
      description: 'Whether you feel ready to create an action plan for this project',
    },
    message: {
      type: 'string',
      description: 'Your response message to the user (questions, clarifications, or confirmation)',
    },
  },
  required: ['confidence', 'ready', 'message'],
} as const;

/**
 * Suffix appended to each user message to remind the agent about JSON format
 */
export const STRUCTURED_OUTPUT_SUFFIX = `

IMPORTANT: Remember to respond ONLY with valid JSON in this exact format:
{"confidence": <0-100>, "ready": <true/false>, "message": "<your response>"}`;

/**
 * Default confidence level when parsing fails
 */
const DEFAULT_CONFIDENCE = 20;

/**
 * Threshold above which we consider the agent ready to proceed
 */
export const READY_CONFIDENCE_THRESHOLD = 80;

/**
 * Generate the system prompt for the wizard conversation
 *
 * @param config Configuration including agent name and path
 * @returns The complete system prompt for the agent
 */
export function generateSystemPrompt(config: SystemPromptConfig): string {
  const { agentName, agentPath, existingDocs } = config;
  const projectName = agentName || 'this project';

  // Build existing docs section if continuing from previous session
  let existingDocsSection = '';
  if (existingDocs && existingDocs.length > 0) {
    existingDocsSection = `

## Previous Planning Documents

The user is continuing a previous planning session. Below are the existing Auto Run documents that were created earlier. Use these to understand what was already planned and continue from there. Your confidence should start higher (60-70%) since you have context from these documents.

${existingDocs.map(doc => `### ${doc.filename}

${doc.content}
`).join('\n---\n\n')}

**Important:** When continuing from existing docs:
- Start with higher confidence (60-70%) since you already have context
- Review the existing plans and ask if anything has changed or needs updating
- Don't re-ask questions that are already answered in the documents
- Focus on validating the existing plan and filling in any gaps
`;
  }

  return `You are a friendly project discovery assistant helping to set up "${projectName}".

## Your Role

You are 🎼 Maestro's onboarding assistant, helping the user define their project so we can create an actionable plan.

## Working Directory

You will ONLY create or modify files within this directory:
${agentPath}

Do not reference, create, or modify files outside this path.

## Your Goal

Through a brief, focused conversation:
1. Understand what type of project this is (coding project, research notes, documentation, analysis, creative writing, etc.)
2. Learn the key goals or deliverables
3. Identify any specific technologies, frameworks, or constraints
4. Gather enough clarity to create an action plan

## Conversation Guidelines

- Keep exchanges minimal but purposeful
- Ask clarifying questions to understand scope and requirements
- Don't overwhelm with too many questions at once (1-3 questions per response)
- Be encouraging and helpful in tone
- Once you have enough clarity, indicate you're ready to proceed

## Response Format

You MUST respond with valid JSON in this exact format:
{"confidence": <number 0-100>, "ready": <boolean>, "message": "<your response>"}

### Field Explanations:

**confidence** (0-100): Your confidence in understanding the project well enough to create an action plan
- 0-20: Just started, minimal understanding
- 21-50: Basic understanding, need significant clarification
- 51-70: Good understanding, a few details to clarify
- 71-80: Solid understanding, minor clarifications helpful
- 81-100: Ready to proceed, clear picture of the project

**ready** (true/false): Set to true ONLY when:
- confidence >= ${READY_CONFIDENCE_THRESHOLD}
- You have enough information to create a meaningful action plan
- Key goals and deliverables are clear

**message**: Your conversational response to the user. This should:
- Be friendly and encouraging
- Ask relevant clarifying questions (if not ready)
- Summarize your understanding (when ready)
- Avoid technical jargon unless the project requires it

## Example Responses

Early conversation (low confidence):
{"confidence": 25, "ready": false, "message": "Nice to meet you! Let's figure out what you'd like to build.\\n\\nTo get started: What type of project is this? For example:\\n- A coding project (web app, CLI tool, library)?\\n- Research or documentation?\\n- Something else entirely?"}

Mid conversation (building understanding):
{"confidence": 55, "ready": false, "message": "A React dashboard for tracking fitness metrics - that sounds useful!\\n\\nA couple quick questions:\\n1. What data sources will it pull from? (API, manual entry, fitness tracker?)\\n2. Do you have a specific design or UI style in mind?"}

Ready to proceed (high confidence):
{"confidence": 92, "ready": true, "message": "I have a clear picture now!\\n\\nYou want to build a React dashboard that:\\n- Connects to a fitness tracker API\\n- Displays daily steps, calories, and workout history\\n- Uses a clean, minimal design with dark mode support\\n- Includes charts for weekly/monthly trends\\n\\nI'm ready to create your action plan. Shall we proceed?"}

## Important Notes

- Always output valid JSON - no markdown code blocks, no extra text
- Keep confidence scores realistic and progressive
- Don't set ready=true until confidence >= ${READY_CONFIDENCE_THRESHOLD}
- If the user is vague, ask specific questions to build clarity
- Remember: the goal is to gather enough info for a practical action plan${existingDocsSection}`;
}

/**
 * Parse a structured response from the agent
 *
 * Attempts to extract JSON from the response, with multiple fallback strategies
 * for common formatting issues (markdown code blocks, extra text, etc.)
 *
 * @param response The raw response string from the agent
 * @returns ParsedResponse with structured data or fallback handling
 */
export function parseStructuredOutput(response: string): ParsedResponse {
  const rawText = response.trim();

  // Strategy 1: Try direct JSON parse
  try {
    const parsed = JSON.parse(rawText);
    if (isValidStructuredResponse(parsed)) {
      return {
        structured: normalizeResponse(parsed),
        rawText,
        parseSuccess: true,
      };
    }
  } catch {
    // Continue to next strategy
  }

  // Strategy 2: Extract JSON from markdown code blocks
  const codeBlockMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    try {
      const parsed = JSON.parse(codeBlockMatch[1].trim());
      if (isValidStructuredResponse(parsed)) {
        return {
          structured: normalizeResponse(parsed),
          rawText,
          parseSuccess: true,
        };
      }
    } catch {
      // Continue to next strategy
    }
  }

  // Strategy 3: Find JSON object pattern in text
  const jsonMatch = rawText.match(/\{[\s\S]*"confidence"[\s\S]*"ready"[\s\S]*"message"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (isValidStructuredResponse(parsed)) {
        return {
          structured: normalizeResponse(parsed),
          rawText,
          parseSuccess: true,
        };
      }
    } catch {
      // Continue to next strategy
    }
  }

  // Strategy 4: Find any JSON object pattern
  const anyJsonMatch = rawText.match(/\{[^{}]*\}/);
  if (anyJsonMatch) {
    try {
      const parsed = JSON.parse(anyJsonMatch[0]);
      if (isValidStructuredResponse(parsed)) {
        return {
          structured: normalizeResponse(parsed),
          rawText,
          parseSuccess: true,
        };
      }
    } catch {
      // Continue to fallback
    }
  }

  // Fallback: Create a response from the raw text
  return createFallbackResponse(rawText);
}

/**
 * Check if an object matches the expected structured response format
 */
function isValidStructuredResponse(obj: unknown): obj is StructuredAgentResponse {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const response = obj as Record<string, unknown>;

  // Check required fields exist with correct types
  const hasConfidence = typeof response.confidence === 'number';
  const hasReady = typeof response.ready === 'boolean';
  const hasMessage = typeof response.message === 'string';

  return hasConfidence && hasReady && hasMessage;
}

/**
 * Normalize a response to ensure valid ranges and types
 */
function normalizeResponse(response: StructuredAgentResponse): StructuredAgentResponse {
  return {
    confidence: Math.max(0, Math.min(100, Math.round(response.confidence))),
    ready: response.ready && response.confidence >= READY_CONFIDENCE_THRESHOLD,
    message: response.message.trim(),
  };
}

/**
 * Create a fallback response when parsing fails
 * Uses heuristics to extract useful information from raw text
 */
function createFallbackResponse(rawText: string): ParsedResponse {
  // Try to extract confidence from text patterns like "confidence: 50" or "50% confident"
  let confidence = DEFAULT_CONFIDENCE;
  const confidenceMatch = rawText.match(/confidence[:\s]*(\d+)/i) ||
    rawText.match(/(\d+)\s*%?\s*confiden/i);
  if (confidenceMatch) {
    const extractedConfidence = parseInt(confidenceMatch[1], 10);
    if (extractedConfidence >= 0 && extractedConfidence <= 100) {
      confidence = extractedConfidence;
    }
  }

  // Try to detect ready status from text
  const readyPatterns = /\b(ready to proceed|ready to create|let's proceed|shall we proceed|i'm ready)\b/i;
  const notReadyPatterns = /\b(need more|clarif|question|tell me more|could you explain)\b/i;

  let ready = false;
  if (confidence >= READY_CONFIDENCE_THRESHOLD && readyPatterns.test(rawText)) {
    ready = true;
  }
  if (notReadyPatterns.test(rawText)) {
    ready = false;
  }

  // Use the raw text as the message, cleaning up any JSON artifacts
  let message = rawText
    .replace(/```(?:json)?/g, '')
    .replace(/```/g, '')
    .replace(/^\s*\{[\s\S]*?\}\s*$/g, '') // Remove complete JSON blocks
    .trim();

  // If message is empty after cleanup, use a generic fallback
  if (!message) {
    message = rawText;
  }

  return {
    structured: {
      confidence,
      ready,
      message,
    },
    rawText,
    parseSuccess: false,
    parseError: 'Could not parse structured JSON response, using fallback extraction',
  };
}

/**
 * Get the initial question to display before the first agent response.
 * Returns a randomly selected variant for variety.
 */
export function getInitialQuestion(): string {
  return getRandomInitialQuestion();
}

/**
 * Format a user message with the structured output suffix
 *
 * @param userMessage The user's message
 * @returns The message with JSON format reminder appended
 */
export function formatUserMessage(userMessage: string): string {
  return userMessage + STRUCTURED_OUTPUT_SUFFIX;
}

/**
 * Check if a response indicates the agent is ready to proceed
 *
 * @param response The parsed structured response
 * @returns Whether the agent is ready (confidence >= threshold and ready=true)
 */
export function isReadyToProceed(response: StructuredAgentResponse): boolean {
  return response.ready && response.confidence >= READY_CONFIDENCE_THRESHOLD;
}

/**
 * Get the color for the confidence meter based on the level
 *
 * @param confidence The confidence level (0-100)
 * @returns HSL color string transitioning from red to yellow to green
 */
export function getConfidenceColor(confidence: number): string {
  // Clamp confidence to 0-100
  const clampedConfidence = Math.max(0, Math.min(100, confidence));

  // Map confidence to hue: 0 (red) -> 60 (yellow) -> 120 (green)
  // 0-50 confidence: red (0) to yellow (60)
  // 50-100 confidence: yellow (60) to green (120)
  let hue: number;
  if (clampedConfidence <= 50) {
    hue = (clampedConfidence / 50) * 60; // 0 to 60
  } else {
    hue = 60 + ((clampedConfidence - 50) / 50) * 60; // 60 to 120
  }

  return `hsl(${hue}, 80%, 45%)`;
}

// Export combined wizardPrompts object for convenient importing
export const wizardPrompts = {
  generateSystemPrompt,
  parseStructuredOutput,
  getInitialQuestion,
  formatUserMessage,
  isReadyToProceed,
  getConfidenceColor,
  STRUCTURED_OUTPUT_SCHEMA,
  STRUCTURED_OUTPUT_SUFFIX,
  READY_CONFIDENCE_THRESHOLD,
};
