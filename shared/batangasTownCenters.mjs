// Approximate town-center coordinates are for map framing; verify precise pins on the map.
export const BATANGAS_TOWN_CENTERS = [
  { name: 'Batangas City', center: [13.7561, 121.0577] },
  { name: 'Lipa', aliases: ['Lipa City'], center: [13.9414, 121.1642] },
  { name: 'Tanauan', aliases: ['Tanauan City'], center: [14.0853, 121.1528] },
  { name: 'Calaca', center: [13.9304, 120.8128] },
  { name: 'Nasugbu', center: [14.0734, 120.6322] },
  { name: 'Balayan', center: [13.948324, 120.722989] },
  { name: 'Lemery', center: [13.8837, 120.9132] },
  { name: 'Taal', center: [13.8803, 120.9238] },
  { name: 'Bauan', center: [13.7925, 121.0076] },
  { name: 'Mabini', center: [13.7476, 120.9412] },
  { name: 'San Juan', center: [13.8246, 121.3962] },
  { name: 'Rosario', center: [13.8442, 121.2035] },
  { name: 'Ibaan', center: [13.8196, 121.1358] },
  { name: 'Cuenca', center: [13.9015, 121.0492] },
  { name: 'Lobo', center: [13.6473, 121.2100] },
  { name: 'Malvar', center: [14.0542, 121.1548] },
  { name: 'Padre Garcia', center: [13.8777, 121.2116] },
  { name: 'Laurel', center: [14.0504, 120.9332] },
  { name: 'Santa Teresita', center: [13.8698, 120.9769] },
  { name: 'Talisay', center: [14.0944, 121.0219] },
  { name: 'San Nicolas', center: [13.9302, 120.9521] },
  { name: 'Agoncillo', center: [13.9348, 120.9285] },
  { name: 'Alitagtag', center: [13.8653, 121.0046] },
  { name: 'Mataasnakahoy', aliases: ['Mataas na Kahoy'], center: [13.9625, 121.1137] },
  { name: 'Santo Tomas', aliases: ['Sto. Tomas', 'Sto Tomas'], center: [14.1068, 121.1616] },
  { name: 'Taysan', center: [13.7968, 121.1885] },
  { name: 'Tingloy', center: [13.6592, 120.8734] },
  { name: 'Balete', center: [14.0168, 121.0998] },
  { name: 'Lian', center: [14.0357, 120.6534] },
];

export function normalizeBatangasLocationWords(value) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export function findBatangasTown(location) {
  const normalizedLocation = ` ${normalizeBatangasLocationWords(location)} `;
  return BATANGAS_TOWN_CENTERS
    .flatMap((town) => [town.name, ...(town.aliases ?? [])].map((label) => ({ town, label })))
    .filter(({ label }) => normalizedLocation.includes(` ${normalizeBatangasLocationWords(label)} `))
    .sort((first, second) => normalizeBatangasLocationWords(second.label).length - normalizeBatangasLocationWords(first.label).length)[0]?.town;
}
