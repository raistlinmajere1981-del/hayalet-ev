export type ProducerInputKind = "pasted_text";

export type PastedTextInput = {
  inputKind: "pasted_text";
  text: string;
  title?: string;
  language?: string;
};
