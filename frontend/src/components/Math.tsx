import { InlineMath, BlockMath } from "react-katex";

export function M({ children }: { children: string }) {
  return <InlineMath math={children} />;
}

export function MB({ children }: { children: string }) {
  return <BlockMath math={children} />;
}
