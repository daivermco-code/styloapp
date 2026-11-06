/** Una reseña del cliente para Mis reseñas (US-031). */
export interface MyReview {
  id: string;
  attention: number;
  quality: number;
  comment: string | null;
  createdAt: string;
  businessName: string;
  staffName: string;
  serviceName: string;
}
