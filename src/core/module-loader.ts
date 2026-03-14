export async function loadOptionalModule<T = any>(moduleName: string): Promise<T> {
  const dynamicImport = new Function("moduleName", "return import(moduleName);") as (
    name: string
  ) => Promise<T>;

  return dynamicImport(moduleName);
}
