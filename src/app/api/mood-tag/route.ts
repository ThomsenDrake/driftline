import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// Simple rule-based mood detection as fallback
function detectMoodSimple(text: string): string {
  const lowerText = text.toLowerCase();
  
  // Positive moods
  if (/(happy|joy|excited|amazing|wonderful|great|love|beautiful|fantastic|awesome|perfect|brilliant|excellent)/.test(lowerText)) {
    return 'happy';
  }
  if (/(peaceful|calm|relaxed|serene|tranquil|quiet|zen)/.test(lowerText)) {
    return 'peaceful';
  }
  if (/(grateful|thankful|blessed|appreciate|content)/.test(lowerText)) {
    return 'content';
  }
  if (/(energetic|pumped|motivated|active|dynamic)/.test(lowerText)) {
    return 'energetic';
  }
  
  // Negative moods
  if (/(sad|depressed|down|upset|disappointed|hurt|crying|tears)/.test(lowerText)) {
    return 'sad';
  }
  if (/(angry|mad|furious|pissed|irritated|annoyed|rage)/.test(lowerText)) {
    return 'angry';
  }
  if (/(worried|anxious|nervous|scared|afraid|stress|panic)/.test(lowerText)) {
    return 'anxious';
  }
  if (/(frustrated|frustrating|annoying|difficult|struggle|hard|tough)/.test(lowerText)) {
    return 'frustrated';
  }
  if (/(tired|exhausted|drained|weary|sleepy)/.test(lowerText)) {
    return 'tired';
  }
  
  // Nostalgic/reflective
  if (/(remember|memory|past|used to|miss|nostalgia|childhood)/.test(lowerText)) {
    return 'nostalgic';
  }
  if (/(hope|hopeful|future|dream|wish|possibility)/.test(lowerText)) {
    return 'hopeful';
  }
  
  return 'neutral';
}

export async function POST(req: Request) {
  const { text } = await req.json();
  if (!text) return NextResponse.json({ mood: 'neutral' });

  // Try Z.AI API first if available
  const apiKey = process.env.ZAI_API_KEY;
  if (apiKey) {
    try {
      const client = new OpenAI({
        apiKey: apiKey,
        baseURL: "https://api.z.ai/api/paas/v4/"
      });

      const completion = await client.chat.completions.create({
        model: process.env.ZAI_MODEL || 'glm-4.5',
        messages: [
          { 
            role: "system", 
            content: "Respond with exactly one lowercase word that describes the emotional tone: happy, sad, excited, angry, peaceful, anxious, hopeful, frustrated, content, joyful, worried, calm, energetic, nostalgic, etc." 
          },
          { 
            role: "user", 
            content: `Analyze this text: "${text}"` 
          }
        ],
        max_tokens: 10,
        temperature: 0.1
      });

      const content = completion.choices[0].message.content;
      
      if (content && typeof content === 'string' && content.trim()) {
        const words = content.toLowerCase().trim().replace(/[^\w\s]/g, '').split(/\s+/);
        const moodWords = ['happy', 'sad', 'excited', 'angry', 'peaceful', 'anxious', 'hopeful', 'frustrated', 'content', 'joyful', 'worried', 'calm', 'energetic', 'nostalgic', 'melancholy'];
        const foundMood = words.find(word => moodWords.includes(word));
        
        if (foundMood) {
          return NextResponse.json({ mood: foundMood });
        }
      }
    } catch (error) {
      console.warn('Z.AI API failed, falling back to rule-based detection:', error);
    }
  }

  // Fallback to rule-based detection
  const mood = detectMoodSimple(text);
  return NextResponse.json({ mood });
}