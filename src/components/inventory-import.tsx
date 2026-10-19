import { useState } from "react";
import { parseInventoryText } from "../lib/inventory-import";
import type { InventoryLine } from "../lib/optimizer";

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
    <details className="import">
      <summary>Import rapide d'inventaire</summary>
      <div className="import__body">
        <p>Une ligne par item, avec la quantité avant ou après le nom.</p>
        <textarea
          name="inventory-import"
          rows={5}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={"12 Advanced Electrical Components\n4 Rocketeer Driver\n30 ARC Alloy"}
        />
        <button type="button" className="button button--ghost" onClick={submit}>
          Importer dans le stash
        </button>
        {message ? <small className="import__message">{message}</small> : null}
      </div>
    </details>
  );
};
