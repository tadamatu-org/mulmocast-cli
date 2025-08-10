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
  { from: "足袋", to: "たび" },
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

/**
 * ChatGPTを使用してテキストの重要度を分析し、ハイライトする
 * @param text 元のテキスト
 * @param options オプション設定
 * @returns マークアップされたHTML
 */
export const highlightImportantWordsWithAI = async (
  text: string,
  options: {
    criticalClass?: string;
    importantClass?: string;
    openaiApiKey?: string;
  } = {},
): Promise<string> => {
  const { criticalClass = "highlight-critical", importantClass = "highlight-important", openaiApiKey = process.env.OPENAI_API_KEY } = options;

  if (!openaiApiKey) {
    console.warn("OpenAI API key not provided, falling back to pattern-based highlighting");
    return highlightImportantWords(text);
  }

  try {
    // ChatGPTに重要度分析を依頼
    const analysis = await analyzeTextImportanceWithAI(text, openaiApiKey);

    let highlightedText = text;

    // 最重要（赤色）の単語をハイライト
    analysis.critical.forEach((word) => {
      const regex = new RegExp(`(${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "g");
      highlightedText = highlightedText.replace(regex, `<span class="${criticalClass}">$1</span>`);
    });

    // 重要（黄色）の単語をハイライト
    analysis.important.forEach((word) => {
      const regex = new RegExp(`(${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "g");
      highlightedText = highlightedText.replace(regex, `<span class="${importantClass}">$1</span>`);
    });

    return highlightedText;
  } catch (error) {
    console.error("AI analysis failed, falling back to pattern-based highlighting:", error);
    return highlightImportantWords(text);
  }
};

/**
 * ChatGPTを使用してテキストの重要度を分析する
 * @param text 分析するテキスト
 * @param apiKey OpenAI API key
 * @returns 重要度分析結果
 */
export const analyzeTextImportanceWithAI = async (text: string, apiKey: string): Promise<{ critical: string[]; important: string[] }> => {
  const prompt = `
以下のテキストを分析して、文脈を把握したうえで重要な単語やフレーズを以下の2つのカテゴリに分類してください：

**最重要（赤色でハイライト）**：
- 数字（金額、パーセンテージ、年号、統計など）
- 具体的な数値やデータ
- 重要な固有名詞（人名、地名、会社名など）

**重要（黄色でハイライト）**：
- 重要な形容詞・副詞（画期的、革新的、初めて、最大、最小など）
- 重要な名詞（実験、技術、開発、研究など）
- 専門用語やカタカナ

テキスト：「${text}」

JSON形式で回答してください：
{
  "critical": ["最重要の単語1", "最重要の単語2"],
  "important": ["重要な単語1", "重要な単語2"]
}
`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "あなたはテキスト分析の専門家です。与えられたテキストから重要な単語やフレーズを抽出し、重要度に応じて分類してください。",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${data.error?.message || "Unknown error"}`);
    }

    const content = data.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No content received from OpenAI");
    }

    // JSONレスポンスを解析
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Invalid JSON response from OpenAI");
    }

    const result = JSON.parse(jsonMatch[0]);

    return {
      critical: result.critical || [],
      important: result.important || [],
    };
  } catch (error) {
    console.error("Error analyzing text with AI:", error);
    throw error;
  }
};
