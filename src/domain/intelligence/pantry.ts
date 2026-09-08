import type {
  GeneratedMenu,
  LocalFood,
  PackageShoppingItem,
  PantryItem,
  WeeklyPlanResult,
} from '@/types/nutrition';

type ShoppingSource = GeneratedMenu | WeeklyPlanResult;

const menuFoodTotals = (source: ShoppingSource): Map<string, { name:string; grams:number }> => {
  const totals = new Map<string, { name:string; grams:number }>();
  const menus = 'days' in source ? source.days.map((day) => day.menu) : [source];
  for (const menu of menus) {
    for (const meal of menu.meals) {
      for (const portion of meal.foods) {
        const current = totals.get(portion.foodId) || { name:portion.name, grams:0 };
        current.grams += Math.max(0, portion.grams);
        totals.set(portion.foodId, current);
      }
    }
  }
  return totals;
};

export function pantryAvailableFoods(pantry: PantryItem[], foods: LocalFood[]): LocalFood[] {
  const available = new Set(
    pantry
      .filter((item) => Number.isFinite(item.gramsAvailable) && item.gramsAvailable > 0)
      .map((item) => item.foodId),
  );
  return foods.filter((food) => available.has(food.id));
}

export function consumePantryForMenu(pantry: PantryItem[], menu: GeneratedMenu): PantryItem[] {
  const used = menuFoodTotals(menu);
  const now = new Date().toISOString();
  return pantry.map((item) => {
    const consumed = used.get(item.foodId)?.grams || 0;
    if (consumed <= 0) return { ...item };
    return {
      ...item,
      gramsAvailable: Math.max(0, item.gramsAvailable - consumed),
      updatedAt: now,
    };
  });
}

export function buildPackageAwareShoppingList(
  source: ShoppingSource,
  pantry: PantryItem[],
): PackageShoppingItem[] {
  const totals = menuFoodTotals(source);
  const pantryByFood = new Map(pantry.map((item) => [item.foodId, item]));
  const result: PackageShoppingItem[] = [];

  for (const [foodId, entry] of totals) {
    const stock = pantryByFood.get(foodId);
    const gramsFromPantry = Math.min(entry.grams, Math.max(0, stock?.gramsAvailable || 0));
    const gramsToBuy = Math.max(0, entry.grams - gramsFromPantry);
    const packageGrams = stock?.packageGrams && stock.packageGrams > 0 ? stock.packageGrams : undefined;
    const packagesToBuy = gramsToBuy > 0 && packageGrams ? Math.ceil(gramsToBuy / packageGrams) : undefined;
    const estimatedCost = packagesToBuy != null && stock?.packagePrice != null
      ? Math.round(packagesToBuy * stock.packagePrice * 100) / 100
      : undefined;

    result.push({
      foodId,
      name: entry.name,
      gramsNeeded: Math.round(entry.grams * 10) / 10,
      gramsFromPantry: Math.round(gramsFromPantry * 10) / 10,
      gramsToBuy: Math.round(gramsToBuy * 10) / 10,
      packageGrams,
      packagesToBuy,
      estimatedCost,
      retailer: stock?.retailer,
    });
  }

  return result
    .filter((item) => item.gramsToBuy > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
}

const retailerScore = (food: LocalFood, retailer:string): number => {
  const query = retailer.trim().toLowerCase();
  if (!query) return 0;
  const haystack = [
    food.brand || '',
    food.name,
    food.subcategory || '',
    ...(food.tags || []),
  ].join(' ').toLowerCase();
  return haystack.includes(query) ? 1 : 0;
};

export function rankFoodsForRetailer(foods: LocalFood[], retailer: string): LocalFood[] {
  if (!retailer.trim()) return [...foods];
  return foods
    .map((food, index) => ({ food, index, score: retailerScore(food, retailer) }))
    .sort((a, b) => (b.score - a.score) || (a.index - b.index))
    .map((entry) => entry.food);
}
