export type PatchCapability =
  | "layout"
  | "accessibility"
  | "local-storage"
  | "keyboard-navigation"
  | "validation"
  | "content-filter"
  | "content-compare"
  | "hide-elements"
  | "reorganize";

export type StyleOperation = {
  id: string;
  type: "style";
  selector: string;
  styles: Record<string, string>;
  when?: { maxWidth?: number; minWidth?: number };
};

export type AttributeOperation = {
  id: string;
  type: "attributes";
  selector: string;
  attributes: Record<string, string>;
};

export type HideOperation = {
  id: string;
  type: "hide";
  selector: string;
};

export type MoveOperation = {
  id: string;
  type: "move";
  selector: string;
  target: string;
  position: "before" | "after" | "prepend" | "append";
};

export type PersistFormOperation = {
  id: string;
  type: "persistForm";
  selector: string;
  key: string;
  include: string[];
  ttlMinutes: number;
  statusText: string;
};

export type FieldRule = {
  kind: "required" | "email" | "minLength" | "pattern";
  value?: number | string;
  message: string;
};

export type ValidationOperation = {
  id: string;
  type: "validation";
  selector: string;
  fields: Array<{ selector: string; rules: FieldRule[] }>;
};

export type KeyboardNavigationOperation = {
  id: string;
  type: "keyboardNavigation";
  container: string;
  items: string;
  orientation: "horizontal" | "vertical";
  wrap?: boolean;
};

export type CollectionFilterOperation = {
  id: string;
  type: "collectionFilter";
  selector: string;
  items: string;
  title: string;
  description: string;
  search: {
    label: string;
    placeholder?: string;
    attributes: string[];
  };
  filters: Array<{
    id: string;
    label: string;
    attribute: string;
    options: Array<{ value: string; label: string }>;
  }>;
  persist?: {
    key: string;
    ttlMinutes: number;
  };
};

export type CollectionCompareOperation = {
  id: string;
  type: "collectionCompare";
  selector: string;
  items: string;
  title: string;
  description: string;
  itemTitleAttribute: string;
  maxItems: number;
  fields: Array<{
    id: string;
    label: string;
    attribute: string;
    values: Array<{ value: string; label: string }>;
  }>;
};

export type PatchOperation =
  | StyleOperation
  | AttributeOperation
  | HideOperation
  | MoveOperation
  | PersistFormOperation
  | ValidationOperation
  | KeyboardNavigationOperation
  | CollectionFilterOperation
  | CollectionCompareOperation;

export type PatchAssertion =
  | { type: "exists"; selector: string; min?: number; max?: number }
  | { type: "attribute"; selector: string; name: string; value: string };

export type CommunityPatch = {
  schemaVersion: 1;
  id: string;
  name: string;
  summary: string;
  version: string;
  author: { name: string; verified?: boolean };
  match: { hosts: string[]; paths: string[] };
  capabilities: PatchCapability[];
  operations: PatchOperation[];
  verify: PatchAssertion[];
  changelog: string;
};

export type ValidationIssue = {
  path: string;
  message: string;
};

export type ValidationResult =
  | { ok: true; patch: CommunityPatch; warnings: ValidationIssue[] }
  | { ok: false; issues: ValidationIssue[]; warnings: ValidationIssue[] };

export type OperationHealth = {
  id: string;
  type: PatchOperation["type"];
  matched: number;
  applied: boolean;
  detail?: string;
};

export type PatchHealth = {
  patchId: string;
  version: string;
  applied: boolean;
  operations: OperationHealth[];
  healthy: number;
  total: number;
  timestamp: number;
};
