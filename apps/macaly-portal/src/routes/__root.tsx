import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { MacalyBridge } from '@macaly/bridge'
import AppConvexProvider from '@/components/convex-client-provider'
import '../styles.css'
import metadata from '../metadata.json'
export const Route = createRootRoute({head:()=>({meta:[{charSet:'utf-8'},{name:'viewport',content:'width=device-width, initial-scale=1'},{title:metadata['/'].title}]}),shellComponent:RootDocument})
function RootDocument({children}:{children:React.ReactNode}){return <html lang="en"><head><HeadContent/></head><MacalyBridge><body><AppConvexProvider>{children}</AppConvexProvider><Scripts/></body></MacalyBridge></html>}
