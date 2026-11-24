export const INDONESIA_PROVINCES = [
  'Aceh',
  'Sumatera Utara',
  'Sumatera Barat',
  'Riau',
  'Jambi',
  'Sumatera Selatan',
  'Bengkulu',
  'Lampung',
  'Kepulauan Bangka Belitung',
  'Kepulauan Riau',
  'DKI Jakarta',
  'Jawa Barat',
  'Jawa Tengah',
  'Daerah Istimewa Yogyakarta',
  'Jawa Timur',
  'Banten',
  'Bali',
  'Nusa Tenggara Barat',
  'Nusa Tenggara Timur',
  'Kalimantan Barat',
  'Kalimantan Tengah',
  'Kalimantan Selatan',
  'Kalimantan Timur',
  'Kalimantan Utara',
  'Sulawesi Utara',
  'Sulawesi Tengah',
  'Sulawesi Selatan',
  'Sulawesi Tenggara',
  'Gorontalo',
  'Sulawesi Barat',
  'Maluku',
  'Maluku Utara',
  'Papua',
  'Papua Barat',
  'Papua Barat Daya',
  'Papua Tengah',
  'Papua Selatan',
  'Papua Pegunungan',
] as const;

export type IndonesiaProvinceName = (typeof INDONESIA_PROVINCES)[number];

export interface GeoCoordinate {
  lon: number;
  lat: number;
}

const PROVINCE_DISPLAY_SHORT: Partial<Record<IndonesiaProvinceName, string>> = {
  'Daerah Istimewa Yogyakarta': 'DI Yogyakarta',
  'Kepulauan Bangka Belitung': 'Bangka Belitung',
  'Kepulauan Riau': 'Kep. Riau',
  'Nusa Tenggara Barat': 'NTB',
  'Nusa Tenggara Timur': 'NTT',
};

export function formatProvinceShortName(province: string): string {
  return PROVINCE_DISPLAY_SHORT[province as IndonesiaProvinceName] ?? province;
}

export function normalizeGeoLookupKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\./g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^(kota|kabupaten|kab|provinsi|prov)\s+/i, '')
    .trim();
}

const CANONICAL_PROVINCE_BY_KEY = new Map<string, IndonesiaProvinceName>(
  INDONESIA_PROVINCES.map((prov) => [normalizeGeoLookupKey(prov), prov])
);

