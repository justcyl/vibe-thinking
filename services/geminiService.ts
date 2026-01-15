
import { GoogleGenAI, Type } from "@google/genai";
import { NodeType } from '../types';

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

const modelName = 'gemini-2.5-flash';

const cleanJsonText = (text: string) => {
  return text.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/```\s*$/, '').trim();
};

export const generateBrainstormIdeas = async (
  parentNodeContent: string,
  parentNodeType: NodeType,
  contextTrace: string[]
): Promise<{ type: NodeType; content: string }[]> => {
  
  if (!apiKey) {
    console.error("API Key is missing");
    return [];
  }

  const systemInstruction = `You are a rigorous logical thinking assistant using a specific 5-stage thought framework.
  All output must be in Simplified Chinese.
  
  Strict Node Definitions & Rules:

  1. TOPIC (主题)
     - Definition: The context/boundary. The container of thought.
     - Syntax: Declarative.
  
  2. PROBLEM (难题/挑战)
     - Definition: Current Blockers (cannot proceed) or Future Risks (will fail). The gap between reality and goal.
     - Syntax: Question (How/Why) OR Negative Declaration.
     - Flow: Usually follows TOPIC or EVIDENCE.

  3. HYPOTHESIS (假说/设想)
     - Definition: Subjective prediction/answer to a PROBLEM. A "simulation" in the mind. Not a fact yet.
     - Syntax: Declarative (Judgment/Assertion).
     - Flow: Must follow PROBLEM.

  4. ACTION (行动/实验)
     - Definition: Concrete step to verify the HYPOTHESIS. Must be actionable and produce EVIDENCE.
     - Syntax: Imperative (Verb-Object).
     - Flow: Must follow HYPOTHESIS.

  5. EVIDENCE (事实/证据)
     - Definition: Objective result/data from an ACTION. Neutral observation. Anchors/Verifies the HYPOTHESIS.
     - Syntax: Declarative (Fact).
     - Flow: Must follow ACTION.

  Goal: Generate 3-4 logical child nodes based on the Parent Node.
  
  Logical Flow Rules:
  - If Parent is TOPIC -> Suggest PROBLEMS (What prevents this topic from succeeding?).
  - If Parent is PROBLEM -> Suggest HYPOTHESES (Possible solutions or root causes).
  - If Parent is HYPOTHESIS -> Suggest ACTIONS (How to prove this is true?).
  - If Parent is ACTION -> Suggest potential EVIDENCE (What results might we see? Simulated outcomes).
  - If Parent is EVIDENCE -> Suggest derived PROBLEM (New issues found) or Refined HYPOTHESIS.

  Keep content concise (under 20 words).
  `;

  const prompt = `
  Context Path:
  ${contextTrace.join(' -> ')}

  Parent Node Type: ${parentNodeType}
  Parent Node Content: "${parentNodeContent}"

  Generate 3-4 next logical steps following the "Logical Flow Rules" above.
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              type: {
                type: Type.STRING,
                enum: [
                  NodeType.TOPIC,
                  NodeType.PROBLEM,
                  NodeType.HYPOTHESIS,
                  NodeType.ACTION,
                  NodeType.EVIDENCE,
                ]
              },
              content: {
                type: Type.STRING,
              }
            },
            required: ["type", "content"]
          }
        }
      }
    });

    let text = response.text;
    if (!text) return [];
    
    text = cleanJsonText(text);
    const data = JSON.parse(text);
    
    if (!Array.isArray(data)) {
        console.warn("Gemini response was not an array:", data);
        return [];
    }

    return data;

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};
