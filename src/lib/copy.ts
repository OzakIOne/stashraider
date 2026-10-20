import { formatCredits } from "./line-stats";
import type { Disposal, Recommendation } from "./recommend";
import type { ObjectiveReason } from "./retention";

export const plural = (count: number, singular: string, pluralForm = `${singular}s`): string =>
  `${count} ${count > 1 ? pluralForm : singular}`;

const disposalVerb = (disposal: Disposal): string => (disposal === "sell" ? "vendre" : "recycler");

export const recommendationLabel = (recommendation: Recommendation): string => {
  switch (recommendation.kind) {
    case "sell":
      return "Vendre";
    case "recycle":
      return "Recycler";
    case "keep": {
      const reason = recommendation.reason;
      switch (reason.kind) {
        case "crafting":
        case "valueless":
          return "Garder";
        case "objective":
          return reason.disposal
            ? `Garder ${reason.qty} / ${disposalVerb(reason.disposal)}`
            : `Garder ${reason.qty}`;
        default: {
          const _exhaustive: never = reason;
          void _exhaustive;
          return "Garder";
        }
      }
    }
    default: {
      const _exhaustive: never = recommendation;
      void _exhaustive;
      return "";
    }
  }
};

export const recommendationDetail = (recommendation: Recommendation): string => {
  switch (recommendation.kind) {
    case "recycle": {
      const gain = recommendation.recycleValue - recommendation.sellValue;
      return `Recyclage ${formatCredits(recommendation.recycleValue)} CR contre ${formatCredits(recommendation.sellValue)} CR à la vente${gain > 0 ? ` (+${formatCredits(gain)} CR)` : ""}.`;
    }
    case "sell": {
      const gain = recommendation.sellValue - recommendation.recycleValue;
      return `Vente ${formatCredits(recommendation.sellValue)} CR contre ${formatCredits(recommendation.recycleValue)} CR en recyclage${gain > 0 ? ` (+${formatCredits(gain)} CR)` : ""}.`;
    }
    case "keep": {
      const reason = recommendation.reason;
      switch (reason.kind) {
        case "crafting":
          return `${plural(reason.recipeCount, "recette")} ${reason.recipeCount > 1 ? "utilisent" : "utilise"} cet item. À vendre seulement en surplus.`;
        case "valueless":
          return "Aucune valeur de vente ni de recyclage connue.";
        case "objective":
          if (reason.surplusQty <= 0) {
            return "Tout est réservé pour l'objectif.";
          }
          if (!reason.disposal) {
            return `${plural(reason.surplusQty, "unité")} en surplus, sans valeur connue.`;
          }
          return `${plural(reason.surplusQty, "unité")} en surplus → ${disposalVerb(reason.disposal)} pour ${formatCredits(recommendation.value)} CR.`;
        default: {
          const _exhaustive: never = reason;
          void _exhaustive;
          return "";
        }
      }
    }
    default: {
      const _exhaustive: never = recommendation;
      void _exhaustive;
      return "";
    }
  }
};

export const objectiveReasonText = (reason: ObjectiveReason): string => {
  switch (reason.kind) {
    case "direct":
      return `pour l'objectif ${reason.goalQty}× ${reason.goal}`;
    case "ingredient":
      return `pour ${reason.craft}`;
    case "recycle": {
      const bonus =
        reason.bonus.length > 0
          ? ` · +${reason.bonus.map((entry) => `${entry.qty}× ${entry.name}`).join(", ")}`
          : "";
      return `→ ${reason.produced}× ${reason.output}${bonus}`;
    }
    default: {
      const _exhaustive: never = reason;
      void _exhaustive;
      return "";
    }
  }
};
