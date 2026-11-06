import type { Metadata } from "next";
import { MyReviews } from "@/features/reviews/components/my-reviews";
import { getMyReviews } from "@/features/reviews/services/queries";
import { ClientTopBar } from "@/shared/components/top-bar";

export const metadata: Metadata = { title: "Mis reseñas" };

// Mis reseñas (US-031). Sin sesión, el proxy la reescribe a "Mejora tu experiencia".
export default async function MyReviewsPage() {
  const reviews = await getMyReviews();
  return (
    <>
      <ClientTopBar title="Mis reseñas" />
      <main className="p-4 md:p-6">
        <MyReviews reviews={reviews} />
      </main>
    </>
  );
}
