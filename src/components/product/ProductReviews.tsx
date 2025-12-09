"use client";

import { useState, useMemo } from "react";
import { Star, ThumbsUp, CheckCircle, User } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useReviewStore, type Review } from "@/stores/reviewStore";
import { Button, Input } from "@/components/ui";
import { cn } from "@/lib/utils";

interface ProductReviewsProps {
  productId: string;
}

export function ProductReviews({ productId }: ProductReviewsProps) {
  const [showForm, setShowForm] = useState(false);
  const allReviews = useReviewStore((state) => state.reviews);
  const markHelpful = useReviewStore((state) => state.markHelpful);

  // Memoize filtered reviews to prevent infinite re-renders
  const reviews = useMemo(
    () => allReviews.filter((r) => r.productId === productId),
    [allReviews, productId]
  );

  const averageRating = useMemo(() => {
    if (reviews.length === 0) return 0;
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    return Math.round((sum / reviews.length) * 10) / 10;
  }, [reviews]);

  const ratingDistribution = [5, 4, 3, 2, 1].map((rating) => ({
    rating,
    count: reviews.filter((r) => r.rating === rating).length,
    percentage: reviews.length > 0
      ? (reviews.filter((r) => r.rating === rating).length / reviews.length) * 100
      : 0,
  }));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Reseñas de Clientes</h2>
          <p className="text-gray-500">{reviews.length} reseñas</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancelar" : "Escribir Reseña"}
        </Button>
      </div>

      {/* Review Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <ReviewForm productId={productId} onClose={() => setShowForm(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Summary */}
      <div className="grid md:grid-cols-2 gap-8 p-6 bg-gray-50 dark:bg-gray-800 rounded-2xl">
        {/* Average Rating */}
        <div className="text-center md:text-left">
          <div className="text-5xl font-bold mb-2">{averageRating || "-"}</div>
          <div className="flex justify-center md:justify-start gap-1 mb-2">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={cn(
                  "w-5 h-5",
                  i < Math.round(averageRating)
                    ? "fill-amber-400 text-amber-400"
                    : "fill-gray-200 text-gray-200"
                )}
              />
            ))}
          </div>
          <p className="text-gray-500 text-sm">Basado en {reviews.length} reseñas</p>
        </div>

        {/* Rating Distribution */}
        <div className="space-y-2">
          {ratingDistribution.map(({ rating, count, percentage }) => (
            <div key={rating} className="flex items-center gap-3">
              <span className="text-sm w-16">{rating} estrellas</span>
              <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-400 rounded-full transition-all"
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <span className="text-sm text-gray-500 w-8">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Reviews List */}
      <div className="space-y-6">
        {reviews.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p>Aún no hay reseñas para este producto.</p>
            <p className="text-sm mt-1">¡Sé el primero en dejar tu opinión!</p>
          </div>
        ) : (
          reviews.map((review) => (
            <ReviewCard key={review.id} review={review} onMarkHelpful={markHelpful} />
          ))
        )}
      </div>
    </div>
  );
}

// Review Card Component
function ReviewCard({
  review,
  onMarkHelpful,
}: {
  review: Review;
  onMarkHelpful: (id: string) => void;
}) {
  const [hasMarked, setHasMarked] = useState(false);

  const handleHelpful = () => {
    if (!hasMarked) {
      onMarkHelpful(review.id);
      setHasMarked(true);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="border-b pb-6 last:border-0"
    >
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center flex-shrink-0">
          <User className="w-5 h-5 text-gray-500" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold">{review.userName}</span>
            {review.verified && (
              <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                <CheckCircle className="w-3 h-3" />
                Compra verificada
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mb-2">
            <div className="flex">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={cn(
                    "w-4 h-4",
                    i < review.rating
                      ? "fill-amber-400 text-amber-400"
                      : "fill-gray-200 text-gray-200"
                  )}
                />
              ))}
            </div>
            <span className="text-sm text-gray-500">{review.date}</span>
          </div>
          <h4 className="font-semibold mb-1">{review.title}</h4>
          <p className="text-gray-600 dark:text-gray-400">{review.comment}</p>
          <button
            onClick={handleHelpful}
            disabled={hasMarked}
            className={cn(
              "flex items-center gap-2 mt-3 text-sm transition-colors",
              hasMarked
                ? "text-gray-400 cursor-default"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            <ThumbsUp className={cn("w-4 h-4", hasMarked && "fill-current")} />
            Útil ({review.helpful + (hasMarked ? 1 : 0)})
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// Review Form Component
function ReviewForm({
  productId,
  onClose,
}: {
  productId: string;
  onClose: () => void;
}) {
  const addReview = useReviewStore((state) => state.addReview);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [name, setName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0 || !title || !comment || !name) return;

    addReview({
      productId,
      userId: `user-${Date.now()}`,
      userName: name,
      rating,
      title,
      comment,
      verified: false,
    });

    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 bg-gray-50 dark:bg-gray-800 rounded-2xl space-y-4">
      <h3 className="font-bold text-lg">Escribir una reseña</h3>

      {/* Rating Selection */}
      <div>
        <label className="block text-sm font-medium mb-2">Tu calificación</label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              className="p-1"
            >
              <Star
                className={cn(
                  "w-8 h-8 transition-colors",
                  (hoverRating || rating) >= star
                    ? "fill-amber-400 text-amber-400"
                    : "fill-gray-200 text-gray-200"
                )}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Name */}
      <div>
        <label className="block text-sm font-medium mb-2">Tu nombre</label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tu nombre"
          required
        />
      </div>

      {/* Title */}
      <div>
        <label className="block text-sm font-medium mb-2">Título</label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Resume tu experiencia"
          required
        />
      </div>

      {/* Comment */}
      <div>
        <label className="block text-sm font-medium mb-2">Tu reseña</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Cuéntanos más sobre tu experiencia con este producto..."
          rows={4}
          required
          className="w-full px-4 py-3 bg-white dark:bg-gray-900 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-lego-yellow resize-none"
        />
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={!rating || !title || !comment || !name}>
          Publicar Reseña
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
