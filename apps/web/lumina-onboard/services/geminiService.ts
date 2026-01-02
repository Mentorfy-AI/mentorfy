
import { GoogleGenAI, Type } from "@google/genai";
import { Answers, AnalysisResult, Question } from "../types";

// Initialize the client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeProfile = async (
  answers: Answers,
  questions: Question[]
): Promise<AnalysisResult> => {
  
  // Construct a readable transcript of the Q&A
  const transcript = questions.map(q => {
    const answer = answers[q.id];
    let answerText = 'Skipped';
    
    if (Array.isArray(answer)) {
        answerText = answer.join(', ');
    } else if (answer !== null && answer !== undefined) {
        answerText = String(answer);
    }

    return `Question: ${q.text}\nAnswer: ${answerText}`;
  }).join('\n\n');

  const prompt = `
    You are an expert user onboarding specialist for a futuristic SaaS platform called "Lumina".
    Analyze the following user responses to generate a personalized welcome profile.
    
    User Responses:
    ${transcript}
    
    Please provide:
    1. A catchy, futuristic title for this user (e.g., "Visionary Architect", "Code Pioneer").
    2. A short, welcoming summary paragraph (under 50 words) explaining how Lumina helps them specifically.
    3. Three relevant "tags" or keywords describing their persona.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            summary: { type: Type.STRING },
            tags: { 
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["title", "summary", "tags"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    return JSON.parse(text) as AnalysisResult;
  } catch (error) {
    console.error("Gemini Analysis Failed:", error);
    // Fallback if API fails or key is missing
    return {
      title: "Lumina Explorer",
      summary: "Welcome to the future of work. We're excited to have you on board.",
      tags: ["New User", "Explorer", "Lumina"]
    };
  }
};
