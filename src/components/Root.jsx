import { Outlet } from 'react-router';
import { AppearanceProvider } from './AppearanceProvider';

// Global wrapper: wraps every route in the AppearanceProvider context
export function Root() {
  return (
    <AppearanceProvider>
      <Outlet />
    </AppearanceProvider>
  );
}
