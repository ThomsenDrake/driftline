import { NextResponse } from 'next/server';

// Simple profanity filter list
const PROFANITY_WORDS = new Set([
  'fuck', 'shit', 'bitch', 'cunt', 'cock', 'dick', 'pussy', 'cunt', 'nigger', 
  'nigga', 'fag', 'faggot', 'whore', 'slut', 'bastard', 'douche', 'twat',
  'wanker', 'spastic', 'retard', 'chink', 'gook', 'kike', 'retard'
]);

// Check if text contains profanity
const containsProfanity = (text: string): boolean => {
  const words = text.toLowerCase().split(/\s+/);
  const profanityCount = words.filter(word => 
    PROFANITY_WORDS.has(word.replace(/[^\w]/g, ''))
  ).length;
  return profanityCount > words.length * 0.3; // More than 30% profanity
};

// Clean text for AI processing
const cleanText = (text: string): string => {
  return text
    .replace(/[^\w\s]/g, ' ') // Remove punctuation
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
    .substring(0, 200); // Limit length
};

export async function POST(req: Request) {
  try {
    const { samples } = await req.json();
    
    const apiKey = process.env.ZAI_API_KEY;
    
    // Validate input
    if (!Array.isArray(samples) || samples.length === 0) {
      return NextResponse.json({ 
        summary: 'quiet currents under restless streets' 
      });
    }

    // Filter and clean samples
    const validSamples = samples
      .filter((sample: {text?: string}) => sample.text && typeof sample.text === 'string')
      .slice(0, 40); // Limit to 40 samples

    if (validSamples.length === 0) {
      return NextResponse.json({ 
        summary: 'quiet currents under restless streets' 
      });
    }

    // Check for profanity
    const hasProfanity = validSamples.some((sample: {text: string}) =>
      containsProfanity(sample.text)
    );

    if (hasProfanity) {
      return NextResponse.json({ 
        summary: 'gentle whispers in the urban breeze' 
      });
    }

    // Prepare text for AI
    const cleanTexts = validSamples.map((sample: {text: string}) =>
      cleanText(sample.text)
    ).filter(text => text.length > 0);

    if (cleanTexts.length === 0) {
      return NextResponse.json({ 
        summary: 'quiet currents under restless streets' 
      });
    }

    const text = cleanTexts.join('\n');
    
    // Check if we have API key
    if (!apiKey) {
      console.warn('ZAI_API_KEY not found, using default summary');
      return NextResponse.json({ 
        summary: 'soft hope threaded through city static' 
      });
    }

    const prompt = `Given these short anonymous thoughts, write **one** evocative line (≤ 20 words) that captures the collective mood. Avoid clichés. Thoughts: ${text}`;

    try {
      const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: process.env.ZAI_MODEL || 'glm-4-5',
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 30,
          temperature: 0.7,
          stream: false
        })
      });

      if (!response.ok) {
        console.error('Z.ai API error:', response.status, response.statusText);
        return NextResponse.json({ 
          summary: 'soft hope threaded through city static' 
        });
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      
      if (content && typeof content === 'string') {
        // Clean and validate the response
        const summary = content
          .trim()
          .replace(/^["']|["']$/g, '') // Remove quotes
          .replace(/\s+/g, ' ') // Normalize whitespace
          .substring(0, 100); // Limit length
        
        // Ensure it's not too long and is meaningful
        if (summary.length > 3 && summary.length <= 20) {
          return NextResponse.json({ summary });
        }
      }

      return NextResponse.json({ 
        summary: 'soft hope threaded through city static' 
      });
    } catch (error) {
      console.error('Z.ai API call failed:', error);
      return NextResponse.json({ 
        summary: 'soft hope threaded through city static' 
      });
    }
  } catch (error) {
    console.error('Vibe summary API error:', error);
    return NextResponse.json({ 
      summary: 'quiet currents under restless streets' 
    });
  }
}