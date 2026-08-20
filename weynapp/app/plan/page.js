import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PlannerClient from "@/components/PlannerClient";
import { privatePageMetadata } from "@/lib/seo";
export const metadata=privatePageMetadata({title:"Plan with Weyn",description:"Import places, filter saved spots, build a day and share a trip board."});
export default async function PlanPage(){const s=await createClient();const{data:{user}}=await s.auth.getUser();if(!user)redirect("/login?next=/plan");return <><span className="eyebrow">Your place planner</span><h1>Turn saved pins<br/><span className="mark">into a plan.</span></h1><PlannerClient/></>}