const BRANCH_TO_PROVINCE_RAW: Record<string, IndonesiaProvinceName> = {
  // Aceh
  'banda aceh': 'Aceh',
  aceh: 'Aceh',
  lhokseumawe: 'Aceh',
  langsa: 'Aceh',
  meulaboh: 'Aceh',

  // Sumatera Utara
  medan: 'Sumatera Utara',
  pematangsiantar: 'Sumatera Utara',
  'pematang siantar': 'Sumatera Utara',
  siantar: 'Sumatera Utara',
  binjai: 'Sumatera Utara',
  'deli serdang': 'Sumatera Utara',
  'tebing tinggi': 'Sumatera Utara',
  padangsidimpuan: 'Sumatera Utara',
  rantauprapat: 'Sumatera Utara',
  kisaran: 'Sumatera Utara',

  // Sumatera Barat
  padang: 'Sumatera Barat',
  bukittinggi: 'Sumatera Barat',
  payakumbuh: 'Sumatera Barat',
  solok: 'Sumatera Barat',
  pariaman: 'Sumatera Barat',

  // Riau & Kep. Riau
  pekanbaru: 'Riau',
  dumai: 'Riau',
  duri: 'Riau',
  rengat: 'Riau',
  batam: 'Kepulauan Riau',
  tanjungpinang: 'Kepulauan Riau',
  'tanjung pinang': 'Kepulauan Riau',
  bintan: 'Kepulauan Riau',
  karimun: 'Kepulauan Riau',

  // Jambi, Bengkulu, Sumsel, Babel, Lampung
  jambi: 'Jambi',
  'muara bungo': 'Jambi',
  'sungai penuh': 'Jambi',
  bengkulu: 'Bengkulu',
  palembang: 'Sumatera Selatan',
  lubuklinggau: 'Sumatera Selatan',
  prabumulih: 'Sumatera Selatan',
  baturaja: 'Sumatera Selatan',
  lahat: 'Sumatera Selatan',
  'muara enim': 'Sumatera Selatan',
  pangkalpinang: 'Kepulauan Bangka Belitung',
  'pangkal pinang': 'Kepulauan Bangka Belitung',
  bangka: 'Kepulauan Bangka Belitung',
  belitung: 'Kepulauan Bangka Belitung',
  'bandar lampung': 'Lampung',
  lampung: 'Lampung',
  metro: 'Lampung',
  kotabumi: 'Lampung',

  // DKI Jakarta
  jakarta: 'DKI Jakarta',
  'dki jakarta': 'DKI Jakarta',
  'jakarta barat': 'DKI Jakarta',
  'jakarta pusat': 'DKI Jakarta',
  'jakarta selatan': 'DKI Jakarta',
  'jakarta timur': 'DKI Jakarta',
  'jakarta utara': 'DKI Jakarta',
  jakbar: 'DKI Jakarta',
  jaksel: 'DKI Jakarta',
  jaktim: 'DKI Jakarta',
  jakut: 'DKI Jakarta',
  jakpus: 'DKI Jakarta',

  // Banten
  tangerang: 'Banten',
  'tangerang selatan': 'Banten',
  tangsel: 'Banten',
  serang: 'Banten',
  cilegon: 'Banten',
  pandeglang: 'Banten',
  lebak: 'Banten',
  bsd: 'Banten',

  // Jawa Barat
  bandung: 'Jawa Barat',
  bekasi: 'Jawa Barat',
  cirebon: 'Jawa Barat',
  bogor: 'Jawa Barat',
  depok: 'Jawa Barat',
  karawang: 'Jawa Barat',
  sukabumi: 'Jawa Barat',
  tasikmalaya: 'Jawa Barat',
  cikarang: 'Jawa Barat',
  purwakarta: 'Jawa Barat',
  garut: 'Jawa Barat',
  cimahi: 'Jawa Barat',
  subang: 'Jawa Barat',
  indramayu: 'Jawa Barat',
  sumedang: 'Jawa Barat',

  // Jawa Tengah & DIY
  semarang: 'Jawa Tengah',
  solo: 'Jawa Tengah',
  surakarta: 'Jawa Tengah',
  purwokerto: 'Jawa Tengah',
  tegal: 'Jawa Tengah',
  pekalongan: 'Jawa Tengah',
  magelang: 'Jawa Tengah',
  kudus: 'Jawa Tengah',
  pati: 'Jawa Tengah',
  salatiga: 'Jawa Tengah',
  cilacap: 'Jawa Tengah',
  klaten: 'Jawa Tengah',
  kebumen: 'Jawa Tengah',
  yogyakarta: 'Daerah Istimewa Yogyakarta',
  'di yogyakarta': 'Daerah Istimewa Yogyakarta',
  jogja: 'Daerah Istimewa Yogyakarta',
  jogjakarta: 'Daerah Istimewa Yogyakarta',
  sleman: 'Daerah Istimewa Yogyakarta',
  bantul: 'Daerah Istimewa Yogyakarta',

  // Jawa Timur
  surabaya: 'Jawa Timur',
  malang: 'Jawa Timur',
  sidoarjo: 'Jawa Timur',
  gresik: 'Jawa Timur',
  kediri: 'Jawa Timur',
  jember: 'Jawa Timur',
  madiun: 'Jawa Timur',
  mojokerto: 'Jawa Timur',
  pasuruan: 'Jawa Timur',
  probolinggo: 'Jawa Timur',
  banyuwangi: 'Jawa Timur',
  blitar: 'Jawa Timur',
  tulungagung: 'Jawa Timur',
  lamongan: 'Jawa Timur',
  tuban: 'Jawa Timur',

  // Bali & Nusa Tenggara
  denpasar: 'Bali',
  badung: 'Bali',
  gianyar: 'Bali',
  singaraja: 'Bali',
  tabanan: 'Bali',
  mataram: 'Nusa Tenggara Barat',
  bima: 'Nusa Tenggara Barat',
  sumbawa: 'Nusa Tenggara Barat',
  lombok: 'Nusa Tenggara Barat',
  kupang: 'Nusa Tenggara Timur',
  maumere: 'Nusa Tenggara Timur',
  ende: 'Nusa Tenggara Timur',
  'labuan bajo': 'Nusa Tenggara Timur',
  waingapu: 'Nusa Tenggara Timur',

  // Kalimantan
  pontianak: 'Kalimantan Barat',
  singkawang: 'Kalimantan Barat',
  ketapang: 'Kalimantan Barat',
  sintang: 'Kalimantan Barat',
  palangkaraya: 'Kalimantan Tengah',
  'palangka raya': 'Kalimantan Tengah',
  sampit: 'Kalimantan Tengah',
  'pangkalan bun': 'Kalimantan Tengah',
  banjarmasin: 'Kalimantan Selatan',
  banjarbaru: 'Kalimantan Selatan',
  martapura: 'Kalimantan Selatan',
  kotabaru: 'Kalimantan Selatan',
  balikpapan: 'Kalimantan Timur',
  samarinda: 'Kalimantan Timur',
  bontang: 'Kalimantan Timur',
  sangatta: 'Kalimantan Timur',
  berau: 'Kalimantan Timur',
  tenggarong: 'Kalimantan Timur',
  tarakan: 'Kalimantan Utara',
  'tanjung selor': 'Kalimantan Utara',
  nunukan: 'Kalimantan Utara',
  malinau: 'Kalimantan Utara',

  // Sulawesi
  manado: 'Sulawesi Utara',
  bitung: 'Sulawesi Utara',
  tomohon: 'Sulawesi Utara',
  kotamobagu: 'Sulawesi Utara',
  palu: 'Sulawesi Tengah',
  luwuk: 'Sulawesi Tengah',
  poso: 'Sulawesi Tengah',
  tolitoli: 'Sulawesi Tengah',
  makassar: 'Sulawesi Selatan',
  parepare: 'Sulawesi Selatan',
  palopo: 'Sulawesi Selatan',
  watampone: 'Sulawesi Selatan',
  bulukumba: 'Sulawesi Selatan',
  maros: 'Sulawesi Selatan',
  kendari: 'Sulawesi Tenggara',
  baubau: 'Sulawesi Tenggara',
  kolaka: 'Sulawesi Tenggara',
  gorontalo: 'Gorontalo',
  mamuju: 'Sulawesi Barat',
  polewali: 'Sulawesi Barat',

  // Maluku & Papua
  ambon: 'Maluku',
  tual: 'Maluku',
  ternate: 'Maluku Utara',
  tidore: 'Maluku Utara',
  tobelo: 'Maluku Utara',
  jayapura: 'Papua',
  sorong: 'Papua Barat Daya',
  manokwari: 'Papua Barat',
  nabire: 'Papua Tengah',
  timika: 'Papua Tengah',
  mimika: 'Papua Tengah',
  merauke: 'Papua Selatan',
  wamena: 'Papua Pegunungan',
  jayawijaya: 'Papua Pegunungan',
};

