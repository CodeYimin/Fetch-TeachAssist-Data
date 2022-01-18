export function getAllSubsets<T>(array: T[]): T[][] {
  return array.reduce((subsets, value) => {
    subsets.push(...subsets.map((set) => [value,...set]));
    return subsets;
  }, [[]] as T[][])
}