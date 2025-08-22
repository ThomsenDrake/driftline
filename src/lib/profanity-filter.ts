// Simple but effective profanity filter
const PROFANITY_WORDS = [
  'fuck', 'shit', 'bitch', 'cunt', 'cock', 'dick', 'pussy', 'cunt',
  'nigger', 'nigga', 'fag', 'faggot', 'whore', 'slut', 'bastard',
  'asshole', 'douche', 'twat', 'wanker', 'spastic', 'retard',
  'chink', 'gook', 'kike', 'spic', 'wetback', 'beaner',
  'tranny', 'shemale', 'hermaphrodite', 'midget', 'retard'
];

// Case-insensitive matching with word boundaries
const PROFANITY_REGEX = new RegExp(
  '\\b(' + PROFANITY_WORDS.map(word => 
    word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
  ).join('|') + ')\\b',
  'gi'
);

export function containsProfanity(text: string): boolean {
  return PROFANITY_REGEX.test(text);
}

export function filterProfanity(text: string): { filtered: string; hasProfanity: boolean } {
  const filtered = text.replace(PROFANITY_REGEX, '***');
  return {
    filtered,
    hasProfanity: filtered !== text
  };
}

export function getProfanityMatch(text: string): string[] {
  const matches = text.match(PROFANITY_REGEX);
  return matches || [];
}