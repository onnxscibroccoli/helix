import {convexTest} from "convex-test"
import {it,expect} from "vitest"
import schema from "../../convex/schema"
import {api} from "../../convex/_generated/api"
const make=()=>convexTest(schema,import.meta.glob("../../convex/**/*.*s"))
const args={name:"Private desktop",distro:"debian" as const,tier:"persistent" as const}
it("denies unauthenticated creation",async()=>{const t=make();expect((await t.mutation(api.workspaces.create,args)).ok).toBe(false)})
it("persists specifications and isolates users in list and connect",async()=>{
const t=make();const a=await t.run(c=>c.db.insert("users",{}));const b=await t.run(c=>c.db.insert("users",{}))
const alice=t.withIdentity({subject:a});const bob=t.withIdentity({subject:b})
const created=await alice.mutation(api.workspaces.create,args);expect(created.ok).toBe(true);if(!created.ok)throw Error()
const page={paginationOpts:{cursor:null,numItems:10}}
expect((await alice.query(api.workspaces.list,page)).page[0]).toMatchObject({name:args.name,owner:a})
expect((await bob.query(api.workspaces.list,page)).page).toHaveLength(0)
expect((await t.query(api.workspaces.list,page)).page).toHaveLength(0)
expect((await bob.action(api.workspaces.connect,{id:created.id})).ok).toBe(false)
expect(await t.run(c=>c.db.get(created.id))).toMatchObject({owner:a,distro:"debian"})
})
it("enforces per-account quota",async()=>{
const t=make();const a=await t.run(c=>c.db.insert("users",{}));const client=t.withIdentity({subject:a})
for(let i=0;i<20;i++)expect((await client.mutation(api.workspaces.create,{...args,name:String(i)})).ok).toBe(true)
expect((await client.mutation(api.workspaces.create,args)).ok).toBe(false)
})
