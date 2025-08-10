import { MulmoBeat } from "../types/index.js";

/**
 * タイトル用のbeatを生成する
 * @param title タイトル文字列
 * @returns タイトル用のbeat
 */
export const createTitleBeat = (title: string): MulmoBeat => {
  return {
    text: title,
    imagePrompt: `${title} （イメージ作成に文字は使用しないこと）`,
    audioParams: {
      padding: 0.0,
      movieVolume: 1.0,
    },
    captionParams: {
      lang: "ja",
      styles: [
        "background: transparent;",
        "-webkit-text-stroke: 2px #1A1A1A;",
        "text-stroke: 2px #1A1A1A;",
        "font-size: 128px;",
        "line-height: 1.1;",
        "margin-bottom: 55%;",
      ],
    },
    // タイトルは句読点分割しない
    noPunctuationSplit: true,
    // introPaddingを考慮して負の値で開始（0秒からcaptionを表示するため）
    startAt: -1.0,
    // タイトル用の特別な設定
    duration: undefined, // 音声の長さに合わせて自動設定
  };
};

/**
 * 既存のbeatsにタイトルbeatを追加する
 * @param originalBeats 元のbeats配列
 * @param title タイトル文字列
 * @param displayTitle 表示用タイトル文字列（オプション）
 * @returns タイトルbeatが追加されたbeats配列
 */
export const addTitleToBeats = (originalBeats: MulmoBeat[], title: string, displayTitle?: string): MulmoBeat[] => {
  const finalTitle = displayTitle || title;
  console.log(`Creating title beat for: "${finalTitle}" (original: "${title}")`);
  const titleBeat = createTitleBeat(finalTitle);
  console.log(`Title beat created:`, JSON.stringify(titleBeat, null, 2));

  const updatedBeats = [titleBeat, ...originalBeats];
  console.log(`Updated beats array length: ${updatedBeats.length}`);

  return updatedBeats;
};
