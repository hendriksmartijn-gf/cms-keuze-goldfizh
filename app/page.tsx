import { getMatrix } from "@/lib/data.ts";
import { veiligeParent } from "@/lib/config.ts";
import { vanCode } from "@/lib/scoring.ts";
import { vragen } from "@/lib/vragen.ts";
import Keuzehulp from "./keuzehulp.tsx";

type Params = Record<string, string | string[] | undefined>;
const een = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function Page({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const matrix = await getMatrix();
  const parent = veiligeParent(een(sp.parent), een(sp.p));

  return (
    <main className={parent ? "embed" : "standalone"}>
      <Keuzehulp
        matrix={matrix}
        vragen={vragen}
        startKeuzes={vanCode(een(sp.keuze), vragen)}
        parentOrigin={parent?.origin ?? null}
        parentUrl={parent?.deelUrl ?? null}
      />
    </main>
  );
}
