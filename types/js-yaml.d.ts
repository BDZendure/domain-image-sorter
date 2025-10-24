declare module 'js-yaml' {
  export function load(src: string): any;
  export function dump(obj: any): string;
}
