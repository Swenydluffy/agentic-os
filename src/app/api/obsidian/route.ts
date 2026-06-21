import{NextRequest}from"next/server";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const URL="https://notes.wynneops.com/api/notes";
const TOKEN="notes-wynneops-2026";
export async function GET(req:NextRequest){
const sp=req.nextUrl.searchParams;
const file=sp.get("file")?.trim();
const q=sp.get("q")?.trim();
try{
let u=URL;
if(file)u+="?file="+encodeURIComponent(file);
else if(q)u+="?q="+encodeURIComponent(q);
const r=await fetch(u,{headers:{"x-notes-token":TOKEN},cache:"no-store"});
return Response.json(await r.json(),{status:r.status});
}catch(e){return Response.json({ok:false,error:String(e)},{status:500});}}
export async function POST(){return Response.json({ok:false,error:"not supported"},{status:501});}