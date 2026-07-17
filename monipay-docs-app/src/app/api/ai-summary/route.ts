import { GoogleGenAI } from '@google/genai';
import { NextResponse } from 'next/server';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function POST(req: Request) {
  const { title, content } = await req.json();

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({
      bullets: [
        "Monipay is a non-custodial protocol.",
        "It enables gasless stablecoin payments.",
        "Built for merchants and AI agents."
      ],
      followUp: ["How do I set up a merchant account?", "What chains are supported?"]
    });
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are a technical documentation assistant for Monipay, a non-custodial stablecoin payment protocol.
      Summarize the following documentation page titled "${title}" in exactly 3 bullet points, each under 20 words. 
      Then suggest 2 follow-up questions a developer might have.
      
      Content:
      ${content.substring(0, 4000)}
      
      Return the result in JSON format:
      {
        "bullets": ["bullet 1", "bullet 2", "bullet 3"],
        "followUp": ["question 1", "question 2"]
      }`,
      config: {
        responseMimeType: 'application/json',
      }
    });

    const result = JSON.parse(response.text || '{}');
    return NextResponse.json(result);
  } catch (error) {
    console.error('AI Summary Error:', error);
    return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 });
  }
}
