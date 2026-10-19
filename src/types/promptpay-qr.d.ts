declare module "promptpay-qr" {
  export interface PromptPayOptions {
    amount?: number;
  }
  function generatePayload(target: string, options?: PromptPayOptions): string;
  export default generatePayload;
  export = generatePayload;
}
