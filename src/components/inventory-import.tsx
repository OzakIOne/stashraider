import { useState } from "react";
import { Button } from "@/components/ui/button";
import { parseInventoryText } from "@/lib/inventory-import";
import type { InventoryLine } from "@/lib/optimizer";

export const InventoryImport = ({ onImport }: { onImport: (lines: InventoryLine[]) => void }) => {
  const [text, setText] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const submit = () => {
    const result = parseInventoryText(text);
    if (result.lines.length === 0) {
      setMessage("Aucun item reconnu. Vérifie les noms anglais.");
      return;
    }
    onImport(result.lines);
    const unknown =
      result.unknown.length > 0
        ? ` Inconnus : ${result.unknown.slice(0, 3).join(", ")}${result.unknown.length > 3 ? "…" : ""}.`
        : "";
    setMessage(
      `${result.lines.length} ligne${result.lines.length > 1 ? "s" : ""} importée${result.lines.length > 1 ? "s" : ""}.${unknown}`,
    );
    setText("");
  };

  return (
    <details className="group mx-3 mt-3 rounded-lg border border-border bg-black/20">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-2.5 py-2 text-[11px] font-semibold text-muted-foreground [&::-webkit-details-marker]:hidden">
        <span className="text-primary group-open:hidden">+</span>
        <span className="hidden text-primary group-open:inline">−</span>
        Import rapide d'inventaire
      </summary>
      <div className="grid gap-2 border-t border-border p-2.5">
        <p className="text-[10px] text-muted-foreground">
          Une ligne par item, avec la quantité avant ou après le nom.
        </p>
        <textarea
          name="inventory-import"
          rows={5}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={"12 Advanced Electrical Components\n4 Rocketeer Driver\n30 ARC Alloy"}
          className="w-full resize-y rounded-md border border-input bg-black/40 p-2 text-[11px] leading-relaxed outline-none focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring/40"
        />
        <Button variant="outline" size="sm" className="w-full" onClick={submit}>
          Importer dans le stash
        </Button>
        {message ? <small className="text-[10px] text-success">{message}</small> : null}
      </div>
    </details>
  );
};
