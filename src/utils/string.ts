// split ja
export function splitIntoSentencesJa(paragraph: string, divider: string, minimum: number): string[] {
  const sentences = paragraph
    .split(divider) // Split by the Japanese full stop
    .map((sentence) => sentence.trim()) // Trim whitespace
    .filter((sentence) => sentence.length > 0); // Remove empty sentences

  return sentences
    .reduce<string[]>((acc, sentence) => {
      if (acc.length > 0 && acc[acc.length - 1].length < minimum) {
        acc[acc.length - 1] += divider + sentence;
      } else {
        acc.push(sentence);
      }
      return acc;
    }, [])
    .map((sentence, index, array) => (index < array.length - 1 || paragraph.endsWith(divider) ? sentence + divider : sentence));
}

export const recursiveSplitJa = (text: string) => {
  const delimiters = ["。", "？", "！", "、"];
  return delimiters
    .reduce<string[]>(
      (textData, delimiter) => {
        return textData.map((textInner) => splitIntoSentencesJa(textInner, delimiter, 7)).flat(1);
      },
      [text],
    )
    .flat(1);
};

// replace ja

interface Replacement {
  from: string;
  to: string;
}

export function replacePairsJa(replacements: Replacement[]) {
  return (str: string) => {
    return replacements.reduce((tmp, current) => {
      const { from, to } = current;
      // Escape any special regex characters in the 'from' string.
      const escapedFrom = from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escapedFrom, "g");
      return tmp.replace(regex, to);
    }, str);
  };
}

export const replacementsJa: Replacement[] = [
  { from: "Anthropic", to: "アンスロピック" },
  { from: "OpenAI", to: "オープンエーアイ" },
  { from: "AGI", to: "エージーアイ" },
  { from: "GPU", to: "ジーピーユー" },
  { from: "TPU", to: "ティーピーユー" },
  { from: "CPU", to: "シーピーユー" },
  { from: "LPU", to: "エルピーユー" },
  { from: "Groq", to: "グロック" },
  { from: "TSMC", to: "ティーエスエムシー" },
  { from: "NVIDIA", to: "エヌビディア" },
  { from: "1つ", to: "ひとつ" },
  { from: "2つ", to: "ふたつ" },
  { from: "3つ", to: "みっつ" },
  { from: "4つ", to: "よっつ" },
  { from: "5つ", to: "いつつ" },
  { from: "危険な面", to: "危険なめん" },
  { from: "その通り！", to: "その通り。" },
  { from: "%", to: "パーセント" },
  { from: "IPO", to: "アイピーオー" },
];

/**
 * 句読点でテキストを分割する
 * @param text 分割するテキスト
 * @returns 分割されたテキストの配列
 */
export const splitTextByPunctuation = (text: string): string[] => {
  // 句読点（。、！？）で分割し、句読点を保持
  const sentences = text.split(/([。、！？])/);
  const result: string[] = [];
  
  for (let i = 0; i < sentences.length; i += 2) {
    if (sentences[i] && sentences[i + 1]) {
      const sentence = sentences[i] + sentences[i + 1];
      if (sentence.trim().length >= 2) {
        result.push(sentence);
      }
    } else if (sentences[i] && sentences[i].trim().length >= 2) {
      result.push(sentences[i]);
    }
  }
  
  // 結果が空の場合は、元のテキストをそのまま返す
  return result.length > 0 ? result : [text];
};

/**
 * 英語の句読点でテキストを分割する
 * @param text 分割するテキスト
 * @returns 分割されたテキストの配列
 */
export const splitTextByEnglishPunctuation = (text: string): string[] => {
  // 英語の句読点（.!?）で分割
  const sentences = text.split(/([.!?])/);
  const result: string[] = [];
  
  for (let i = 0; i < sentences.length; i += 2) {
    if (sentences[i] && sentences[i + 1]) {
      result.push(sentences[i] + sentences[i + 1]);
    } else if (sentences[i]) {
      result.push(sentences[i]);
    }
  }
  
  return result.filter(sentence => sentence.trim().length > 0);
};
