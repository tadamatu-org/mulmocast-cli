import "dotenv/config";

import { GraphAI, TaskManager } from "graphai";
import type { GraphData, CallbackFunction } from "graphai";
import * as agents from "@graphai/vanilla";
import ttsNijivoiceAgent from "../agents/tts_nijivoice_agent.js";
import addBGMAgent from "../agents/add_bgm_agent.js";
import combineAudioFilesAgent from "../agents/combine_audio_files_agent.js";
import ttsOpenaiAgent from "../agents/tts_openai_agent.js";
import ttsGoogleAgent from "../agents/tts_google_agent.js";
import ttsElevenlabsAgent from "../agents/tts_elevenlabs_agent.js";
import { fileWriteAgent } from "@graphai/vanilla_node_agents";
import { MulmoPresentationStyleMethods } from "../methods/index.js";

import { MulmoStudioContext, MulmoBeat, MulmoStudioBeat, MulmoStudioMultiLingualData, text2SpeechProviderSchema } from "../types/index.js";
import { fileCacheAgentFilter, nijovoiceTextAgentFilter } from "../utils/filters.js";
import { getAudioArtifactFilePath, getAudioFilePath, getOutputStudioFilePath, resolveDirPath, defaultBGMPath, mkdir, writingMessage } from "../utils/file.js";
import { text2hash, localizedText, settings2GraphAIConfig } from "../utils/utils.js";
import { provider2TTSAgent } from "../utils/provider2agent.js";
import { MulmoStudioContextMethods } from "../methods/mulmo_studio_context.js";
import { MulmoMediaSourceMethods } from "../methods/mulmo_media_source.js";
import { splitTextByPunctuation, splitTextByEnglishPunctuation, replacePairsJa, replacementsJa } from "../utils/string.js";

const vanillaAgents = agents.default ?? agents;

const getAudioPath = (context: MulmoStudioContext, beat: MulmoBeat, audioFile: string): string | undefined => {
  if (beat.audio?.type === "audio") {
    const path = MulmoMediaSourceMethods.resolve(beat.audio.source, context);
    if (path) {
      return path;
    }
    throw new Error("Invalid audio source");
  }
  if (beat.text === undefined || beat.text === "" || context.studio.script.audioParams.suppressSpeech) {
    return undefined; // It indicates that the audio is not needed.
  }
  return audioFile;
};

const getAudioParam = (context: MulmoStudioContext, beat: MulmoBeat) => {
  const speaker = MulmoPresentationStyleMethods.getSpeaker(context, beat);
  const speechOptions = { ...speaker.speechOptions, ...beat.speechOptions };
  const provider = text2SpeechProviderSchema.parse(speaker.provider) as keyof typeof provider2TTSAgent;
  return { voiceId: speaker.voiceId, provider, speechOptions, model: speaker.model };
};

export const getBeatAudioPath = (text: string, context: MulmoStudioContext, beat: MulmoBeat, lang?: string) => {
  const audioDirPath = MulmoStudioContextMethods.getAudioDirPath(context);
  const { voiceId, provider, speechOptions, model } = getAudioParam(context, beat);
  const hash_string = [text, voiceId, speechOptions?.instruction ?? "", speechOptions?.speed ?? 1.0, provider, model ?? ""].join(":");
  const audioFileName = `${context.studio.filename}_${text2hash(hash_string)}`;
  const audioFile = getAudioFilePath(audioDirPath, context.studio.filename, audioFileName, lang);
  return getAudioPath(context, beat, audioFile);
};

const preprocessor = (namedInputs: {
  beat: MulmoBeat;
  studioBeat: MulmoStudioBeat;
  multiLingual: MulmoStudioMultiLingualData;
  context: MulmoStudioContext;
}) => {
  const { beat, studioBeat, multiLingual, context } = namedInputs;
  const { lang } = context;
  let text = localizedText(beat, multiLingual, lang);

  // 日本語の場合は読み方の置換を適用
  if (lang === "ja") {
    text = replacePairsJa(replacementsJa)(text);
  }

  const { voiceId, provider, speechOptions, model } = getAudioParam(context, beat);
  const audioPath = getBeatAudioPath(text, context, beat, lang);
  studioBeat.audioFile = audioPath; // TODO: Passing by reference is difficult to maintain, so pass it using graphai inputs
  const needsTTS = !beat.audio && audioPath !== undefined;

  return {
    ttsAgent: provider2TTSAgent[provider].agentName,
    text,
    voiceId,
    speechOptions,
    model,
    provider,
    lang,
    audioPath,
    studioBeat,
    needsTTS,
  };
};

