import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * Automatically scrolls to top on navigation, unless it's a POP action (back/forward).
 */
export function useScrollToTop() {
  const { pathname } = useLocation();
  const action = useNavigationType();

  useEffect(() => {
    // 'POP' means the user clicked the Back or Forward button.
    // In that case, we want to let the browser restore the previous scroll position.
    // For 'PUSH' (new link) or 'REPLACE', we scroll to the top.
    console.log("🚀 ~ useScrollToTop ~ action:", action);
    if (action !== 'POP') {
      window.scrollTo(0, 0);
    }
  }, [action, pathname]);
}
