// Matches the live API's CreateProductDiscoveryDto / UpdateProductDiscoveryDto
// exactly (verified against the current Swagger spec).
export interface DiscoveryFormFields {
  businessLogic: string;
  customerJourney: string;
  userFlow: string;
  businessProcess: string;
  assumptions: string;
}

export interface CreateDiscoveryRequest extends DiscoveryFormFields {
  productInitiativeId: string;
}

export type UpdateDiscoveryRequest = DiscoveryFormFields;

// The GET .../product-discovery/{initiativeId} response has no documented
// schema (same situation as ProductProposal before we saw a real response)
// — this is the editable fields plus the minimum read-only fields a record
// needs (id, productInitiativeId), left otherwise unverified.
export interface ProductDiscovery extends DiscoveryFormFields {
  id: string;
  productInitiativeId: string;
}

export const EMPTY_DISCOVERY_FORM: DiscoveryFormFields = {
  businessLogic: "",
  customerJourney: "",
  userFlow: "",
  businessProcess: "",
  assumptions: "",
};
