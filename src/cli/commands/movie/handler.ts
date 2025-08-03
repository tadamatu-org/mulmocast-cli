import { audio, audioWithPunctuationSplit, images, movie, captions, captionsWithPunctuationSplit } from "../../../actions/index.js";
import { CliArgs } from "../../../types/cli_types.js";
import { initializeContext, runTranslateIfNeeded } from "../../helpers.js";

export const handler = async (argv: CliArgs<{ a?: string; i?: string; c?: string; ps?: boolean }>) => {
  const context = await initializeContext(argv);
  if (!context) {
    process.exit(1);
  }
  await runTranslateIfNeeded(context, true);

  if (argv.ps) {
    await audioWithPunctuationSplit(context).then(images).then(captionsWithPunctuationSplit).then(movie);
  } else {
    await audio(context).then(images).then(captions).then(movie);
  }
};
