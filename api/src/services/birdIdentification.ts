import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config";

const client = new Anthropic({ apiKey: config.anthropicApiKey });

const BIRD_IDENTIFICATION_SCHEMA = {
  type: "object",
  properties: {
    isBird: {
      type: "boolean",
      description:
        "Whether the image contains an identifiable bird, including well-known fictional, animatronic, costumed, or cartoon bird characters (e.g. Big Bird, Woodstock, Tweety).",
    },
    isFictionalOrCostume: {
      type: "boolean",
      description:
        "True when the subject is a fictional, animatronic, costumed, or cartoon bird character rather than a real species.",
    },
    commonName: {
      type: "string",
      description:
        "The most likely common name of the bird species, or the character's name if isFictionalOrCostume is true, or an empty string if isBird is false.",
    },
    scientificName: {
      type: "string",
      description:
        "The scientific (binomial) name of the species. If isFictionalOrCostume is true, a tongue-in-cheek pseudo-scientific binomial name instead. Empty string if isBird is false.",
    },
    confidence: {
      type: "string",
      enum: ["low", "medium", "high"],
      description: "Confidence in the primary identification.",
    },
    description: {
      type: "string",
      description:
        "A brief explanation of the identifying features observed in the image. If isFictionalOrCostume is true, write this in the voice of a delighted nature documentary narrator who has just spotted a rare specimen — have fun with it.",
    },
    alternativePossibilities: {
      type: "array",
      description: "Other plausible species, ordered by likelihood, when the identification is uncertain.",
      items: {
        type: "object",
        properties: {
          commonName: { type: "string" },
          scientificName: { type: "string" },
          reason: { type: "string", description: "Why this species is also plausible." },
        },
        required: ["commonName", "scientificName", "reason"],
        additionalProperties: false,
      },
    },
  },
  required: [
    "isBird",
    "isFictionalOrCostume",
    "commonName",
    "scientificName",
    "confidence",
    "description",
    "alternativePossibilities",
  ],
  additionalProperties: false,
} as const;

export type SupportedImageMimeType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

export interface BirdIdentification {
  isBird: boolean;
  isFictionalOrCostume: boolean;
  commonName: string;
  scientificName: string;
  confidence: "low" | "medium" | "high";
  description: string;
  alternativePossibilities: Array<{
    commonName: string;
    scientificName: string;
    reason: string;
  }>;
}

export async function identifyBird(
  imageBuffer: Buffer,
  mimeType: SupportedImageMimeType,
): Promise<BirdIdentification> {
  const response = await client.messages.create({
    // Cheapest tier that supports structured outputs. No `effort` param —
    // it isn't supported on Haiku 4.5, and this model doesn't spend tokens
    // on internal thinking unless explicitly configured, which keeps
    // per-request cost down for this bounded classification task.
    model: "claude-haiku-4-5",
    max_tokens: 512,
    output_config: {
      format: {
        type: "json_schema",
        schema: BIRD_IDENTIFICATION_SCHEMA,
      },
    },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mimeType,
              data: imageBuffer.toString("base64"),
            },
          },
          {
            type: "text",
            text: "Identify the bird species in this image. If no bird is present, set isBird to false. If the image shows a well-known fictional, animatronic, costumed, or cartoon bird character (e.g. Big Bird from Sesame Street) rather than a real animal, still set isBird to true and isFictionalOrCostume to true, identify the character by name, and follow the schema's guidance for a humorous, in-character description.",
          },
        ],
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("The model declined to process this image.");
  }

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response received from the model.");
  }

  return JSON.parse(textBlock.text) as BirdIdentification;
}
