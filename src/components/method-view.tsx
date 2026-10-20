import { itemsByName } from "../lib/catalog";
import { catalog } from "../lib/catalog";
import { formatCredits, outputValue } from "../lib/optimizer";
import { ItemIcon, Panel } from "./ui";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "long",
  timeStyle: "short",
});

export const MethodView = () => {
  const rocketeer = itemsByName.get("Rocketeer Driver");
  const advancedElectrical = itemsByName.get("Advanced Electrical Components");
  const weaponCount = catalog.items.filter((item) => item.type === "Weapon").length;

  return (
    <div className="method">
      <Panel title="Comprendre les calculs" eyebrow="Comment le calcul fonctionne">
        <div className="method-grid">
          <section>
            <h3>1. La place</h3>
            <p>
              Chaque item a une taille de stack. <code>slots = ⌈quantité ÷ stack⌉</code>. Un stack
              partiel occupe quand même un slot entier. La densité compare ensuite la valeur au
              nombre de slots.
            </p>
          </section>
          <section>
            <h3>2. La valeur</h3>
            <p>
              La revente vaut <code>prix × quantité</code>. Le recyclage vaut la somme des sorties,
              valorisées au prix de vente wiki. On garde la meilleure des deux options, puis on
              applique les règles de garde ci-dessous.
            </p>
          </section>
          <section>
            <h3>3. Le verdict</h3>
            <p>
              Recyclage supérieur à la vente de plus de 8 % → <strong>recycler</strong>. Item rare
              ou mieux utilisé dans des recettes → <strong>garder</strong>. Sinon, la vente
              l'emporte. Le détail chiffré est toujours affiché.
            </p>
          </section>
          <section>
            <h3>4. L'inverse</h3>
            <p>
              Pour un matériau cible : <code>items = ⌈besoin ÷ rendement⌉</code>, puis{" "}
              <code>slots = ⌈items ÷ stack⌉</code>. Le plan classe les sources par place nécessaire,
              et le rendement par slot plein.
            </p>
          </section>
          <section>
            <h3>5. Les objectifs</h3>
            <p>
              Pour chaque composant voulu, les sources recyclables plus denses qu'un stack du
              composant direct sont réservées d'abord, puis le composant direct, puis les sources
              moins denses. Tout ce qui reste est du surplus à vendre ou recycler.
            </p>
          </section>
          <section>
            <h3>6. Les recettes</h3>
            <p>
              Pour une arme ou un équipement, la recette est dépliée récursivement. Les ingrédients
              directs passent avant les sources recyclables et les sous-recettes. Les manques sont
              listés jusqu'aux composants de base.
            </p>
          </section>
        </div>

        <div className="formula">
          <span>Exemple vérifié</span>
          {rocketeer ? (
            <div className="formula__item">
              <ItemIcon item={rocketeer} size="sm" />
              <div>
                <strong>{rocketeer.name}</strong>
                <p>
                  {Object.entries(rocketeer.recycle)
                    .map(([name, qty]) => `${qty}× ${name}`)
                    .join(" + ")}{" "}
                  en recyclage ({formatCredits(outputValue(rocketeer.recycle))} CR) contre{" "}
                  {formatCredits(rocketeer.sell)} CR à la vente. Stack de {rocketeer.stack}.
                </p>
              </div>
            </div>
          ) : null}
          <p className="muted">
            Le vieux réflexe « 3 Advanced Electrical + 9 ARC Alloy » n'est plus le rendement actuel.
            La fiche wiki donne 2 Advanced Electrical + 3 ARC Alloy. Le site lit cette fiche, pas
            une table figée dans le code.
          </p>
        </div>

        {advancedElectrical ? (
          <div className="formula">
            <span>Référence stack</span>
            <div className="formula__item">
              <ItemIcon item={advancedElectrical} size="sm" />
              <div>
                <strong>{advancedElectrical.name}</strong>
                <p>
                  Stack de {advancedElectrical.stack} : 11 unités prennent 3 slots, pas 2. À{" "}
                  {formatCredits(advancedElectrical.sell)} CR l'unité, un slot plein vaut{" "}
                  {formatCredits(advancedElectrical.sell * advancedElectrical.stack)} CR.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="rules">
          <h3>Les limites</h3>
          <ul>
            <li>Les prix sont ceux de la wiki communautaire, pas une API officielle Embark.</li>
            <li>Le craft n'est pas valorisé en crédits : il est signalé, pas monétisé.</li>
            <li>
              Le salvage n'est pas pris en compte : seuls les rendements de recyclage comptent.
            </li>
            <li>
              Les armes sont lues depuis les pages wiki ({weaponCount} variantes), pas depuis la
              table Cargo. Les blueprints ne sont pas vérifiés : le plan suppose la recette apprise.
            </li>
            <li>
              Quelques variantes d'armes n'ont pas de prix de vente sur la wiki : elles s'affichent
              à 0 CR.
            </li>
            <li>
              Un patch peut changer un rendement : relance la synchronisation avant de décider.
            </li>
          </ul>
        </div>
      </Panel>

      <Panel title="Données" eyebrow="Fraîcheur et source">
        <div className="data-card">
          <div>
            <span className="eyebrow">Dernière synchronisation</span>
            <strong>{dateFormatter.format(new Date(catalog.generatedAt))}</strong>
          </div>
          <div>
            <span className="eyebrow">Source</span>
            <a href={catalog.sourceUrl} target="_blank" rel="noreferrer">
              {catalog.source}
            </a>
          </div>
          <div>
            <span className="eyebrow">Couverture</span>
            <strong>
              {catalog.counts.items} objets · {catalog.counts.recycling} rendements ·{" "}
              {catalog.counts.crafting} recettes
            </strong>
          </div>
        </div>
        <p className="muted">
          Le catalogue est généré depuis les tables Cargo de la wiki (items, recycling, crafting),
          complété par les pages d'armes pour les variantes et leurs recettes. Les icônes sont
          copiées en local. Pour rafraîchir après un patch :
        </p>
        <pre className="code">
          <code>pnpm data:update</code>
        </pre>
        <p className="muted">
          La synchronisation récupère les derniers rendements, prix, stacks et recettes. Elle ne
          modifie aucune décision déjà saisie dans ton navigateur.
        </p>
      </Panel>
    </div>
  );
};
