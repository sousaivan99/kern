import { createFormController } from "./controller.js"

export const createForm = createFormController
export type {
  CreateFormOptions,
  FormController,
  FormDraft,
  FormFieldController,
  FormInvalidHandler,
  FormIssue,
  FormIssueSource,
  FormSubmitContext,
  FormValidationResult,
  FormValidHandler,
  ReadonlyFormSignal,
  StandardSchemaV1,
  ValidateOn,
} from "./types.js"
