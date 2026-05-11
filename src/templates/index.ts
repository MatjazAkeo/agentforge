import type { Graph } from '@/domain/graph';
import t01 from './data/01-hello-model.graph.json';
import t02 from './data/02-two-model-comparison.graph.json';
import t03 from './data/03-self-critique-fixed.graph.json';
import t04 from './data/04-rag-lite.graph.json';
import t05 from './data/05-raw-react-chat.graph.json';
import t06 from './data/06-encapsulated-agent-chat.graph.json';
import t07 from './data/07-vision-chat.graph.json';

export interface BundledTemplate {
  id: string;
  name: string;
  description: string;
  graph: Graph;
}

export const TEMPLATES: BundledTemplate[] = [
  { id: 'hello-model', name: 'Hello Model', description: 'The simplest run: Input → LLM Call → Output.', graph: t01 as unknown as Graph },
  { id: 'two-model-comparison', name: 'Two-Model Comparison', description: 'Same prompt, two models side by side.', graph: t02 as unknown as Graph },
  { id: 'self-critique', name: 'Self-Critique Loop', description: 'Reviser + Critic with conditional halt via Transform.', graph: t03 as unknown as Graph },
  { id: 'rag-lite', name: 'RAG-lite', description: 'Fetch a URL, prompt-template the question, agent answers.', graph: t04 as unknown as Graph },
  { id: 'raw-react-chat', name: 'Raw ReAct (chat)', description: 'Full ReAct loop unrolled: LC + LLM + Tool Runner.', graph: t05 as unknown as Graph },
  { id: 'encapsulated-agent-chat', name: 'Encapsulated Agent (chat)', description: 'Same behavior as raw ReAct, but with the Agent node.', graph: t06 as unknown as Graph },
  { id: 'vision-chat', name: 'Vision Chat', description: 'Drop screenshots / photos into the chat composer and ask about them.', graph: t07 as unknown as Graph },
];
