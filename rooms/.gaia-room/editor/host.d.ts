declare module "$app/paths" {
  export const base: string;
}

declare module "virtual:catalog-assets" {
  const assets: Record<string, string>;
  export default assets;
}
