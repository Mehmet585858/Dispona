import { createAuthClient } from "better-auth/react";
import { emailOTPClient, magicLinkClient, inferAdditionalFields } from "better-auth/client/plugins";
import type { auth } from "./auth";

export const authClient = createAuthClient({
  plugins: [emailOTPClient(), magicLinkClient(), inferAdditionalFields<typeof auth>()],
});
