export const foldText = (value: string): string =>
  value
    .normalize("NFD")
    .replaceAll(/\p{Diacritic}/gu, "")
    .toLowerCase();

export const searchKey = (value: string): string =>
  foldText(value)
    .replaceAll(/[^a-z0-9]+/g, " ")
    .trim();
