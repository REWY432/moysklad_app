
export interface MoySkladCredentials {
  login: string;
  password?: string;
  token?: string;
}

export interface MSProduct {
  id: string;
  name: string;
  code?: string;
  article?: string;
  description?: string;
  salePrices?:Array<{
    value: number;
    currency: { name: string };
  }>;
  quantity?: number;
  uom?: {
    name: string; // Unit of measure
  };
}

export interface MSOrderPosition {
  id: string;
  quantity: number;
  price: number;
  assortment: {
    meta: {
      href: string;
      type: string;
    };
    name: string;
    code?: string;
    article?: string;
    uom?: {
      name: string;
    }
  };
}

export interface MSOrder {
  id: string;
  name: string;
  moment: string;
  sum: number;
  agent: {
    meta: {
      href: string;
      metadataHref: string;
      type: string;
      mediaType: string;
    }
    name?: string; 
  };
  organization: {
    meta: {
      href: string;
      metadataHref: string;
      type: string;
      mediaType: string;
    }
    name?: string;
  };
  state: {
    name: string;
    color: string;
  };
  description?: string;
}

export enum AppView {
  LOGIN = 'LOGIN',
  DASHBOARD = 'DASHBOARD',
}

// Packing List Types
export interface PackedItem {
  originalId: string;
  name: string;
  code: string;
  article: string;
  uom: string;
  quantity: number;
}

export interface CargoPlace {
  id: number;
  name: string;
  items: PackedItem[];
}

export interface PackingListState {
    order_id: string;
    order_name: string;
    places: CargoPlace[];
    unpacked_items: MSOrderPosition[];
    updated_at?: string;
}