import type { FoodPreferencePresetId, LocalFood } from '@/types/nutrition';

export interface FoodPreferencePreset {
  id: FoodPreferencePresetId;
  name: string;
  description: string;
}

export const FOOD_PREFERENCE_PRESETS: FoodPreferencePreset[] = [
  { id:'all', name:'Core completo', description:'Usa tutta la libreria alimentare curata di App Nutrition.' },
  { id:'bodybuilding', name:'Bodybuilding essenziale', description:'Pool ristretto di alimenti semplici, ripetibili e pratici per una dieta da bodybuilding.' },
  { id:'high_protein', name:'High Protein', description:'Priorità a fonti proteiche dense con carboidrati e grassi semplici per completare i pasti.' },
  { id:'mediterranean', name:'Mediterraneo', description:'Cereali, tuberi, legumi, frutta, pesce, carni magre, latticini, olio EVO e frutta secca.' },
  { id:'vegetarian', name:'Vegetariano', description:'Uova, latticini, legumi e proteine vegetali, senza carne né pesce.' },
  { id:'vegan', name:'Vegano', description:'Solo fonti vegetali: cereali, legumi, soia, tofu, seitan, frutta, semi e grassi vegetali.' },
  { id:'whole_foods', name:'Whole Foods', description:'Alimenti semplici e poco processati, senza polveri o prodotti proteici industriali.' },
  { id:'quick_meals', name:'Pasti rapidi', description:'Alimenti pratici da assemblare in pochi minuti, utili per giornate con poco tempo.' },
];

const normalize = (value: string): string =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const textOf = (food: LocalFood): string =>
  normalize(`${food.id} ${food.name} ${food.brand || ''} ${food.subcategory || ''}`);

const hasAny = (text: string, tokens: string[]) => tokens.some((token) => text.includes(token));

const MEAT_TOKENS = [
  'pollo','tacchino','manzo','vitello','bovino','maiale','lonza','cavallo',
  'bresaola','prosciutto','speck','salame','carne rossa','carne bianca',
];

const FISH_TOKENS = [
  'salmone','tonno','merluzzo','nasello','platessa','sogliola','pesce spada','calamari',
  'polpo','cozze','vongole','sardine','alici','trota','sgombro','gamber','pesce',
];

const EGG_DAIRY_TOKENS = [
  'uovo','uova','albume','latte','yogurt','greco','skyr','quark','kefir','fiocchi di latte',
  'ricotta','mozzarella','stracchino','formaggio','caseina','whey','milk pro','milbona',
  'ehrmann','hipro','yopro','fage','muller','granarolo','lindahls',
];

const PLANT_PROTEIN_TOKENS = [
  'ceci','lenticchie','fagioli','lupini','soia','edamame','tofu','tempeh','seitan',
  'proteine di pisello','proteine di riso','proteine testurizzate','burger vegetale',
];

const SIMPLE_CARB_TOKENS = [
  'riso','pasta','avena','farina d\'avena','farina di riso','patat','pane','gallette',
  'cous','farro','orzo','bulgur','polenta','semolino','banana','mela','pera','arancia',
  'mandarino','kiwi','fragol','mirtill','lampone','ananas','pesca','albicocc','uva',
];

const SIMPLE_FAT_TOKENS = [
  'olio extravergine','olio evo','mandor','noci','noccio','pistac','arachid','anacard',
  'avocado','semi di chia','semi di lino','semi di zucca','semi di girasole','olive',
];

const BODYBUILDING_FOOD_IDS = new Set([
  // Carboidrati
  'riso_basmati','riso_jasmine','riso_parboiled','pasta','avena','gallette','patate',
  'patate_dolci','pane_integrale','farina_avena','farina_riso','banana','mela','fragole',
  'mirtilli','ananas','miele','marmellata_classica','maltodestrine','destrosio',

  // Proteine
  'pollo','pollo_filetto_cotto','tacchino','tacchino_cotto','manzo_magro','manzo_filetto',
  'bresaola','merluzzo','merluzzo_cotto','nasello','tonno','tonno_fresco','salmone',
  'gamberetti','albumi','albume_pastorizzato','uova_sode','fiocchi_latte_light',
  'fiocchi_latte_classici','skyr','yog0','yogurt_greco_2','quark_magro','whey','caseina',
  'proteine_pisello','proteine_riso',

  // Grassi
  'evoo','mandorle','noci','burro_arachidi','avocado','semi_chia','semi_lino',

  // Pochi prodotti high-protein pronti
  'off-8034066303050','off-8034066303432','off-01640717','off-4056489472261',
  'off-4002971453409','off-07091500','off-0505440633400','off-5410146420795',
  'off-5201054017616','off-0410456440525','off-8002670007794','off-6093290041901',
]);

const HIGH_PROTEIN_BRANDS = [
  'milk pro','milbona','ehrmann','hipro','yopro','fage','muller','granarolo','lindahls',
];

