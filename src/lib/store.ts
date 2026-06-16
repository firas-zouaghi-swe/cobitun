import { create } from 'zustand';
import { Roles } from '@/lib/roles';
import { persist } from 'zustand/middleware';

export interface UserInfo {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  role: string;
  customerId?: number;
}

interface WorkflowContext {
  policyId: number | null;
  claimId: number | null;
}

interface AppStore {
  // Hydration state for persisted storage
  hydrated: boolean;
  setHydrated: () => void;

  // Auth
  user: UserInfo | null;
  isAuthenticated: boolean;
  login: (user: UserInfo) => void;
  logout: () => void;

  // Navigation
  currentPage: string;
  previousPage: string;
  setCurrentPage: (page: string) => void;
  goBack: () => void;

  // Workflow context for passing IDs between pages
  workflowContext: WorkflowContext;
  setWorkflowContext: (ctx: Partial<WorkflowContext>) => void;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      hydrated: false,
      setHydrated: () => set({ hydrated: true }),

      // Auth state
      user: null,
      isAuthenticated: false,
      login: (user: UserInfo) =>
        set({
          user,
          isAuthenticated: true,
          currentPage:
            user.role === Roles.ADMIN || user.role === Roles.SUPER_ADMIN
              ? 'admin-dashboard'
              : 'customer-dashboard',
          workflowContext: { policyId: null, claimId: null },
        }),
      logout: () =>
        set({
          user: null,
          isAuthenticated: false,
          currentPage: 'home',
          workflowContext: { policyId: null, claimId: null },
        }),

      // Navigation state
      currentPage: 'home',
      previousPage: 'home',
      setCurrentPage: (page: string) => set((state) => ({ previousPage: state.currentPage, currentPage: page })),
      goBack: () => set((state) => ({ currentPage: state.previousPage, previousPage: state.currentPage })),

      // Workflow context
      workflowContext: { policyId: null, claimId: null },
      setWorkflowContext: (ctx: Partial<WorkflowContext>) =>
        set((state) => ({
          workflowContext: { ...state.workflowContext, ...ctx },
        })),
    }),
    {
      name: 'cobitun-app-store',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        currentPage: state.currentPage,
        workflowContext: state.workflowContext,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated?.();
      },
    }
  )
);