const graph_tts: GraphData = {
  nodes: {
    beat: {},
    studioBeat: {},
    multiLingual: {},
    context: {},
    __mapIndex: {},
    preprocessor: {
      agent: preprocessor,
      inputs: {
        beat: ":beat",
        studioBeat: ":studioBeat",
        multiLingual: ":multiLingual",
        context: ":context",
      },
    },
    tts: {
      if: ":preprocessor.needsTTS",
      agent: ":preprocessor.ttsAgent",
      inputs: {
        text: ":preprocessor.text",
        provider: ":preprocessor.provider",
        lang: ":preprocessor.lang",
        cache: {
          force: [":context.force"],
          file: ":preprocessor.audioPath",
          index: ":__mapIndex",
          mulmoContext: ":context",
          sessionType: "audio",
        },
        params: {
          voice: ":preprocessor.voiceId",
          speed: ":preprocessor.speechOptions.speed",
          instructions: ":preprocessor.speechOptions.instruction",
          model: ":preprocessor.model",
        },
      },
    },
  },
};

const graph_data: GraphData = {
  version: 0.5,
  concurrency: 8,
  nodes: {
    context: {},
    audioArtifactFilePath: {},
    audioCombinedFilePath: {},
    outputStudioFilePath: {},
    musicFile: {},
    map: {
      agent: "mapAgent",
      inputs: {
        rows: ":context.studio.script.beats",
        studioBeat: ":context.studio.beats",
        multiLingual: ":context.multiLingual",
        context: ":context",
      },
      params: {
        rowKey: "beat",
        expandKeys: ["studioBeat", "multiLingual"],
      },
      graph: graph_tts,
    },
    combineFiles: {
      agent: "combineAudioFilesAgent",
      inputs: {
        onComplete: ":map",
        context: ":context",
        combinedFileName: ":audioCombinedFilePath",
      },
      isResult: true,
    },
    fileWrite: {
      agent: "fileWriteAgent",
      inputs: {
        file: ":outputStudioFilePath",
        text: ":combineFiles.studio.toJSON()",
      },
    },
    addBGM: {
      agent: "addBGMAgent",
      unless: ":context.presentationStyle.audioParams.bgmVolume.equal(0)",
      inputs: {
        wait: ":combineFiles",
        voiceFile: ":audioCombinedFilePath",
        outputFile: ":audioArtifactFilePath",
        context: ":context",
        params: {
          musicFile: ":musicFile",
        },
      },
      isResult: true,
      defaultValue: {},
    },
    title: {
      agent: "copyAgent",
      params: {
        namedKey: "title",
      },
      inputs: {
        title: "\n${:context.studio.script.title}\n\n${:context.studio.script.description}\nReference: ${:context.studio.script.reference}\n",
        waitFor: ":addBGM",
      },
    },
  },
};

const agentFilters = [
  {
    name: "fileCacheAgentFilter",
    agent: fileCacheAgentFilter,
    nodeIds: ["tts"],
  },
  {
    name: "nijovoiceTextAgentFilter",
    agent: nijovoiceTextAgentFilter,
    nodeIds: ["tts"],
  },
];

const getConcurrency = (context: MulmoStudioContext) => {
  // Check if any speaker uses nijivoice or elevenlabs (providers that require concurrency = 1)
  const hasLimitedConcurrencyProvider = Object.values(context.presentationStyle.speechParams.speakers).some((speaker) => {
    const provider = text2SpeechProviderSchema.parse(speaker.provider) as keyof typeof provider2TTSAgent;
    return provider2TTSAgent[provider].hasLimitedConcurrency;
  });
  return hasLimitedConcurrencyProvider ? 1 : 8;
};

