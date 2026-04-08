export interface MetaContact {
  profile: {
    name: string;
  };
  wa_id: string;
}

export type MetaMessageType = 'text' | 'interactive' | 'button' | string;

export interface MetaMessageItem {
  from: string;
  id: string;
  timestamp: string;
  type: MetaMessageType;
  text?: {
    body: string;
  };
  interactive?: {
    type: 'list_reply' | 'button_reply';
    list_reply?: { id: string; title: string };
    button_reply?: { id: string; title: string };
  };
  button?: {
    payload: string;
    text: string;
  };
}

export interface MetaValue {
  messaging_product: string;
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
  contacts?: MetaContact[];
  messages?: MetaMessageItem[];
}
