/**
 * Known Shibuya landmarks — real names + approximate heights (meters)
 * matched against OSM tags for accurate skyline.
 * Sources: public building data / Wikipedia heights (approx).
 */

export const LANDMARK_HEIGHTS = [
  { match: /スクランブルスクエア|Scramble Square/i, height: 229, name: '渋谷スクランブルスクエア' },
  { match: /ヒカリエ|Hikarie/i, height: 182.5, name: '渋谷ヒカリエ' },
  { match: /セルリアン|Cerulean/i, height: 184, name: 'セルリアンタワー' },
  { match: /マークシティ|Mark City/i, height: 112, name: '渋谷マークシティ' },
  { match: /フクラス|Fukuras/i, height: 149, name: '渋谷フクラス' },
  { match: /109|イチマルキュー/i, height: 54, name: 'SHIBUYA 109' },
  { match: /QFRONT|キューフロント|TSUTAYA/i, height: 49, name: 'QFRONT' },
  { match: /西武渋谷|Seibu/i, height: 55, name: '西武渋谷店' },
  { match: /東急プラザ|Tokyu Plaza/i, height: 73, name: '東急プラザ渋谷' },
  { match: /パルコ|PARCO/i, height: 62, name: '渋谷パルコ' },
  { match: /MODI|モディ/i, height: 48, name: '渋谷モディ' },
  { match: /ストリーム|Stream/i, height: 36, name: '渋谷ストリーム' },
  { match: /タワーレコード|Tower Records/i, height: 45, name: 'タワーレコード渋谷' },
  { match: /MAGNET/i, height: 45, name: 'MAGNET by SHIBUYA109' },
  { match: /警察署/i, height: 38, name: '渋谷警察署' },
];

export function applyLandmarkHeight(building) {
  const name = `${building.name || ''} ${building.tags?.name || ''} ${building.tags?.['name:en'] || ''} ${building.tags?.['name:ja'] || ''}`;
  for (const lm of LANDMARK_HEIGHTS) {
    if (lm.match.test(name)) {
      return {
        ...building,
        height: Math.max(building.height || 0, lm.height),
        name: building.name || lm.name,
        isLandmark: true,
      };
    }
  }
  return building;
}