const audioAgents = {
  ...vanillaAgents,
  fileWriteAgent,
  ttsOpenaiAgent,
  ttsNijivoiceAgent,
  ttsGoogleAgent,
  ttsElevenlabsAgent,
  addBGMAgent,
  combineAudioFilesAgent,
};

export const generateBeatAudio = async (index: number, context: MulmoStudioContext, settings?: Record<string, string>, callbacks?: CallbackFunction[]) => {
  try {
    MulmoStudioContextMethods.setSessionState(context, "audio", true);
    const fileName = MulmoStudioContextMethods.getFileName(context);
    const audioDirPath = MulmoStudioContextMethods.getAudioDirPath(context);
    const outDirPath = MulmoStudioContextMethods.getOutDirPath(context);
    const audioSegmentDirPath = resolveDirPath(audioDirPath, fileName);

    mkdir(outDirPath);
    mkdir(audioSegmentDirPath);

    const config = settings2GraphAIConfig(settings);
    const taskManager = new TaskManager(getConcurrency(context));
    const graph = new GraphAI(graph_tts, audioAgents, { agentFilters, taskManager, config });
    graph.injectValue("__mapIndex", index);
    graph.injectValue("beat", context.studio.script.beats[index]);
    graph.injectValue("studioBeat", context.studio.beats[index]);
    graph.injectValue("multiLingual", context.multiLingual);
    graph.injectValue("context", context);

    if (callbacks) {
      callbacks.forEach((callback) => {
        graph.registerCallback(callback);
      });
    }
    await graph.run();
  } finally {
    MulmoStudioContextMethods.setSessionState(context, "audio", false);
  }
};

export const audio = async (context: MulmoStudioContext, settings?: Record<string, string>, callbacks?: CallbackFunction[]) => {
  try {
    MulmoStudioContextMethods.setSessionState(context, "audio", true);
    const fileName = MulmoStudioContextMethods.getFileName(context);
    const audioDirPath = MulmoStudioContextMethods.getAudioDirPath(context);
    const outDirPath = MulmoStudioContextMethods.getOutDirPath(context);
    const audioArtifactFilePath = getAudioArtifactFilePath(context);
    const audioSegmentDirPath = resolveDirPath(audioDirPath, fileName);
    const audioCombinedFilePath = getAudioFilePath(audioDirPath, fileName, fileName, context.lang);
    const outputStudioFilePath = getOutputStudioFilePath(outDirPath, fileName);

    mkdir(outDirPath);
    mkdir(audioSegmentDirPath);

    const config = settings2GraphAIConfig(settings, process.env);
    const taskManager = new TaskManager(getConcurrency(context));
    const graph = new GraphAI(graph_data, audioAgents, { agentFilters, taskManager, config });
    graph.injectValue("context", context);
    graph.injectValue("audioArtifactFilePath", audioArtifactFilePath);
    graph.injectValue("audioCombinedFilePath", audioCombinedFilePath);
    graph.injectValue("outputStudioFilePath", outputStudioFilePath);
    graph.injectValue(
      "musicFile",
      MulmoMediaSourceMethods.resolve(context.presentationStyle.audioParams.bgm, context) ?? process.env.PATH_BGM ?? defaultBGMPath(),
    );

    if (callbacks) {
      callbacks.forEach((callback) => {
        graph.registerCallback(callback);
      });
    }
    const result = await graph.run();
    writingMessage(audioCombinedFilePath);
    MulmoStudioContextMethods.setSessionState(context, "audio", false);
    writingMessage(audioArtifactFilePath);
    return result.combineFiles as MulmoStudioContext;
  } catch (__error) {
    MulmoStudioContextMethods.setSessionState(context, "audio", false);
    throw __error;
  }
};

