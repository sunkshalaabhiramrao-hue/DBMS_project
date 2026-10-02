import { useCallback, useContext } from 'react';
import PageStateContext from './PageStateContext';

export function usePageState(key, initialValue) {
  const pageStateContext = useContext(PageStateContext);
  if (!pageStateContext) throw new Error('usePageState must be used inside PageStateProvider');

  const { pageState, updateValue } = pageStateContext;
  const hasValue = Object.prototype.hasOwnProperty.call(pageState, key);
  const value = hasValue ? pageState[key] : initialValue;
  const setValue = useCallback((nextValue) => updateValue(key, (current) => {
    const currentValue = current === undefined ? initialValue : current;
    return typeof nextValue === 'function' ? nextValue(currentValue) : nextValue;
  }), [initialValue, key, updateValue]);

  return [value, setValue];
}

export function useResetPageState() {
  const pageStateContext = useContext(PageStateContext);
  if (!pageStateContext) throw new Error('useResetPageState must be used inside PageStateProvider');
  return pageStateContext.resetPageState;
}