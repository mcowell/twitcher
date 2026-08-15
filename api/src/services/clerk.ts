import { createClerkClient } from "@clerk/backend";
import { config } from "../config";

// Shared Clerk Backend API client, separate from verifyToken() — this one
// makes authenticated calls back to Clerk (e.g. fetching a user's email),
// rather than just checking a JWT's signature.
export const clerkClient = createClerkClient({ secretKey: config.clerkSecretKey });