export const generateBeatAudioWithPunctuationSplit = async (
  index: number,
  context: MulmoStudioContext,
  settings?: Record<string, string>,
  callbacks?: CallbackFunction[],
) => {
  try {
    MulmoStudioContextMethods.setSessionState(context, "audio", true);
    const beat = context.studio.script.beats[index];
    const studioBeat = context.studio.beats[index];

    // テキストを句読点で分割
    const text = localizedText(beat, context.multiLingual[index], context.lang);
    const sentences = context.lang === "ja" ? splitTextByPunctuation(text) : splitTextByEnglishPunctuation(text);

    const audioFiles: string[] = [];

    // 各文に対してaudioを生成
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      const sentenceBeat = { ...beat, text: sentence };
      const sentenceStudioBeat = { ...studioBeat };

      const fileName = MulmoStudioContextMethods.getFileName(context);
      const audioDirPath = MulmoStudioContextMethods.getAudioDirPath(context);
      const outDirPath = MulmoStudioContextMethods.getOutDirPath(context);
      const audioSegmentDirPath = resolveDirPath(audioDirPath, fileName);

      mkdir(outDirPath);
      mkdir(audioSegmentDirPath);

      const config = settings2GraphAIConfig(settings);
      const taskManager = new TaskManager(getConcurrency(context));
      const graph = new GraphAI(graph_tts, audioAgents, { agentFilters, taskManager, config });
      graph.injectValue("__mapIndex", `${index}-${i}`);
      graph.injectValue("beat", sentenceBeat);
      graph.injectValue("studioBeat", sentenceStudioBeat);
      graph.injectValue("multiLingual", context.multiLingual);
      graph.injectValue("context", context);

      if (callbacks) {
        callbacks.forEach((callback) => {
          graph.registerCallback(callback);
        });
      }

      await graph.run();

      if (sentenceStudioBeat.audioFile) {
        audioFiles.push(sentenceStudioBeat.audioFile);
      }
    }

    // 分割されたaudioファイルを結合
    if (audioFiles.length > 0) {
      const combinedAudioPath = getBeatAudioPath(text, context, beat, context.lang);
      if (combinedAudioPath) {
        // ここでaudioファイルを結合する処理を追加
        // 現在は個別のファイルとして保存
        studioBeat.audioFile = combinedAudioPath;
      }
    }
  } finally {
    MulmoStudioContextMethods.setSessionState(context, "audio", false);
  }
};

export const audioWithPunctuationSplit = async (context: MulmoStudioContext, settings?: Record<string, string>, callbacks?: CallbackFunction[]) => {
  try {
    MulmoStudioContextMethods.setSessionState(context, "audio", true);

    // 各beatに対して句読点分割されたaudioを生成
    for (let beatIndex = 0; beatIndex < context.studio.script.beats.length; beatIndex++) {
      await generateBeatAudioWithPunctuationSplit(beatIndex, context, settings, callbacks);
    }

    // 最終的な結合処理
    const fileName = MulmoStudioContextMethods.getFileName(context);
    const audioDirPath = MulmoStudioContextMethods.getAudioDirPath(context);
    const outDirPath = MulmoStudioContextMethods.getOutDirPath(context);
    const audioArtifactFilePath = getAudioArtifactFilePath(context);
    const audioCombinedFilePath = getAudioFilePath(audioDirPath, fileName, fileName, context.lang);
    const outputStudioFilePath = getOutputStudioFilePath(outDirPath, fileName);

    mkdir(outDirPath);

    const config = settings2GraphAIConfig(settings, process.env);
    const taskManager = new TaskManager(getConcurrency(context));
    const graph = new GraphAI(graph_data, audioAgents, { agentFilters, taskManager, config });
    graph.injectValue("context", context);
    graph.injectValue("audioArtifactFilePath", audioArtifactFilePath);
    graph.injectValue("audioCombinedFilePath", audioCombinedFilePath);
    graph.injectValue("outputStudioFilePath", outputStudioFilePath);
    graph.injectValue(
      "musicFile",
      MulmoMediaSourceMethods.resolve(context.presentationStyle.audioParams.bgm, context) ?? process.env.PATH_BGM ?? defaultBGMPath(),
    );

    if (callbacks) {
      callbacks.forEach((callback) => {
        graph.registerCallback(callback);
      });
    }
    const result = await graph.run();
    writingMessage(audioCombinedFilePath);
    MulmoStudioContextMethods.setSessionState(context, "audio", false);
    writingMessage(audioArtifactFilePath);
    return result.combineFiles as MulmoStudioContext;
  } catch (__error) {
    MulmoStudioContextMethods.setSessionState(context, "audio", false);
    throw __error;
  }
};
