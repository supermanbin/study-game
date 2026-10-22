export interface Fact { a: number; b: number } // 1 <= a <= b <= 9
export type FactKey = `${number}x${number}`;
export type QuestionKind = 'mul' | 'reverse' | 'div' | 'mulAddSub';
export type StatKey = `${FactKey}:${QuestionKind}`;
export type LevelId = 1 | 2 | 3 | 4 | 5 | 6;
