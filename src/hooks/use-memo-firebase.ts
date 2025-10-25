
import { useMemo } from 'react';
import { isEqual } from 'lodash';

// Custom hook for deep memoization
function useDeepCompareMemoize(value: any) {
  const ref = React.useRef();

  if (!isEqual(value, ref.current)) {
    ref.current = value;
  }

  return ref.current;
}

export function useMemoFirebase<T>(factory: () => T, deps: any[]): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(factory, useDeepCompareMemoize(deps));
}
