
import { GoogleGenAI, Type } from "@google/genai";
import { NodeType, AgentResponse } from '../types';

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

// --- Agent Interaction ---

export const chatWithAgent = async (
  userMessage: string,
  currentMapData: any[]
): Promise<AgentResponse> => {
  if (!apiKey) {
      throw new Error("API Key missing");
  }

  const systemInstruction = `
    You are a Mind Map Assistant (思维助理). You can converse with the user and also MODIFY the mind map directly.
    
    You have access to the current state of the mind map (Nodes with IDs, Types, Content).
    
    Your Capabilities:
    1. Answer questions based on the mind map context.
    2. Suggest improvements.
    3. Execute operations to ADD, UPDATE, or DELETE nodes.

    Output Format:
    You must output JSON with two fields:
    - "reply": A string containing your conversational response to the user (in Simplified Chinese).
    - "operations": An array of operation objects.
    
    Operations Types:
    1. ADD_CHILD: { "action": "ADD_CHILD", "parentId": "ID_OF_PARENT", "nodeType": "TYPE", "content": "TEXT" }
       - Note: Use "type" rules (Topic -> Problem -> Hypothesis -> Action -> Evidence).
    2. UPDATE_CONTENT: { "action": "UPDATE_CONTENT", "nodeId": "ID_OF_NODE", "content": "NEW_TEXT" }
    3. DELETE_NODE: { "action": "DELETE_NODE", "nodeId": "ID_OF_NODE" }

    Constraint:
    - Only perform operations if the user explicitly asks for changes or if it adds significant value.
    - If just chatting, return "operations": [].
    - Refer to nodes by their exact IDs provided in the context.
    - CRITICAL: DO NOT repeat or echo the input mind map data in your response. The response must be concise and only contain the 'reply' and 'operations'.
  `;

  const prompt = `
    Current Mind Map State (Flat List):
    ${JSON.stringify(currentMapData, null, 2)}

    User Message:
    "${userMessage}"
  `;

  try {
      const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
              systemInstruction: systemInstruction,
              responseMimeType: "application/json",
              responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                      reply: { type: Type.STRING },
                      operations: {
                          type: Type.ARRAY,
                          items: {
                              type: Type.OBJECT,
                              properties: {
                                  action: { type: Type.STRING, enum: ['ADD_CHILD', 'UPDATE_CONTENT', 'DELETE_NODE'] },
                                  parentId: { type: Type.STRING },
                                  nodeId: { type: Type.STRING },
                                  nodeType: { type: Type.STRING, enum: ['topic', 'problem', 'hypothesis', 'action', 'evidence'] },
                                  content: { type: Type.STRING }
                              },
                              required: ['action']
                          }
                      }
                  },
                  required: ['reply', 'operations']
              }
          }
      });

      let text = response.text;
      if (!text) throw new Error("Empty response from Agent");
      
      text = cleanJsonText(text);
      const parsed = JSON.parse(text) as AgentResponse;
      return parsed;
  } catch (error) {
      console.error("Agent Error:", error);
      return {
          reply: "抱歉，我在处理您的请求时遇到了问题 (JSON Parse Error)。请尝试减少思维导图的大小或重试。",
          operations: []
      };
  }
}
