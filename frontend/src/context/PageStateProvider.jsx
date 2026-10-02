import { useCallback, useState } from 'react';
import PageStateContext from './PageStateContext';

export function PageStateProvider({ children }) {
  const [pageState, setPageState] = useState({});
  const updateValue = useCallback((key, updater) => {
    setPageState((current) => {
      const previous = Object.prototype.hasOwnProperty.call(current, key) ? current[key] : undefined;
      const next = typeof updater === 'function' ? updater(previous) : updater;
      return { ...current, [key]: next };
    });
  }, []);
  const resetPageState = useCallback(() => setPageState({}), []);

  return <PageStateContext.Provider value={{ pageState, updateValue, resetPageState }}>{children}</PageStateContext.Provider>;
}