const REGION_TO_PROVINCE_RAW: Record<string, IndonesiaProvinceName> = {
  jabodetabek: 'DKI Jakarta',
  jakarta: 'DKI Jakarta',
  'jawa barat': 'Jawa Barat',
  jabar: 'Jawa Barat',
  'jawa tengah': 'Jawa Tengah',
  jateng: 'Jawa Tengah',
  'jawa timur': 'Jawa Timur',
  jatim: 'Jawa Timur',
  banten: 'Banten',
  yogyakarta: 'Daerah Istimewa Yogyakarta',
  diy: 'Daerah Istimewa Yogyakarta',
  sumatera: 'Sumatera Utara',
  'sumatera utara': 'Sumatera Utara',
  'sumatera selatan': 'Sumatera Selatan',
  'sumatera barat': 'Sumatera Barat',
  kalimantan: 'Kalimantan Timur',
  'kalimantan timur': 'Kalimantan Timur',
  'kalimantan selatan': 'Kalimantan Selatan',
  'kalimantan barat': 'Kalimantan Barat',
  'kalimantan tengah': 'Kalimantan Tengah',
  'kalimantan utara': 'Kalimantan Utara',
  sulawesi: 'Sulawesi Selatan',
  'sulawesi selatan': 'Sulawesi Selatan',
  'sulawesi utara': 'Sulawesi Utara',
  bali: 'Bali',
  papua: 'Papua',
  maluku: 'Maluku',
};

