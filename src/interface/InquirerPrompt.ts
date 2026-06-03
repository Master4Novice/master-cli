type InquirerOptions = {
  type: string;
  name: string;
  message: string;
  default?: number | boolean;
  validate?: (input: any) => boolean | string;
  choices?: Array<object> | Array<string>;
};

export { InquirerOptions };
