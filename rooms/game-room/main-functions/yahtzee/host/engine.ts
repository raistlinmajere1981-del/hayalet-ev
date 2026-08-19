export const YAHTZEE_SCHEMA_VERSION = 1;
export const YAHTZEE_DICE_COUNT = 5;
export const YAHTZEE_MAX_ROLLS_PER_TURN = 3;

export const YAHTZEE_CATEGORIES = [
  "ones",
  "twos",
  "threes",
  "fours",
  "fives",
  "sixes",
  "three-kind",
  "four-kind",
  "full-house",
  "small-straight",
  "large-straight",
  "yahtzee",
  "chance",
] as const;

export type YahtzeeCategory = (typeof YAHTZEE_CATEGORIES)[number];
export type YahtzeeDie = 1 | 2 | 3 | 4 | 5 | 6;

export interface YahtzeeTurn {
  dice: YahtzeeDie[];
  held: boolean[];
  rollCount: number;
}

export interface YahtzeeScoreCard {
  scores: Partial<Record<YahtzeeCategory, number>>;
}

function countDice(dice: YahtzeeDie[]): number[] {
  const counts = Array.from({ length: 7 }, () => 0);
  for (const die of dice) counts[die] = (counts[die] ?? 0) + 1;
  return counts;
}

function sumDice(dice: YahtzeeDie[]): number {
  return dice.reduce((sum, die) => sum + die, 0);
}

function hasStraight(dice: YahtzeeDie[], length: number): boolean {
  const unique = Array.from(new Set(dice)).sort((a, b) => a - b);
  let run = 1;
  for (let index = 1; index < unique.length; index += 1) {
    const current = unique[index];
    const previous = unique[index - 1];
    if (current !== undefined && previous !== undefined && current === previous + 1) {
      run += 1;
      if (run >= length) return true;
    } else {
      run = 1;
    }
  }
  return length <= 1 && unique.length > 0;
}

export function createEmptyTurn(): YahtzeeTurn {
  return {
    dice: [1, 1, 1, 1, 1],
    held: [false, false, false, false, false],
    rollCount: 0,
  };
}

export function rollYahtzeeDice(
  turn: YahtzeeTurn,
  random: () => number = Math.random
): YahtzeeTurn {
  if (turn.rollCount >= YAHTZEE_MAX_ROLLS_PER_TURN)
    return { ...turn, dice: turn.dice.slice(), held: turn.held.slice() };

  const dice = turn.dice.map((die, index) => {
    if (turn.rollCount > 0 && turn.held[index]) return die;
    return (Math.floor(random() * 6) + 1) as YahtzeeDie;
  });

  return {
    dice,
    held: turn.held.slice(),
    rollCount: turn.rollCount + 1,
  };
}

export function scoreYahtzeeCategory(category: YahtzeeCategory, dice: YahtzeeDie[]): number {
  if (dice.length !== YAHTZEE_DICE_COUNT) return 0;
  const counts = countDice(dice);
  const total = sumDice(dice);

  switch (category) {
    case "ones":
      return (counts[1] ?? 0) * 1;
    case "twos":
      return (counts[2] ?? 0) * 2;
    case "threes":
      return (counts[3] ?? 0) * 3;
    case "fours":
      return (counts[4] ?? 0) * 4;
    case "fives":
      return (counts[5] ?? 0) * 5;
    case "sixes":
      return (counts[6] ?? 0) * 6;
    case "three-kind":
      return counts.some((count) => count >= 3) ? total : 0;
    case "four-kind":
      return counts.some((count) => count >= 4) ? total : 0;
    case "full-house":
      return counts.includes(3) && counts.includes(2) ? 25 : 0;
    case "small-straight":
      return hasStraight(dice, 4) ? 30 : 0;
    case "large-straight":
      return hasStraight(dice, 5) ? 40 : 0;
    case "yahtzee":
      return counts.includes(5) ? 50 : 0;
    case "chance":
      return total;
    default:
      return 0;
  }
}

export function getYahtzeeUpperSubtotal(card: YahtzeeScoreCard): number {
  return (["ones", "twos", "threes", "fours", "fives", "sixes"] as YahtzeeCategory[]).reduce(
    (sum, category) => sum + (card.scores[category] ?? 0),
    0
  );
}

export function getYahtzeeUpperBonus(card: YahtzeeScoreCard): number {
  return getYahtzeeUpperSubtotal(card) >= 63 ? 35 : 0;
}

export function getYahtzeeTotal(card: YahtzeeScoreCard): number {
  const categoryTotal = YAHTZEE_CATEGORIES.reduce(
    (sum, category) => sum + (card.scores[category] ?? 0),
    0
  );
  return categoryTotal + getYahtzeeUpperBonus(card);
}

export function isYahtzeeComplete(card: YahtzeeScoreCard): boolean {
  return YAHTZEE_CATEGORIES.every((category) => typeof card.scores[category] === "number");
}
