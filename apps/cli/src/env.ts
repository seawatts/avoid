import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
