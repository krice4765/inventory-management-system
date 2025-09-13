import React, { Suspense } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { LazyLoadingSpinner } from './LazyLoadingSpinner';

interface LazyRouteProps {
  component: React.ComponentType<any>;
  fallback?: React.ComponentType;
  errorFallback?: React.ReactNode;
}

export const LazyRoute: React.FC<LazyRouteProps> = ({ 
  component: Component, 
  fallback: Fallback,
  errorFallback
}) => {
  const FallbackComponent = Fallback || LazyLoadingSpinner;

  return (
    <ErrorBoundary fallback={errorFallback}>
      <Suspense fallback={<FallbackComponent />}>
        <Component />
      </Suspense>
    </ErrorBoundary>
  );
};

export default LazyRoute;