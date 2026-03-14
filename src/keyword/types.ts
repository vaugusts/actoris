export interface KeywordStep {
  keyword: string;
  args?: Record<string, unknown>;
}

export interface KeywordScenario {
  id: string;
  name: string;
  channel: "keyword";
  driver?: string;
  dataKey?: string;
  steps: KeywordStep[];
}

export interface KeywordExecutionState {
  data: Record<string, unknown>;
  variables: Record<string, unknown>;
}
