import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";

export async function middleware(request:NextRequest){
 let response=NextResponse.next({request:{headers:request.headers}});
 const supabase=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{
   cookies:{getAll(){return request.cookies.getAll();},setAll(cookies){cookies.forEach(({name,value,options})=>response.cookies.set(name,value,options));}}
 });
 const {data:{user}}=await supabase.auth.getUser();
 const path=request.nextUrl.pathname;
 if(path==="/login" && user){
   const {data:p}=await supabase.from("profiles").select("status").eq("id",user.id).maybeSingle();
   if(p?.status==="Approved") return NextResponse.redirect(new URL("/dashboard",request.url));
 }
 if(path!=="/login" && !path.startsWith("/api")){
   if(!user) return NextResponse.redirect(new URL("/login",request.url));
   const {data:p}=await supabase.from("profiles").select("status").eq("id",user.id).maybeSingle();
   if(p?.status!=="Approved") return NextResponse.redirect(new URL("/login",request.url));
 }
 return response;
}
export const config={matcher:["/((?!_next/static|_next/image|favicon.ico).*)"]};
