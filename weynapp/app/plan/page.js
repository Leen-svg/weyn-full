import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PlannerClient from "@/components/PlannerClient";
import { privatePageMetadata } from "@/lib/seo";
export const metadata=privatePageMetadata({title:"Plan with Weyn",description:"Import places, filter saved spots, build a day and share a trip board."});
export default async function PlanPage(){const s=await createClient();const{data:{user}}=await s.auth.getUser();if(!user)redirect("/login?next=/plan");return <div className="screen-plan"><header className="screen-plan__header"><span className="eyebrow">Your place planner</span><h1>Turn saved pins into a plan</h1><p className="sub">Import a place, choose up to four saved spots, and build a route your group can actually use.</p></header><PlannerClient/></div>}
