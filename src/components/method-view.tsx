import { catalog, itemByRecipeName } from "@/lib/catalog";
import { formatCredits, outputValue } from "@/lib/optimizer";
import { ItemIcon, Panel } from "./ui";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "long",
  timeStyle: "short",
});

const rules = [
  "Les prix sont ceux de la wiki communautaire, pas une API officielle Embark.",
  "Le craft n'est pas valorisé en crédits : il est signalé, pas monétisé.",
  "Le salvage n'est pas pris en compte : seuls les rendements de recyclage comptent.",
  "Les armes sont lues depuis les pages wiki, pas depuis la table Cargo. Les blueprints ne sont pas vérifiés : le plan suppose la recette apprise.",
  "Quelques variantes d'armes n'ont pas de prix de vente sur la wiki : elles s'affichent à 0 CR.",
  "Un patch peut changer un rendement : relance la synchronisation avant de décider.",
];

export const MethodView = () => {
  const rocketeer = itemByRecipeName("Rocketeer Driver");
  const advancedElectrical = itemByRecipeName("Advanced Electrical Components");
  const weaponCount = catalog.items.filter((item) => item.type === "Weapon").length;

  return (
    <div className="grid gap-3">
      <Panel
        title="Comprendre les calculs"
        description="Formules, verdicts et limites"
        className="gap-0"
      >
        <div className="grid gap-2 p-3 sm:grid-cols-2">
          <section className="rounded-lg border border-border bg-black/25 p-3">
            <h3 className="mb-1 text-xs font-semibold">1. La place</h3>
            <p className="text-[11.5px] leading-relaxed text-muted-foreground">
              Chaque item a une taille de stack.{" "}
              <code className="rounded border border-border bg-white/5 px-1 text-[10.5px] text-primary">
                slots = ⌈quantité ÷ stack⌉
              </code>
              . Un stack partiel occupe quand même un slot entier. La densité compare ensuite la
              valeur au nombre de slots.
            </p>
          </section>
          <section className="rounded-lg border border-border bg-black/25 p-3">
            <h3 className="mb-1 text-xs font-semibold">2. La valeur</h3>
            <p className="text-[11.5px] leading-relaxed text-muted-foreground">
              La revente vaut{" "}
              <code className="rounded border border-border bg-white/5 px-1 text-[10.5px] text-primary">
                prix × quantité
              </code>
              . Le recyclage vaut la somme des sorties, valorisées au prix de vente wiki. On garde
              la meilleure des deux options, puis on applique les règles de garde ci-dessous.
            </p>
          </section>
          <section className="rounded-lg border border-border bg-black/25 p-3">
            <h3 className="mb-1 text-xs font-semibold">3. Le verdict</h3>
            <p className="text-[11.5px] leading-relaxed text-muted-foreground">
              Recyclage supérieur à la vente de plus de 8 % →{" "}
              <strong className="text-foreground">recycler</strong>. Item rare ou mieux utilisé dans
              des recettes → <strong className="text-foreground">garder</strong>. Sinon, la vente
              l'emporte. Le détail chiffré est toujours affiché.
            </p>
          </section>
          <section className="rounded-lg border border-border bg-black/25 p-3">
            <h3 className="mb-1 text-xs font-semibold">4. L'inverse</h3>
            <p className="text-[11.5px] leading-relaxed text-muted-foreground">
              Pour un matériau cible :{" "}
              <code className="rounded border border-border bg-white/5 px-1 text-[10.5px] text-primary">
                items = ⌈besoin ÷ rendement⌉
              </code>
              , puis{" "}
              <code className="rounded border border-border bg-white/5 px-1 text-[10.5px] text-primary">
                slots = ⌈items ÷ stack⌉
              </code>
              . Le plan classe les sources par place nécessaire, et le rendement par slot plein.
            </p>
          </section>
          <section className="rounded-lg border border-border bg-black/25 p-3">
            <h3 className="mb-1 text-xs font-semibold">5. Les objectifs</h3>
            <p className="text-[11.5px] leading-relaxed text-muted-foreground">
              Pour chaque composant voulu, les sources recyclables plus denses qu'un stack du
              composant direct sont réservées d'abord, puis le composant direct, puis les sources
              moins denses. Tout ce qui reste est du surplus à vendre ou recycler.
            </p>
          </section>
          <section className="rounded-lg border border-border bg-black/25 p-3">
            <h3 className="mb-1 text-xs font-semibold">6. Les recettes</h3>
            <p className="text-[11.5px] leading-relaxed text-muted-foreground">
              Pour une arme ou un équipement, la recette est dépliée récursivement. Les ingrédients
              directs passent avant les sources recyclables et les sous-recettes. Les manques sont
              listés jusqu'aux composants de base.
            </p>
          </section>
        </div>

        <div className="mx-3 grid gap-2 rounded-lg border border-border bg-black/25 p-3">
          <span className="text-[10px] font-bold tracking-[0.14em] text-primary uppercase">
            Exemple vérifié
          </span>
          {rocketeer ? (
            <div className="flex items-center gap-2.5">
              <ItemIcon item={rocketeer} size="sm" />
              <div>
                <strong className="text-[13px]">{rocketeer.name}</strong>
                <p className="text-[11.5px] text-muted-foreground">
                  {Object.entries(rocketeer.recycle)
                    .map(([name, qty]) => `${qty}× ${name}`)
                    .join(" + ")}{" "}
                  en recyclage ({formatCredits(outputValue(rocketeer.recycle))} CR) contre{" "}
                  {formatCredits(rocketeer.sell)} CR à la vente. Stack de {rocketeer.stack}.
                </p>
              </div>
            </div>
          ) : null}
          <p className="text-[11px] text-muted-foreground">
            Le vieux réflexe « 3 Advanced Electrical + 9 ARC Alloy » n'est plus le rendement actuel.
            La fiche wiki donne 2 Advanced Electrical + 3 ARC Alloy. Le site lit cette fiche, pas
            une table figée dans le code.
          </p>
        </div>

        {advancedElectrical ? (
          <div className="mx-3 grid gap-2 rounded-lg border border-border bg-black/25 p-3">
            <span className="text-[10px] font-bold tracking-[0.14em] text-primary uppercase">
              Référence stack
            </span>
            <div className="flex items-center gap-2.5">
              <ItemIcon item={advancedElectrical} size="sm" />
              <div>
                <strong className="text-[13px]">{advancedElectrical.name}</strong>
                <p className="text-[11.5px] text-muted-foreground">
                  Stack de {advancedElectrical.stack} : 11 unités prennent 3 slots, pas 2. À{" "}
                  {formatCredits(advancedElectrical.sell)} CR l'unité, un slot plein vaut{" "}
                  {formatCredits(advancedElectrical.sell * advancedElectrical.stack)} CR.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="px-4 py-3">
          <h3 className="mb-1.5 text-xs font-semibold">Les limites</h3>
          <ul className="grid list-disc gap-0.5 pl-4 text-[11.5px] text-muted-foreground">
            {rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </div>
      </Panel>

      <Panel title="Données" description="Fraîcheur et source">
        <div className="grid gap-2 px-4 pt-3 sm:grid-cols-3">
          <div className="grid gap-0.5 rounded-lg border border-border bg-black/25 p-3">
            <span className="text-[10px] font-bold tracking-[0.14em] text-primary uppercase">
              Dernière synchronisation
            </span>
            <strong className="text-[13px]">
              {dateFormatter.format(new Date(catalog.generatedAt))}
            </strong>
          </div>
          <div className="grid gap-0.5 rounded-lg border border-border bg-black/25 p-3">
            <span className="text-[10px] font-bold tracking-[0.14em] text-primary uppercase">
              Source
            </span>
            <a
              className="text-[13px] text-primary underline-offset-4 hover:underline"
              href={catalog.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              {catalog.source}
            </a>
          </div>
          <div className="grid gap-0.5 rounded-lg border border-border bg-black/25 p-3">
            <span className="text-[10px] font-bold tracking-[0.14em] text-primary uppercase">
              Couverture
            </span>
            <strong className="text-[13px]">
              {catalog.counts.items} objets · {catalog.counts.recycling} rendements ·{" "}
              {catalog.counts.crafting} recettes
            </strong>
          </div>
        </div>
        <p className="px-4 pt-3 text-[11.5px] text-muted-foreground">
          Le catalogue est généré depuis les tables Cargo de la wiki (items, recycling, crafting),
          complété par les pages d'armes pour {weaponCount} variantes et leurs recettes. Les icônes
          sont copiées en local. Pour rafraîchir après un patch :
        </p>
        <pre className="mx-4 mt-2 rounded-lg border border-border bg-[#090c10] px-3 py-2 text-xs text-primary">
          <code>pnpm data:update</code>
        </pre>
        <p className="px-4 py-3 text-[11.5px] text-muted-foreground">
          La synchronisation récupère les derniers rendements, prix, stacks et recettes. Elle ne
          modifie aucune décision déjà saisie dans ton navigateur.
        </p>
      </Panel>
    </div>
  );
};
