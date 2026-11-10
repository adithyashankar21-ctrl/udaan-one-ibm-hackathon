import React from 'react';
import { Skeleton, SkeletonCard } from './kit';

/** Shown while a page is arriving: the shape of a page, so nothing jumps when it lands. */
export const PageLoading: React.FC = () => (
  <div className="space-y-6" role="status" aria-busy="true" aria-label="Loading">
    <div className="card space-y-4 p-6 sm:p-8">
      <Skeleton className="h-3.5 w-28" />
      <Skeleton className="h-8 w-2/3 max-w-md" />
      <Skeleton className="h-4 w-full max-w-xl" />
      <Skeleton className="h-4 w-4/5 max-w-lg" />
      <Skeleton className="mt-2 h-11 w-44 !rounded-full" />
    </div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </div>
  </div>
);
