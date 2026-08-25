import Link from "next/link";
import { safeUrl } from "@/lib/sanitize";

/* The "Curated by Weyn" collection tile: a cover image with the title
   and spot count sitting on a dark scrim at the bottom.

   The cover is borrowed from the collection's first venue rather than
   stored on the list, because curated_lists has no image column and
   inventing one would mean a migration plus an admin upload flow for
   what is, visually, the same picture the user is about to see. */
export default function CollectionCard({ list }) {
  const cover = safeUrl(list.venues?.[0]?.cover_url);
  const count = list.venues?.length || 0;

  return (
    <Link href={`/collections/${list.id}`} className="collection-card lv-press">
      {cover ? (
        <img src={cover} alt="" width="512" height="320" loading="lazy" decoding="async" />
      ) : (
        <span className="collection-card__fallback" aria-hidden="true" />
      )}
      <span className="collection-card__scrim">
        <span className="collection-card__title">{list.title}</span>
        <span className="collection-card__count">
          {count} {count === 1 ? "spot" : "spots"}
        </span>
      </span>
    </Link>
  );
}
