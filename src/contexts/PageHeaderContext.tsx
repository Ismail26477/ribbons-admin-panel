import { createContext, useContext, useEffect, useState, ReactNode } from "react";

interface HeaderState {
  title: string;
  description?: string;
  actions?: ReactNode;
}

interface Ctx {
  header: HeaderState;
  setHeader: (h: HeaderState) => void;
}

const PageHeaderCtx = createContext<Ctx | undefined>(undefined);

export const PageHeaderProvider = ({ children }: { children: ReactNode }) => {
  const [header, setHeader] = useState<HeaderState>({ title: "" });
  return (
    <PageHeaderCtx.Provider value={{ header, setHeader }}>
      {children}
    </PageHeaderCtx.Provider>
  );
};

export const usePageHeaderState = () => {
  const c = useContext(PageHeaderCtx);
  if (!c) throw new Error("usePageHeaderState must be inside PageHeaderProvider");
  return c;
};

/** Hook used by pages to register their header. */
export const usePageHeader = (h: HeaderState, deps: ReadonlyArray<unknown> = []) => {
  const { setHeader } = usePageHeaderState();
  useEffect(() => {
    setHeader(h);
    return () => setHeader({ title: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
};
