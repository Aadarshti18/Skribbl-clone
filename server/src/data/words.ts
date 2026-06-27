export const WORD_CATEGORIES: Record<string, string[]> = {
  animals: [
    "elephant", "giraffe", "penguin", "kangaroo", "octopus", "dolphin", "butterfly",
    "crocodile", "flamingo", "squirrel", "tiger", "panda", "koala", "hedgehog",
    "peacock", "rabbit", "owl", "shark", "lobster", "snail",
  ],
  objects: [
    "umbrella", "telescope", "backpack", "guitar", "candle", "scissors", "ladder",
    "anchor", "compass", "lantern", "violin", "helmet", "envelope", "keyboard",
    "magnet", "pillow", "rocket", "trophy", "wheelbarrow", "binoculars",
  ],
  actions: [
    "running", "swimming", "juggling", "sleeping", "dancing", "singing", "painting",
    "climbing", "skating", "yawning", "whistling", "sneezing", "diving", "fishing",
    "typing", "jumping", "cooking", "laughing", "crying", "waving",
  ],
  food: [
    "pizza", "hamburger", "spaghetti", "watermelon", "pancake", "popcorn", "sandwich",
    "doughnut", "pretzel", "avocado", "pineapple", "sushi", "taco", "croissant",
    "cupcake", "lemonade", "noodles", "strawberry", "broccoli", "waffle",
  ],
  places: [
    "volcano", "lighthouse", "castle", "desert", "waterfall", "stadium", "airport",
    "library", "jungle", "iceberg", "pyramid", "windmill", "bridge", "cave",
    "harbor", "skyscraper", "garden", "tunnel", "mountain", "island",
  ],
  misc: [
    "rainbow", "ghost", "robot", "dinosaur", "astronaut", "wizard", "pirate",
    "dragon", "mermaid", "vampire", "ninja", "snowman", "alien", "superhero",
    "skeleton", "zombie", "unicorn", "knight", "fairy", "mummy",
  ],
};

export const ALL_WORDS: string[] = Object.values(WORD_CATEGORIES).flat();

export function getRandomWords(count: number, exclude: Set<string> = new Set(), customWords?: string[]): string[] {
  // Custom words are appended to (not a replacement for) the built-in bank,
  // so hosts can sprinkle in a few inside-joke words without losing variety.
  const pool = customWords && customWords.length > 0 ? [...ALL_WORDS, ...customWords] : ALL_WORDS;
  const available = pool.filter((w) => !exclude.has(w));
  const source = available.length >= count ? available : pool;

  const shuffled = [...source].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
