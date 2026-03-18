import OpenAI from "openai";

export interface StructuredAnalysisRequest<T> {
  name: string;
  instructions: string;
  input: string;
  schema: Record<string, unknown>;
  model?: string;
  reasoningEffort?: "low" | "medium" | "high";
}

export class OpenAIStructuredAnalyzer {
  private readonly client: OpenAI;
  private readonly defaultModel: string;

  constructor(options: { apiKey?: string; model?: string } = {}) {
    const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is required for OpenAI-powered analysis.");
    }

    this.client = new OpenAI({ apiKey });
    this.defaultModel = options.model ?? process.env.OPENAI_MODEL ?? "gpt-5-mini";
  }

  async analyze<T>(request: StructuredAnalysisRequest<T>): Promise<T> {
    const response = await this.client.responses.create({
      model: request.model ?? this.defaultModel,
      instructions: request.instructions,
      input: request.input,
      reasoning: {
        effort: request.reasoningEffort ?? "low"
      },
      text: {
        format: {
          type: "json_schema",
          name: request.name,
          schema: request.schema,
          strict: true
        }
      }
    } as any);

    const outputText = response.output_text?.trim();
    if (!outputText) {
      throw new Error("OpenAI response did not include structured output text.");
    }

    return JSON.parse(outputText) as T;
  }
}
