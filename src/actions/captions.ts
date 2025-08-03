import { MulmoStudioContext, MulmoBeat, mulmoCaptionParamsSchema } from "../types/index.js";
import { GraphAI, GraphAILogger } from "graphai";
import type { GraphData, CallbackFunction } from "graphai";
import * as agents from "@graphai/vanilla";
import { getHTMLFile, getCaptionImagePath, getOutputStudioFilePath } from "../utils/file.js";
import { renderHTMLToImage, interpolate } from "../utils/markdown.js";
import { MulmoStudioContextMethods, MulmoPresentationStyleMethods } from "../methods/index.js";
import { fileWriteAgent } from "@graphai/vanilla_node_agents";
import { splitTextByPunctuation, splitTextByEnglishPunctuation } from "../utils/string.js";

const vanillaAgents = agents.default ?? agents;

const graph_data: GraphData = {
  version: 0.5,
  nodes: {
    context: {},
    outputStudioFilePath: {},
    map: {
      agent: "mapAgent",
      inputs: { rows: ":context.studio.script.beats", context: ":context" },
      isResult: true,
      params: {
        rowKey: "beat",
        compositeResult: true,
      },
      graph: {
        nodes: {
          generateCaption: {
            agent: async (namedInputs: { beat: MulmoBeat; context: MulmoStudioContext; index: number }) => {
              const { beat, context, index } = namedInputs;
              try {
                MulmoStudioContextMethods.setBeatSessionState(context, "caption", index, true);
                const captionParams = mulmoCaptionParamsSchema.parse({ ...context.studio.script.captionParams, ...beat.captionParams });
                const canvasSize = MulmoPresentationStyleMethods.getCanvasSize(context.presentationStyle);
                const imagePath = getCaptionImagePath(context, index);
                const template = getHTMLFile("caption");
                const text = (() => {
                  const multiLingual = context.multiLingual;
                  if (captionParams.lang && multiLingual && multiLingual[index]) {
                    const multiLingualTexts = multiLingual[index].multiLingualTexts;
                    if (multiLingualTexts && multiLingualTexts[captionParams.lang]) {
                      return multiLingualTexts[captionParams.lang].text;
                    }
                  }
                  GraphAILogger.warn(`No multiLingual caption found for beat ${index}, lang: ${captionParams.lang}`);
                  return beat.text;
                })();
                const htmlData = interpolate(template, {
                  caption: text,
                  width: `${canvasSize.width}`,
                  height: `${canvasSize.height}`,
                  styles: captionParams.styles.join(";\n"),
                });
                await renderHTMLToImage(htmlData, imagePath, canvasSize.width, canvasSize.height, false, true);
                context.studio.beats[index].captionFile = imagePath;
                return imagePath;
              } finally {
                MulmoStudioContextMethods.setBeatSessionState(context, "caption", index, false);
              }
            },
            inputs: {
              beat: ":beat",
              context: ":context",
              index: ":__mapIndex",
            },
            isResult: true,
          },
        },
      },
    },
    fileWrite: {
      agent: "fileWriteAgent",
      inputs: {
        onComplete: ":map.generateCaption",
        file: ":outputStudioFilePath",
        text: ":context.studio.toJSON()",
      },
    },
  },
};

export const captions = async (context: MulmoStudioContext, callbacks?: CallbackFunction[]) => {
  if (MulmoStudioContextMethods.getCaption(context)) {
    try {
      MulmoStudioContextMethods.setSessionState(context, "caption", true);
      const graph = new GraphAI(graph_data, { ...vanillaAgents, fileWriteAgent });
      const outDirPath = MulmoStudioContextMethods.getOutDirPath(context);
      const fileName = MulmoStudioContextMethods.getFileName(context);
      const outputStudioFilePath = getOutputStudioFilePath(outDirPath, fileName);
      graph.injectValue("context", context);
      graph.injectValue("outputStudioFilePath", outputStudioFilePath);
      if (callbacks) {
        callbacks.forEach((callback) => {
          graph.registerCallback(callback);
        });
      }
      await graph.run();
    } finally {
      MulmoStudioContextMethods.setSessionState(context, "caption", false);
    }
  }
  return context;
};

export const captionsWithPunctuationSplit = async (context: MulmoStudioContext, callbacks?: CallbackFunction[]) => {
  if (MulmoStudioContextMethods.getCaption(context)) {
    try {
      MulmoStudioContextMethods.setSessionState(context, "caption", true);
      
      const graph = new GraphAI(graph_data, { ...vanillaAgents, fileWriteAgent });
      const outDirPath = MulmoStudioContextMethods.getOutDirPath(context);
      const fileName = MulmoStudioContextMethods.getFileName(context);
      const outputStudioFilePath = getOutputStudioFilePath(outDirPath, fileName);
      
      // 各beatのテキストを句読点で分割してcaptionを生成
      for (let beatIndex = 0; beatIndex < context.studio.script.beats.length; beatIndex++) {
        const beat = context.studio.script.beats[beatIndex];
        const text = beat.text;
        
        // テキストを句読点で分割
        const sentences = context.lang === "ja" 
          ? splitTextByPunctuation(text)
          : splitTextByEnglishPunctuation(text);
        
        // 各文に対してcaptionを生成
        for (let sentenceIndex = 0; sentenceIndex < sentences.length; sentenceIndex++) {
          const sentence = sentences[sentenceIndex];
          const captionParams = mulmoCaptionParamsSchema.parse({ 
            ...context.studio.script.captionParams, 
            ...beat.captionParams 
          });
          
          const canvasSize = MulmoPresentationStyleMethods.getCanvasSize(context.presentationStyle);
          const imagePath = getCaptionImagePath(context, `${beatIndex}-${sentenceIndex}`);
          const template = getHTMLFile("caption");
          
          const captionText = (() => {
            const multiLingual = context.multiLingual;
            if (captionParams.lang && multiLingual && multiLingual[beatIndex]) {
              const multiLingualTexts = multiLingual[beatIndex].multiLingualTexts;
              if (multiLingualTexts && multiLingualTexts[captionParams.lang]) {
                return multiLingualTexts[captionParams.lang].text;
              }
            }
            GraphAILogger.warn(`No multiLingual caption found for beat ${beatIndex}-${sentenceIndex}, lang: ${captionParams.lang}`);
            return sentence;
          })();
          
          const htmlData = interpolate(template, {
            caption: captionText,
            width: `${canvasSize.width}`,
            height: `${canvasSize.height}`,
            styles: captionParams.styles.join(";\n"),
          });
          
          await renderHTMLToImage(htmlData, imagePath, canvasSize.width, canvasSize.height, false, true);
          
          // captionファイルのパスを保存
          if (!context.studio.beats[beatIndex].captionFiles) {
            context.studio.beats[beatIndex].captionFiles = [];
          }
          context.studio.beats[beatIndex].captionFiles.push(imagePath);
        }
      }
      
      graph.injectValue("context", context);
      graph.injectValue("outputStudioFilePath", outputStudioFilePath);
      if (callbacks) {
        callbacks.forEach((callback) => {
          graph.registerCallback(callback);
        });
      }
      await graph.run();
    } finally {
      MulmoStudioContextMethods.setSessionState(context, "caption", false);
    }
  }
  return context;
};
