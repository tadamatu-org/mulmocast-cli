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

  return result.filter((sentence) => sentence.trim().length > 0);
};

/**
 * 重要なキーワードのパターン定義
 */
const CRITICAL_PATTERNS = [
  // 最重要：数字（金額、パーセンテージ、年号など）
  { pattern: /\d+[億万]?円/g, weight: 5 },
  { pattern: /\d+%/g, weight: 5 },
  { pattern: /\d{4}年/g, weight: 5 },
];

const IMPORTANT_PATTERNS = [
  // 重要：重要な形容詞
  { pattern: /(画期的|革新的|初めて|初|最大|最小|最高|最低|重要|緊急|危険|成功|失敗|新|旧)/g, weight: 4 },
  // 重要：重要な名詞
  { pattern: /(実験|技術|開発|研究|発見|発明|導入|開始|終了|完了|発表)/g, weight: 3 },
  // 重要：人名、地名、会社名（大文字で始まる）
  { pattern: /[A-Z][a-z]+/g, weight: 2 },
  // 重要：カタカナ（外来語、専門用語）
  { pattern: /[ァ-ヶー]+/g, weight: 2 },
];

/**
 * テキストの重要度を分析してハイライトする
 * @param text 元のテキスト
 * @param options オプション設定
 * @returns マークアップされたHTML
 */
export const highlightImportantWords = (
  text: string,
  options: {
    criticalClass?: string;
    importantClass?: string;
    minImportance?: number;
  } = {},
): string => {
  const { criticalClass = "highlight-critical", importantClass = "highlight-important", minImportance = 2 } = options;

  let highlightedText = text;

  // 最重要パターン（赤色）
  CRITICAL_PATTERNS.forEach(({ pattern, weight }) => {
    if (weight >= minImportance) {
      highlightedText = highlightedText.replace(pattern, (match) => {
        return `<span class="${criticalClass}">${match}</span>`;
      });
    }
  });

  // 重要パターン（黄色）
  IMPORTANT_PATTERNS.forEach(({ pattern, weight }) => {
    if (weight >= minImportance) {
      highlightedText = highlightedText.replace(pattern, (match) => {
        return `<span class="${importantClass}">${match}</span>`;
      });
    }
  });

  return highlightedText;
};

/**
 * 文の重要度を分析して重要な部分を特定する
 * @param text 分析するテキスト
 * @returns 重要度スコア付きの単語配列
 */
export const analyzeTextImportance = (text: string): Array<{ word: string; importance: number }> => {
  const words = text.split(/\s+/);

  return words.map((word) => {
    let importance = 0;

    // 最重要パターンで重要度を計算
    CRITICAL_PATTERNS.forEach(({ pattern, weight }) => {
      if (pattern.test(word)) {
        importance += weight;
      }
    });

    // 重要パターンで重要度を計算
    IMPORTANT_PATTERNS.forEach(({ pattern, weight }) => {
      if (pattern.test(word)) {
        importance += weight;
      }
    });

    return { word, importance };
  });
};
