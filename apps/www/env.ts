import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  client: {
    NEXT_PUBLIC_SUPPORT_EMAIL: z.string().email().optional(),
  },

  emptyStringAsUndefined: true,

  experimental__runtimeEnv: {
    NEXT_PUBLIC_SUPPORT_EMAIL: process.env.NEXT_PUBLIC_SUPPORT_EMAIL,
    NODE_ENV: process.env.NODE_ENV,
  },

  server: {
    /**
     * Cloudflare AI Search OpenAI-compatible chat endpoint.
     * Optional: when unset, Ask AI UI should still render but will fail gracefully.
     */
    AI_SEARCH_CHAT_URL: z.url().optional(),
  },

  shared: {
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
  },
});
