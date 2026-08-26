import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import MapChooser from "@/components/MapChooser";
import styles from "@/components/AccountPages.module.css";

async function board(slug) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const service = db();
  const { data: found } = await service.from("trip_boards")
    .select("id,owner_id,title,visibility,is_public,archived_at")
    .eq("share_slug", slug)
    .maybeSingle();
  if (!found || found.archived_at) return { board: null, user };

  let allowed = found.visibility === "public" || found.is_public === true || user?.id === found.owner_id;
  if (!allowed && user) {
    const [{ data: member }, { data: friendship }] = await Promise.all([
      service.from("trip_board_members").select("board_id").eq("board_id", found.id).eq("user_id", user.id).maybeSingle(),
      found.visibility === "friends"
        ? service.from("friendships").select("id").eq("status", "accepted").or(`and(requester_id.eq.${user.id},addressee_id.eq.${found.owner_id}),and(requester_id.eq.${found.owner_id},addressee_id.eq.${user.id})`).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    allowed = Boolean(member || friendship);
  }
  if (!allowed) return { board: found, user, denied: true };

  const { data: places } = await service.from("trip_board_places")
    .select("id,position,venues(*),personal_places(name,neighborhood,city,latitude,longitude),trip_board_votes(vote)")
    .eq("board_id", found.id)
    .order("position");
  return {
    user,
    board: {
      ...found,
      places: (places || []).map((row) => ({
        ...row,
        ...(row.venues || row.personal_places),
        score: (row.trip_board_votes || []).reduce((total, vote) => total + vote.vote, 0),
      })),
    },
  };
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const result = await board(slug);
  const item = result.denied ? null : result.board;
  return item
    ? { title: `${item.title}, Weyn`, description: `A Weyn plan with ${item.places.length} places.`, robots: { index: item.visibility === "public", follow: false } }
    : { title: "Plan not found, Weyn", robots: { index: false, follow: false } };
}

export default async function BoardPage({ params }) {
  const { slug } = await params;
  const result = await board(slug);
  if (!result.board) notFound();
  if (result.denied) redirect(`/login?next=/b/${encodeURIComponent(slug)}`);
  const item = result.board;
  return (
    <div className={styles.pageNarrow}>
      <header className={styles.header}>
        <span className="eyebrow">Shared Weyn board · {item.visibility}</span>
        <h1>{item.title}</h1>
        <p className="sub">A clear route with working map choices for every mapped stop.</p>
      </header>
      <div className={styles.boardPlaceList}>
        {item.places.map((place, index) => (
          <article className={styles.boardPlace} key={place.id}>
            <div className={styles.boardPlaceTop}>
              <div className={styles.boardPlaceName}>
                <strong>{index + 1}. {place.name}</strong>
                <span className="sub">{place.neighborhood || place.city || "UAE"} · {place.score} votes</span>
              </div>
              <MapChooser venue={place} />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
