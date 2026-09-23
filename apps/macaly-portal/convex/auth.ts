import { convexAuth } from "@convex-dev/auth/server"
import Google from "@auth/core/providers/google"
import { ResendOTP } from "./ResendOTP"
export const {auth,signIn,signOut,store,isAuthenticated}=convexAuth({providers:[ResendOTP,...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET ? [Google({checks:["pkce","state"]})]:[])]})
