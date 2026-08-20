import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { contentAccountError, validateCommunityText } from "@/lib/content-safety";
import { payloadTooLarge } from "@/lib/request-security.mjs";
import { rateLimit } from "@/lib/request-security";
export async function POST(req){if(payloadTooLarge(req,8*1024))return NextResponse.json({error:"Request too large"},{status:413});const s=await createClient();const{data:{user}}=await s.auth.getUser();if(!user)return NextResponse.json({error:"Log in"},{status:401});const accountError=await contentAccountError(user);if(accountError)return NextResponse.json({error:accountError},{status:403});const limited=await rateLimit(req,"board-create",20,24*60*60,user.id);if(!limited.allowed)return NextResponse.json({error:"You've reached today's board limit."},{status:429});const b=await req.json();const checked=validateCommunityText(b.title,{required:true,maxLength:80});if(checked.error)return NextResponse.json({error:checked.error},{status:400});const{data,error}=await s.from("trip_boards").insert({owner_id:user.id,title:checked.text,is_public:!!b.isPublic}).select("*").single();return error?NextResponse.json({error:"Couldn't create that board"},{status:500}):NextResponse.json({board:data});}

