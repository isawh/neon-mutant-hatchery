declare const process: {
  env: Record<string, string | undefined>;
};

declare const Buffer: {
  from(input: string | Uint8Array, encoding?: string): any;
};

declare module "express" {
  const express: any;
  export default express;
}

declare module "cors" {
  const cors: any;
  export default cors;
}

declare module "dotenv" {
  export const config: () => void;
}

declare module "crypto" {
  export const createHmac: any;
  export const timingSafeEqual: any;
}