const BRANCH_COORDINATES_RAW: Record<string, GeoCoordinate> = {
  'banda aceh': { lon: 95.32, lat: 5.55 },
  medan: { lon: 98.67, lat: 3.59 },
  pematangsiantar: { lon: 99.06, lat: 2.96 },
  padang: { lon: 100.35, lat: -0.95 },
  pekanbaru: { lon: 101.45, lat: 0.51 },
  batam: { lon: 104.03, lat: 1.05 },
  jambi: { lon: 103.61, lat: -1.61 },
  bengkulu: { lon: 102.27, lat: -3.8 },
  palembang: { lon: 104.75, lat: -2.99 },
  pangkalpinang: { lon: 106.11, lat: -2.13 },
  'bandar lampung': { lon: 105.26, lat: -5.43 },
  lampung: { lon: 105.26, lat: -5.43 },

  jakarta: { lon: 106.85, lat: -6.21 },
  'jakarta barat': { lon: 106.75, lat: -6.17 },
  'jakarta pusat': { lon: 106.84, lat: -6.18 },
  'jakarta selatan': { lon: 106.81, lat: -6.26 },
  'jakarta timur': { lon: 106.9, lat: -6.23 },
  'jakarta utara': { lon: 106.88, lat: -6.13 },
  tangerang: { lon: 106.63, lat: -6.18 },
  'tangerang selatan': { lon: 106.71, lat: -6.29 },
  serang: { lon: 106.15, lat: -6.12 },
  cilegon: { lon: 106.04, lat: -6.01 },
  bekasi: { lon: 107.0, lat: -6.24 },
  cikarang: { lon: 107.17, lat: -6.27 },
  bogor: { lon: 106.8, lat: -6.6 },
  depok: { lon: 106.82, lat: -6.4 },
  karawang: { lon: 107.3, lat: -6.32 },
  bandung: { lon: 107.61, lat: -6.91 },
  cirebon: { lon: 108.56, lat: -6.71 },
  tasikmalaya: { lon: 108.22, lat: -7.33 },
  sukabumi: { lon: 106.93, lat: -6.92 },

  semarang: { lon: 110.42, lat: -6.99 },
  solo: { lon: 110.83, lat: -7.57 },
  surakarta: { lon: 110.83, lat: -7.57 },
  purwokerto: { lon: 109.24, lat: -7.43 },
  tegal: { lon: 109.14, lat: -6.87 },
  magelang: { lon: 110.22, lat: -7.47 },
  yogyakarta: { lon: 110.37, lat: -7.8 },
  jogja: { lon: 110.37, lat: -7.8 },

  surabaya: { lon: 112.75, lat: -7.25 },
  sidoarjo: { lon: 112.72, lat: -7.45 },
  malang: { lon: 112.63, lat: -7.98 },
  kediri: { lon: 112.01, lat: -7.82 },
  jember: { lon: 113.7, lat: -8.17 },
  madiun: { lon: 111.52, lat: -7.63 },

  denpasar: { lon: 115.22, lat: -8.67 },
  mataram: { lon: 116.12, lat: -8.58 },
  kupang: { lon: 123.61, lat: -10.17 },

  pontianak: { lon: 109.34, lat: -0.02 },
  palangkaraya: { lon: 113.92, lat: -2.21 },
  'palangka raya': { lon: 113.92, lat: -2.21 },
  banjarmasin: { lon: 114.59, lat: -3.32 },
  balikpapan: { lon: 116.83, lat: -1.24 },
  samarinda: { lon: 117.15, lat: -0.5 },
  tarakan: { lon: 117.58, lat: 3.3 },

  manado: { lon: 124.84, lat: 1.47 },
  gorontalo: { lon: 123.06, lat: 0.54 },
  palu: { lon: 119.87, lat: -0.9 },
  mamuju: { lon: 118.89, lat: -2.68 },
  makassar: { lon: 119.43, lat: -5.14 },
  kendari: { lon: 122.52, lat: -3.98 },

  ambon: { lon: 128.18, lat: -3.7 },
  ternate: { lon: 127.38, lat: 0.79 },
  jayapura: { lon: 140.72, lat: -2.54 },
  sorong: { lon: 131.26, lat: -0.88 },
  manokwari: { lon: 134.06, lat: -0.86 },
  nabire: { lon: 135.5, lat: -3.36 },
  merauke: { lon: 140.4, lat: -8.49 },
  wamena: { lon: 138.94, lat: -4.09 },
};

export function resolveProvinceName(
  branch: string,
  region?: string
): IndonesiaProvinceName | null {
  const branchKey = normalizeGeoLookupKey(branch ?? '');
  if (branchKey) {
    const exactBranch = BRANCH_TO_PROVINCE_RAW[branchKey];
    if (exactBranch) return exactBranch;
    const directProvince = CANONICAL_PROVINCE_BY_KEY.get(branchKey);
    if (directProvince) return directProvince;
  }

  const regionKey = normalizeGeoLookupKey(region ?? '');
  if (regionKey) {
    const exactRegion = REGION_TO_PROVINCE_RAW[regionKey];
    if (exactRegion) return exactRegion;
    const directProvince = CANONICAL_PROVINCE_BY_KEY.get(regionKey);
    if (directProvince) return directProvince;
  }

  return null;
}

export function resolveBranchCoordinate(branch: string): GeoCoordinate | null {
  const key = normalizeGeoLookupKey(branch ?? '');
  if (!key) return null;
  return BRANCH_COORDINATES_RAW[key] ?? null;
}
