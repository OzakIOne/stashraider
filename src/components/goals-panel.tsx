import { useMemo, useState } from "react";
import { itemsById, typeLabel, type CatalogItem } from "../lib/catalog";
import type { Goal, RetentionPlan } from "../lib/optimizer";
import { ItemIcon, QtyStepper } from "./ui";

export const GoalsPanel = ({
  goals,
  plan,
  targets,
  onAdd,
  onUpdate,
  onRemove,
}: {
  goals: Goal[];
  plan: RetentionPlan;
  targets: CatalogItem[];
  onAdd: (goal: Goal) => void;
  onUpdate: (id: string, qty: number) => void;
  onRemove: (id: string) => void;
}) => {
  const [targetId, setTargetId] = useState("advanced-electrical-components");
  const [qty, setQty] = useState(10);
  const target = itemsById.get(targetId) ?? targets[0];

  const groups = useMemo(() => {
    const byType = new Map<string, CatalogItem[]>();
    for (const item of targets) {
      const label = typeLabel(item.type);
      byType.set(label, [...(byType.get(label) ?? []), item]);
    }
    return [...byType];
  }, [targets]);

  const plans = useMemo(
    () => plan.goals.filter((goal) => goals.some((entry) => entry.id === goal.goalId)),
    [goals, plan.goals],
  );

  return (
    <section className="goals">
      <header className="goals__head">
        <div>
          <p className="eyebrow">Objectifs de craft</p>
          <h3>Ce que tu veux préparer</h3>
        </div>
        {goals.length > 0 ? (
          <span className="goals__count">
            {plan.coveredGoals}/{goals.length} couverts
          </span>
        ) : null}
      </header>

      <div className="goals__add">
        <select
          name="goal-target"
          value={target?.id ?? ""}
          onChange={(event) => setTargetId(event.target.value)}
        >
          {groups.map(([label, items]) => (
            <optgroup label={label} key={label}>
              {items.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <input
          type="number"
          min={1}
          max={9999}
          name="goal-quantity"
          value={qty}
          aria-label="Quantité de l'objectif"
          onChange={(event) => setQty(Math.max(1, Number(event.target.value) || 1))}
        />
        <button
          type="button"
          className="button button--primary"
          onClick={() => {
            if (target) onAdd({ id: target.id, qty });
          }}
        >
          Ajouter
        </button>
      </div>

      {goals.length === 0 ? (
        <p className="goals__empty">
          Ajoute un composant à préparer. L'optimiseur réserve les sources recyclables plus denses
          qu'un stack du composant direct, complète avec le composant direct, puis désigne le reste
          comme surplus.
        </p>
      ) : (
        <div className="goals__list">
          {plans.map((goal) => {
            const coveredPercent =
              goal.needed > 0 ? Math.min(100, (goal.covered / goal.needed) * 100) : 0;
            const reserved = goal.reservations;
            return (
              <article className={`goal${goal.gap === 0 ? " is-covered" : ""}`} key={goal.goalId}>
                <div className="goal__head">
                  <ItemIcon item={goal.item} size="sm" />
                  <div>
                    <strong>{goal.item.name}</strong>
                    <small>
                      {goal.covered}/{goal.needed} couverts
                    </small>
                  </div>
                  <QtyStepper
                    qty={goal.needed}
                    onChange={(next) => onUpdate(goal.goalId, next)}
                    compact
                  />
                  <button
                    type="button"
                    className="goal__remove"
                    onClick={() => onRemove(goal.goalId)}
                    aria-label={`Retirer l'objectif ${goal.item.name}`}
                  >
                    ×
                  </button>
                </div>
                <div className="goal__bar" aria-hidden="true">
                  <span style={{ width: `${coveredPercent}%` }} />
                </div>
                <div className="goal__counts">
                  <span>Recyclage {Math.min(goal.sourceCovered, goal.needed)}</span>
                  <span>Direct {Math.min(goal.directKept, goal.needed)}</span>
                  {goal.gap > 0 ? (
                    <span className="danger">
                      {goal.gap} manquant{goal.gap > 1 ? "s" : ""}
                    </span>
                  ) : (
                    <span className="ok">couvert</span>
                  )}
                </div>
                {reserved.length > 0 || goal.directKept > 0 ? (
                  <div className="goal__reserved">
                    {reserved.map((entry) => (
                      <span key={entry.item.id}>
                        {entry.keepQty}× {entry.item.name}
                        <small>
                          → {entry.produced}× {goal.item.name}
                          {entry.bonus.length > 0
                            ? ` · +${entry.bonus.map((bonus) => `${bonus.qty}× ${bonus.name}`).join(", ")}`
                            : ""}
                        </small>
                      </span>
                    ))}
                    {goal.directKept > 0 ? (
                      <span>
                        {goal.directKept}× {goal.item.name}
                        <small>direct</small>
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <p className="goal__missing">Aucun item du stash ne couvre cet objectif.</p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
