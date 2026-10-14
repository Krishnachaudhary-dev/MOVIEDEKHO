import Image from "next/image";

import { getProfileUrl } from "@/lib/tmdb";
import type { TmdbCastMember } from "@/lib/types/tmdb";

/**
 * CastCarousel — circular profile avatars with actor names and characters.
 *
 * Presentational and dependency-free: the title page already holds the credits
 * (details request appends them), so this renders without any fetching of its
 * own and stays a server component.
 */

interface CastCarouselProps {
  cast: TmdbCastMember[];
}

export default function CastCarousel({ cast }: CastCarouselProps) {
  if (cast.length === 0) return null;

  return (
    <section aria-label="Cast">
      <h2 className="mb-3 text-lg font-bold uppercase tracking-wider text-muted sm:text-xl">
        Top billed cast
      </h2>
      <ul className="no-scrollbar -mx-1 flex gap-4 overflow-x-auto px-1 pb-2">
        {cast.map((member) => {
          const profile = getProfileUrl(member.profile_path, "w185");
          return (
            <li key={member.credit_id} className="w-24 shrink-0 sm:w-28">
              <div className="relative aspect-square w-full overflow-hidden rounded-full bg-surface ring-1 ring-white/10">
                {profile ? (
                  <Image
                    src={profile}
                    alt={member.name}
                    fill
                    sizes="112px"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-lg font-black text-faint">
                    {member.name.slice(0, 1)}
                  </div>
                )}
              </div>
              <p className="mt-2 truncate text-center text-xs font-semibold text-foreground">
                {member.name}
              </p>
              <p className="truncate text-center text-xs text-faint">{member.character}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
