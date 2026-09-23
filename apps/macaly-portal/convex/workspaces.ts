import { query, mutation, action, internalQuery } from "./_generated/server"
import { internal } from "./_generated/api"
import { getAuthUserId } from "@convex-dev/auth/server"
import { v } from "convex/values"
import {paginationOptsValidator,paginationResultValidator} from "convex/server"
const item=v.object({_id:v.id("workspaces"),_creationTime:v.number(),owner:v.id("users"),name:v.string(),distro:v.union(v.literal("ubuntu"),v.literal("debian"),v.literal("kali")),tier:v.union(v.literal("persistent"),v.literal("ephemeral")),createdAt:v.number()})
const failure=v.object({ok:v.literal(false),message:v.string()})
export const list=query({args:{paginationOpts:paginationOptsValidator},returns:paginationResultValidator(item),handler:async(ctx,args)=>{
const owner=await getAuthUserId(ctx)
if(!owner)return {page:[],isDone:true,continueCursor:""}
return ctx.db.query("workspaces").withIndex("by_owner",q=>q.eq("owner",owner)).order("desc").paginate(args.paginationOpts)
}})
export const create=mutation({args:{name:v.string(),distro:v.union(v.literal("ubuntu"),v.literal("debian"),v.literal("kali")),tier:v.union(v.literal("persistent"),v.literal("ephemeral"))},returns:v.union(failure,v.object({ok:v.literal(true),id:v.id("workspaces")})),handler:async(ctx,args)=>{
const owner=await getAuthUserId(ctx)
if(!owner)return {ok:false as const,message:"Sign in to save a workspace."}
if(!args.name.trim()||args.name.length>64)return {ok:false as const,message:"Use a name between 1 and 64 characters."}
const existing=await ctx.db.query("workspaces").withIndex("by_owner",q=>q.eq("owner",owner)).take(20)
if(existing.length>=20)return {ok:false as const,message:"Workspace quota reached (20)."}
const id=await ctx.db.insert("workspaces",{...args,name:args.name.trim(),owner,createdAt:Date.now()})
return {ok:true as const,id}
}})
export const owned=internalQuery({args:{id:v.id("workspaces")},returns:v.union(item,v.null()),handler:async(ctx,{id})=>{
const owner=await getAuthUserId(ctx);if(!owner)return null
const w=await ctx.db.get(id);return w?.owner===owner?w:null
}})
export const readiness=action({args:{},returns:v.object({google:v.boolean(),gateway:v.boolean(),message:v.string()}),handler:async()=>{
const configured=!!(process.env.HELIX_GATEWAY_URL&&process.env.HELIX_GATEWAY_TOKEN)
return {google:!!(process.env.AUTH_GOOGLE_ID&&process.env.AUTH_GOOGLE_SECRET),gateway:configured,message:configured?"Gateway configured; connection is verified when requested.":"Compute gateway is not configured. Saved workspaces are specifications, not running VMs."}
}})
export const connect=action({args:{id:v.id("workspaces")},returns:v.union(failure,v.object({ok:v.literal(true),url:v.string()})),handler:async(ctx,{id}):Promise<{ok:false;message:string}|{ok:true;url:string}>=>{
const workspace=await ctx.runQuery(internal.workspaces.owned,{id})
if(!workspace)return {ok:false,message:"Workspace not found or access denied."}
const base=process.env.HELIX_GATEWAY_URL,token=process.env.HELIX_GATEWAY_TOKEN
if(!base||!token)return {ok:false,message:"No compute gateway is configured. Your workspace specification is saved; no VM has been provisioned."}
try{
const gateway=new URL(base);if(gateway.protocol!=="https:")throw Error()
const response=await fetch(new URL("/api/v1/sessions",gateway),{method:"POST",redirect:"error",signal:AbortSignal.timeout(15000),headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json","Idempotency-Key":String(id)},body:JSON.stringify({workspaceId:id,owner:workspace.owner,distro:workspace.distro,tier:workspace.tier})})
if(!response.ok)return {ok:false,message:"Gateway rejected the session request ("+response.status+")."}
const data=await response.json()
const url=new URL(data.session_url)
if(url.protocol!=="https:"||url.origin!==gateway.origin||url.username||url.password)return {ok:false,message:"Gateway returned an untrusted desktop URL."}
return {ok:true,url:url.toString()}
}catch{return {ok:false,message:"Desktop gateway is unavailable or returned an invalid response. Retry without creating a second workspace."}}
}})
