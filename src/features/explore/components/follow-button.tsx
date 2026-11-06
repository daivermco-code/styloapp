"use client";

import { Check, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useActionTransition } from "@/shared/hooks/use-action-transition";
import { useHydrated } from "@/shared/hooks/use-hydrated";
import { toggleFollow } from "../services/actions";
import { LoginPromptDialog } from "./login-prompt";

interface FollowButtonProps {
  businessId: string;
  following: boolean;
  followers: number;
  signedIn: boolean;
  /** A dónde vuelve Entrar sin sesión. */
  next: string;
  className?: string;
}

function followersLabel(count: number): string {
  return count === 1
    ? "1 seguidor"
    : `${count.toLocaleString("es-CO")} seguidores`;
}

// "+ Seguir" con el número de seguidores (US-026): el número cambia al momento. Sin sesión abre
// "Mejora tu experiencia".
export function FollowButton({
  businessId,
  following: initialFollowing,
  followers: initialFollowers,
  signedIn,
  next,
  className,
}: FollowButtonProps) {
  const hydrated = useHydrated();
  const [following, setFollowing] = useState(initialFollowing);
  const [followers, setFollowers] = useState(initialFollowers);
  const [prompt, setPrompt] = useState(false);
  const [pending, startTransition] = useActionTransition();

  const toggle = () => {
    if (!signedIn) {
      setPrompt(true);
      return;
    }
    const wasFollowing = following;
    setFollowing(!wasFollowing);
    setFollowers((count) => count + (wasFollowing ? -1 : 1));
    startTransition(async () => {
      const result = await toggleFollow({ businessId });
      if (result.ok && result.data.following !== wasFollowing) return;
      setFollowing(wasFollowing);
      setFollowers((count) => count + (wasFollowing ? 1 : -1));
      if (!result.ok) toast.error(result.error.message);
    });
  };

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <button
        type="button"
        onClick={toggle}
        disabled={!hydrated || pending}
        aria-pressed={signedIn ? following : undefined}
        className="flex min-h-11 items-center gap-1 rounded-full px-3 text-16 font-bold text-primary transition-colors duration-120 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
      >
        {following ? (
          <Check className="size-4" strokeWidth={2.5} aria-hidden />
        ) : (
          <Plus className="size-4" strokeWidth={2.5} aria-hidden />
        )}
        {following ? "Siguiendo" : "Seguir"}
      </button>
      <span className="text-14 text-slate">{followersLabel(followers)}</span>
      <LoginPromptDialog open={prompt} onOpenChange={setPrompt} next={next} />
    </div>
  );
}
