import { audio, audioWithPunctuationSplit } from "../../../actions/index.js";
import { initializeContext, runTranslateIfNeeded } from "../../helpers.js";
import { CliArgs } from "../../../types/cli_types.js";

export const handler = async (argv: CliArgs<{ a?: string; ps?: boolean }>) => {
  const context = await initializeContext(argv);
  if (!context) {
    process.exit(1);
  }
  await runTranslateIfNeeded(context);

  if (argv.ps) {
    await audioWithPunctuationSplit(context);
  } else {
    await audio(context);
  }
};