const MEDITERRANEAN_TOKENS = [
  'riso','pasta','farro','orzo','cous','bulgur','pane','patate','polenta','avena',
  'mela','pera','arancia','mandarino','kiwi','fragol','mirtill','lampone','ananas',
  'pesca','albicocc','cilieg','uva','melone','anguria','fichi','prugne',
  'ceci','lenticchie','fagioli','lupini','pollo','tacchino','manzo','salmone',
  'tonno','merluzzo','sgombro','sardine','alici','trota','uovo','albume','yogurt',
  'ricotta','mozzarella','olio','olive','mandor','noci','noccio','pistac','semi',
];

const QUICK_TOKENS = [
  'pane','gallette','wrap','piadina','tortilla','bagel','cereali','fiocchi d\'avena',
  'banana','mela','pera','mirtilli','fragole','tonno al naturale','bresaola',
  'arrosto di tacchino','fesa di tacchino','albume pastorizzato','uova sode',
  'yogurt','skyr','quark','fiocchi di latte','shake','high protein','protein pudding',
  'milk pro','milbona','ehrmann','hipro','yopro','fage','muller','granarolo',
  'mandor','noci','arachid','avocado','olio extravergine',
];

const isMeat = (food: LocalFood) => hasAny(textOf(food), MEAT_TOKENS);
const isFish = (food: LocalFood) => hasAny(textOf(food), FISH_TOKENS);
const isEggOrDairy = (food: LocalFood) => hasAny(textOf(food), EGG_DAIRY_TOKENS);
const isHoney = (food: LocalFood) => textOf(food).includes('miele');

const isPlantFat = (food: LocalFood) => {
  const text = textOf(food);
  return food.category === 'fat' && hasAny(text, SIMPLE_FAT_TOKENS);
};

export function isBodybuildingFood(food: LocalFood): boolean {
  return BODYBUILDING_FOOD_IDS.has(food.id);
}

export function isHighProteinFood(food: LocalFood): boolean {
  const text = textOf(food);
  if (food.category === 'protein' && food.protein >= 10) return true;
  if (food.dataSource === 'Open Food Facts' && food.protein >= 8 && hasAny(text, HIGH_PROTEIN_BRANDS)) return true;
  if (food.category === 'carb') return hasAny(text, SIMPLE_CARB_TOKENS);
  if (isPlantFat(food)) return true;
  return hasAny(text, PLANT_PROTEIN_TOKENS) && food.protein >= 8;
}

export function isMediterraneanFood(food: LocalFood): boolean {
  const text = textOf(food);
  if (text.includes('(polvere)') || text.includes('destrosio') || text.includes('maltodestr')) return false;
  if (food.dataSource === 'Open Food Facts' && !hasAny(text, ['fage','yogurt','skyr'])) return false;
  return hasAny(text, MEDITERRANEAN_TOKENS);
}

export function isVegetarianFood(food: LocalFood): boolean {
  const text = textOf(food);
  if (isMeat(food) || isFish(food)) return false;
  if (food.category === 'carb') return hasAny(text, SIMPLE_CARB_TOKENS);
  if (food.category === 'fat') return isPlantFat(food);
  if (food.category === 'protein' || food.category === 'mixed') {
    return isEggOrDairy(food) || hasAny(text, PLANT_PROTEIN_TOKENS);
  }
  return false;
}

export function isVeganFood(food: LocalFood): boolean {
  const text = textOf(food);
  if (isMeat(food) || isFish(food) || isEggOrDairy(food) || isHoney(food)) return false;
  if (food.dataSource === 'Open Food Facts') return false;
  if (food.category === 'carb') return hasAny(text, SIMPLE_CARB_TOKENS);
  if (food.category === 'fat') return isPlantFat(food);
  if (food.category === 'protein' || food.category === 'mixed') return hasAny(text, PLANT_PROTEIN_TOKENS);
  return false;
}

export function isWholeFood(food: LocalFood): boolean {
  const text = textOf(food);
  if (food.dataSource === 'Open Food Facts') return false;
  if (text.includes('(polvere)') || text.includes('destrosio') || text.includes('maltodestr')) return false;
  if (text.includes('pudding') || text.includes('shake') || text.includes('burger vegetale')) return false;
  if (text.includes('marmellata') || text.includes('maionese')) return false;
  return true;
}

export function isQuickMealFood(food: LocalFood): boolean {
  const text = textOf(food);
  return hasAny(text, QUICK_TOKENS);
}

export function filterFoodsByPreferencePreset(
  foods: LocalFood[],
  presetId: FoodPreferencePresetId,
): LocalFood[] {
  if (presetId === 'all') return foods;
  if (presetId === 'bodybuilding') return foods.filter(isBodybuildingFood);
  if (presetId === 'high_protein') return foods.filter(isHighProteinFood);
  if (presetId === 'mediterranean') return foods.filter(isMediterraneanFood);
  if (presetId === 'vegetarian') return foods.filter(isVegetarianFood);
  if (presetId === 'vegan') return foods.filter(isVeganFood);
  if (presetId === 'whole_foods') return foods.filter(isWholeFood);
  if (presetId === 'quick_meals') return foods.filter(isQuickMealFood);
  return foods;
}

export function resolveFoodPreferencePresetId(value: unknown): FoodPreferencePresetId {
  return FOOD_PREFERENCE_PRESETS.some((preset) => preset.id === value)
    ? value as FoodPreferencePresetId
    : 'all';
}
