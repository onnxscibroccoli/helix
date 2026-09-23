import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"
import { authTables } from "@convex-dev/auth/server"
export default defineSchema({...authTables,
workspaces:defineTable({owner:v.id("users"),name:v.string(),distro:v.union(v.literal("ubuntu"),v.literal("debian"),v.literal("kali")),tier:v.union(v.literal("persistent"),v.literal("ephemeral")),createdAt:v.number()}).index("by_owner",["owner"])
})
