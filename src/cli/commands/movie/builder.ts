import type { Argv } from "yargs";
import { commonOptions } from "../../common.js";
import { languages } from "../../../utils/const.js";

export const builder = (yargs: Argv) =>
  commonOptions(yargs)
    .option("a", {
      alias: "audiodir",
      describe: "Audio output directory",
      type: "string",
    })
    .option("i", {
      alias: "imagedir",
      describe: "Image output directory",
      type: "string",
    })
    .option("c", {
      alias: "caption",
      describe: "Video captions",
      choices: languages,
      type: "string",
    })
    .option("ps", {
      alias: "punctuation-split",
      describe: "Split audio and captions by punctuation marks",
      type: "boolean",
      default: false,
    });
