import data from '../../content/voice-lines.json';

export type VoiceCategory =
  | 'correct' | 'combo3' | 'combo5' | 'combo10' | 'wrong' | 'missed'
  | 'levelPass' | 'levelFail' | 'threeStars' | 'bossAppear' | 'bossDefeated' | 'itemGet';

export const VOICE_CATEGORIES: VoiceCategory[] = [
  'correct', 'combo3', 'combo5', 'combo10', 'wrong', 'missed',
  'levelPass', 'levelFail', 'threeStars', 'bossAppear', 'bossDefeated', 'itemGet',
];

export const VOICE_LINES: Record<VoiceCategory, { id: string; text: string }[]> = data.lines;

export function voicePath(id: string): string {
  return `audio/voice/${id}.mp3`;
}
