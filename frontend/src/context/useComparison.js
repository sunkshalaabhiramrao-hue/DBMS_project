import { useContext } from 'react';
import { ComparisonContext } from './comparisonContext';

export function useComparison() {
  return useContext(ComparisonContext);
}
