import { PlusIcon, TargetIcon, XIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { itemsById, typeLabel, type CatalogItem } from "@/lib/catalog";
import type { Goal, RetentionPlan } from "@/lib/optimizer";
import { cn } from "@/lib/utils";
import { ItemIcon, QtyStepper, RarityBadge } from "./ui";

const equipmentTypes = new Set(["Weapon", "Quick Use", "Augment", "Mods", "Shield"]);

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
  const [targetId, setTargetId] = useState("");
  const [qty, setQty] = useState(10);
  const target = itemsById.get(targetId);

  const options = useMemo<ComboboxOption[]>(
    () =>
      targets.map((item) => ({
        value: item.id,
        label: item.name,
        group: typeLabel(item.type),
        keywords: [item.type, typeLabel(item.type)],
        leading: <ItemIcon item={item} size="xs" />,
        meta: <RarityBadge item={item} />,
      })),
    [targets],
  );

  const plans = useMemo(
    () => plan.goals.filter((goal) => goals.some((entry) => entry.id === goal.goalId)),
    [goals, plan.goals],
  );

  return (
    <section className="border-b border-border px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          <TargetIcon className="size-3.5 text-primary" />
          Objectifs de craft
        </div>
        {goals.length > 0 ? (
          <Badge variant={plan.coveredGoals === goals.length ? "success" : "muted"}>
            {plan.coveredGoals}/{goals.length} couverts
          </Badge>
        ) : null}

        <div className="ml-auto flex w-full min-w-0 items-center gap-2 sm:w-auto">
          <Combobox
            className="h-8 min-w-0 flex-1 font-normal sm:w-72 sm:flex-none"
            options={options}
            value={targetId}
            onChange={(next) => {
              setTargetId(next);
              const selected = itemsById.get(next);
              if (selected) setQty(equipmentTypes.has(selected.type) ? 1 : 10);
            }}
            placeholder="Choisir un objectif…"
            searchPlaceholder="Chercher un composant, une arme…"
            emptyText="Aucun item ne correspond."
            ariaLabel="Objectif à préparer"
            contentClassName="w-[min(22rem,calc(100vw-2rem))]"
          />
          <Input
            type="number"
            min={1}
            max={9999}
            value={qty}
            aria-label="Quantité de l'objectif"
            onChange={(event) => setQty(Math.max(1, Number(event.target.value) || 1))}
            className="h-8 w-14 px-1.5 text-center tabular-nums"
          />
          <Button
            size="sm"
            disabled={!target}
            onClick={() => {
              if (target) onAdd({ id: target.id, qty });
            }}
          >
            <PlusIcon />
            Ajouter
          </Button>
        </div>
      </div>

      {goals.length === 0 ? (
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          Cherche un composant ou un équipement, puis ajoute-le : le plan réserve les sources les
          plus denses avant de désigner le surplus à vendre.
        </p>
      ) : (
        <div className="mt-2 grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
          {plans.map((goal) => {
            const coveredPercent =
              goal.needed > 0 ? Math.min(100, (goal.covered / goal.needed) * 100) : 0;
            return (
              <article
                key={goal.goalId}
                className={cn(
                  "rounded-lg border border-border bg-black/25 px-2.5 py-2",
                  goal.gap === 0 && "border-success/30",
                )}
              >
                <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2">
                  <ItemIcon item={goal.item} size="xs" />
                  <div className="grid min-w-0">
                    <strong className="truncate text-[11.5px] font-semibold">
                      {goal.item.name}
                    </strong>
                    <small className="text-[9.5px] text-muted-foreground">
                      {goal.ready ? "Prêt" : `${goal.covered}/${goal.needed} couverts`}
                    </small>
                  </div>
                  <QtyStepper
                    qty={goal.needed}
                    onChange={(next) => onUpdate(goal.goalId, next)}
                    compact
                  />
                  <button
                    type="button"
                    onClick={() => onRemove(goal.goalId)}
                    aria-label={`Retirer l'objectif ${goal.item.name}`}
                    className="grid size-5 place-items-center rounded text-muted-foreground transition-colors hover:text-destructive"
                  >
                    <XIcon className="size-3" />
                  </button>
                </div>

                <Progress
                  value={coveredPercent}
                  className="mt-2 h-1"
                  indicatorClassName={
                    goal.gap === 0 ? "bg-gradient-to-r from-[#2fa96c] to-success" : undefined
                  }
                />

                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[9px] font-semibold tracking-wide uppercase">
                  {goal.mode === "craft" ? <span className="text-warning">Recette</span> : null}
                  {goal.mode === "component" ? (
                    <span className="text-muted-foreground">
                      Recyclage {Math.min(goal.sourceCovered, goal.needed)}
                    </span>
                  ) : null}
                  {goal.mode === "component" || goal.directKept > 0 ? (
                    <span className="text-muted-foreground">
                      Direct {Math.min(goal.directKept, goal.needed)}
                    </span>
                  ) : null}
                  {goal.ready ? (
                    <span className="text-success">
                      {goal.mode === "craft" ? "prêt" : "couvert"}
                    </span>
                  ) : (
                    <span className="text-destructive">
                      {goal.missing.length} manquant{goal.missing.length > 1 ? "s" : ""}
                    </span>
                  )}
                </div>

                {goal.reservations.length > 0 || goal.directKept > 0 ? (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {goal.reservations.map((entry) => (
                      <span
                        key={`${entry.item.id}-${entry.reason}`}
                        className="grid gap-px rounded border border-border px-1.5 py-0.5 text-[9.5px]"
                      >
                        {entry.keepQty}× {entry.item.name}
                        <small className="text-[8.5px] text-muted-foreground">{entry.reason}</small>
                      </span>
                    ))}
                  </div>
                ) : null}

                {goal.missing.length > 0 ? (
                  <p className="mt-1.5 text-[10px] text-muted-foreground">
                    Manque :{" "}
                    {goal.missing.map((entry) => `${entry.qty}× ${entry.name}`).join(" · ")}
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
